const API_URL = "/api/ai";
const MAX_LEADS = 5;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function text(value, limit) {
  if (typeof value !== "string" || !value.trim() || value.length > limit) throw new Error("invalid-response");
  return value.trim();
}

function strings(value, limit, count, allowEmpty = false) {
  if (!Array.isArray(value) || value.length > count || (!allowEmpty && !value.length)) throw new Error("invalid-response");
  return value.map((item) => text(item, limit));
}

function messageFor(status) {
  if (status === 401) return "Sua sessão expirou. Entre novamente para usar a IA.";
  if (status === 403) return "A análise por IA ainda não está liberada para esta conta.";
  if (status === 429) return "O limite de análises foi atingido por enquanto. Tente novamente mais tarde.";
  if (status === 400 || status === 413) return "Revise sua oferta e reduza os dados antes de tentar novamente.";
  if (status === 504) return "A análise demorou mais do que o esperado. Tente novamente.";
  return "A análise por IA está temporariamente indisponível. Tente novamente mais tarde.";
}

export function initializeAIWorkspace({ crmRows } = {}) {
  const offerPane = document.querySelector("#ai-offer-panel");
  const offer = document.querySelector("#ai-offer");
  const offerButton = document.querySelector("#ai-suggest-niches");
  const offerStatus = document.querySelector("#ai-offer-status");
  const offerResults = document.querySelector("#ai-niche-results");
  const crmOffer = document.querySelector("#ai-crm-offer");
  const leadButton = document.querySelector("#ai-analyze-leads");
  const leadStatus = document.querySelector("#ai-lead-status");
  const leadCount = document.querySelector("#ai-lead-count");
  const leadResults = document.querySelector("#ai-lead-results");
  const niche = document.querySelector("#search-niche");
  if (!offerPane || !offer || !offerButton || !offerStatus || !offerResults || !crmOffer || !leadButton || !leadStatus || !leadCount || !leadResults || !niche || !crmRows) return null;

  let currentUser = null;
  let connection = null;
  let userRevision = 0;
  let availability = "unavailable";
  let unavailableMessage = "Entre na sua conta para usar a análise por IA.";
  let rowSequence = 0;
  const rowIds = new WeakMap();
  const tasks = {
    offer: { revision: 0, controller: null, busy: false, results: offerResults, status: offerStatus },
    leads: { revision: 0, controller: null, busy: false, results: leadResults, status: leadStatus },
  };
  const offerLabel = offerButton.querySelector(".app-button-label");
  const leadLabel = leadButton.querySelector(".app-button-label");

  function visibleLeads() {
    return [...crmRows.querySelectorAll("tr")]
      .filter((row) => row.cells.length >= 4 && !row.hidden && getComputedStyle(row).display !== "none")
      .map((row) => {
        if (!rowIds.has(row)) rowIds.set(row, `lead-${++rowSequence}`);
        const lead = {
          id: rowIds.get(row),
          name: (row.dataset.company || row.cells[0].textContent).trim().slice(0, 160),
          city: (row.dataset.city || row.cells[1].textContent).trim().slice(0, 160),
        };
        for (const [field, limit] of [["category", 160], ["website", 300], ["notes", 700]]) {
          const value = row.dataset[field]?.trim();
          if (value) lead[field] = value.slice(0, limit);
        }
        return lead;
      })
      .filter((lead) => lead.name);
  }

  function hasOffer() { return offer.value.trim().length > 0 && offer.value.length <= 2000; }

  function updateControls() {
    const leads = visibleLeads();
    const count = Math.min(leads.length, MAX_LEADS);
    offerButton.disabled = availability !== "ready" || tasks.offer.busy || !hasOffer();
    leadButton.disabled = availability !== "ready" || tasks.leads.busy || !hasOffer() || !count;
    if (offerLabel) offerLabel.textContent = tasks.offer.busy ? "Analisando oferta…" : "Sugerir nichos";
    if (leadLabel) leadLabel.textContent = tasks.leads.busy ? "Analisando leads…" : count ? `Analisar ${count} ${count === 1 ? "lead" : "leads"}` : "Analisar leads";
    leadCount.textContent = leads.length ? `${count} de ${leads.length} ${leads.length === 1 ? "lead visível será analisado" : "leads visíveis serão analisados"}. Até ${MAX_LEADS} por vez.` : "Salve leads no CRM para analisar a compatibilidade com sua oferta.";
    offerButton.setAttribute("aria-busy", String(tasks.offer.busy));
    leadButton.setAttribute("aria-busy", String(tasks.leads.busy));
  }

  function idleStatus() {
    const readiness = availability === "checking" ? "Verificando a disponibilidade da análise por IA…" : availability !== "ready" ? unavailableMessage : !hasOffer() ? "Descreva sua oferta para começar." : "Pronto para analisar sua oferta.";
    if (!tasks.offer.busy) offerStatus.textContent = readiness;
    if (!tasks.leads.busy) leadStatus.textContent = availability === "ready" && hasOffer() ? visibleLeads().length ? "A análise usa apenas os dados dos leads selecionados." : "Ainda não há leads visíveis para analisar." : readiness;
  }

  function cancel(taskName, clear = true) {
    const task = tasks[taskName];
    task.revision++;
    task.controller?.abort();
    task.controller = null;
    task.busy = false;
    if (clear) { task.results.replaceChildren(); task.results.hidden = true; }
  }

  async function request(body, controller, user = currentUser) {
    if (!user?.getIdToken) throw new Error("signed-out");
    const token = await user.getIdToken();
    if (controller.signal.aborted || user !== currentUser) throw new DOMException("Aborted", "AbortError");
    const timeout = window.setTimeout(() => controller.abort("timeout"), 30000);
    try {
      const response = await fetch(API_URL, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(messageFor(response.status));
        error.status = response.status;
        throw error;
      }
      return await response.json();
    } finally { window.clearTimeout(timeout); }
  }

  function list(items) {
    const node = element("ul", "ai-result-list");
    for (const item of items) node.append(element("li", "", item));
    return node;
  }

  function applyButton(name) {
    const button = element("button", "app-button ai-niche-choice");
    button.type = "button";
    button.setAttribute("aria-label", `Usar o nicho ${name}`);
    const icon = offerButton.querySelector("svg");
    if (icon) button.append(icon.cloneNode(true));
    button.append(element("span", "app-button-label", "Usar nicho"));
    button.addEventListener("click", () => {
      niche.value = name;
      niche.dispatchEvent(new Event("input", { bubbles: true }));
      offerPane.open = false;
      niche.focus();
    });
    return button;
  }

  function renderOffer(data) {
    const summary = text(data?.summary, 500);
    if (!Array.isArray(data?.niches) || !data.niches.length || data.niches.length > 5) throw new Error("invalid-response");
    const niches = data.niches.map((item) => ({ name: text(item?.name, 100), reason: text(item?.reason, 250) }));
    const criteria = strings(data.qualificationCriteria, 250, 5);
    const fragment = document.createDocumentFragment();
    fragment.append(element("p", "ai-result-summary", summary), element("h3", "ai-result-heading", "Nichos sugeridos"));
    const cards = element("div", "ai-result-cards");
    for (const item of niches) {
      const card = element("article", "ai-result-card");
      card.append(element("h4", "", item.name), element("p", "", item.reason), applyButton(item.name));
      cards.append(card);
    }
    fragment.append(cards, element("h3", "ai-result-heading", "Critérios para qualificar"), list(criteria));
    offerResults.replaceChildren(fragment);
    offerResults.hidden = false;
  }

  function renderLeads(data, leads) {
    if (!Array.isArray(data?.analyses) || data.analyses.length !== leads.length) throw new Error("invalid-response");
    const known = new Map(leads.map((lead) => [lead.id, lead]));
    const analyses = data.analyses.map((item) => {
      if (!known.has(item?.id) || !Number.isInteger(item?.score) || item.score < 0 || item.score > 100) throw new Error("invalid-response");
      const lead = known.get(item.id);
      known.delete(item.id);
      return { lead, score: item.score, reasons: strings(item.reasons, 250, 3), missingData: strings(item.missingData, 250, 3, true), nextStep: text(item.nextStep, 300) };
    });
    const fragment = document.createDocumentFragment();
    fragment.append(element("h3", "ai-result-heading", "Compatibilidade com sua oferta"));
    for (const item of analyses) {
      const card = element("article", "ai-result-card");
      const header = element("header", "ai-result-header");
      const company = element("div", "ai-result-company");
      company.append(element("h4", "", item.lead.name));
      if (item.lead.city) company.append(element("p", "", item.lead.city));
      const score = element("p", "ai-result-score");
      score.setAttribute("aria-label", `Compatibilidade: ${item.score} de 100`);
      score.append(element("strong", "", String(item.score)), element("span", "", "/100"));
      header.append(company, score);
      card.append(header, element("h5", "", "O que pesou na análise"), list(item.reasons));
      if (item.missingData.length) card.append(element("h5", "", "Dados que faltam"), list(item.missingData));
      card.append(element("h5", "", "Próximo passo"), element("p", "", item.nextStep));
      fragment.append(card);
    }
    leadResults.replaceChildren(fragment);
    leadResults.hidden = false;
  }

  async function analyze(taskName) {
    const task = tasks[taskName];
    if (availability !== "ready" || task.busy || !hasOffer()) return;
    const leads = taskName === "leads" ? visibleLeads().slice(0, MAX_LEADS) : [];
    if (taskName === "leads" && !leads.length) return;
    cancel(taskName);
    const revision = task.revision;
    const controller = new AbortController();
    task.controller = controller;
    task.busy = true;
    task.status.textContent = taskName === "offer" ? "Interpretando sua oferta e preparando sugestões…" : `Analisando ${leads.length} ${leads.length === 1 ? "lead" : "leads"} com os dados disponíveis…`;
    updateControls();
    try {
      const data = await request({ task: taskName, offer: offer.value.trim(), ...(taskName === "leads" ? { leads } : {}) }, controller);
      if (task.revision !== revision || controller.signal.aborted) return;
      if (taskName === "offer") renderOffer(data); else renderLeads(data, leads);
      task.status.textContent = taskName === "offer" ? "Sugestões prontas. Escolha o nicho que faz sentido para sua busca." : "Análise concluída. Revise os dados antes de priorizar o contato.";
    } catch (error) {
      if (task.revision !== revision) return;
      task.status.textContent = controller.signal.aborted ? controller.signal.reason === "timeout" ? messageFor(504) : "A análise foi interrompida. Você pode tentar novamente." : error.status ? messageFor(error.status) : "Não foi possível concluir a análise. Tente novamente.";
      if (error.status === 401 || error.status === 403) {
        availability = "unavailable";
        unavailableMessage = messageFor(error.status);
      }
    } finally {
      if (task.revision === revision) { task.busy = false; task.controller = null; updateControls(); }
    }
  }

  function changedOffer(source, destination) {
    destination.value = source.value;
    cancel("offer");
    cancel("leads");
    updateControls();
    idleStatus();
  }

  offer.addEventListener("input", () => changedOffer(offer, crmOffer));
  crmOffer.addEventListener("input", () => changedOffer(crmOffer, offer));
  offerButton.addEventListener("click", () => analyze("offer"));
  leadButton.addEventListener("click", () => analyze("leads"));
  new MutationObserver(() => {
    cancel("leads");
    updateControls();
    idleStatus();
  }).observe(crmRows, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["hidden", "data-status", "data-company", "data-city", "data-category", "data-website", "data-notes"] });

  updateControls();
  idleStatus();
  return {
    async setUser(user) {
      const revision = ++userRevision;
      connection?.abort();
      cancel("offer");
      cancel("leads");
      currentUser = user || null;
      availability = currentUser ? "checking" : "unavailable";
      unavailableMessage = "Entre na sua conta para usar a análise por IA.";
      updateControls();
      idleStatus();
      if (!currentUser) return;
      const controller = new AbortController();
      connection = controller;
      try {
        const data = await request(null, controller);
        if (revision !== userRevision || controller.signal.aborted) return;
        availability = data?.available === true ? "ready" : "unavailable";
        unavailableMessage = messageFor(503);
      } catch (error) {
        if (revision !== userRevision) return;
        availability = "unavailable";
        unavailableMessage = error.status ? messageFor(error.status) : messageFor(503);
      } finally {
        if (revision === userRevision) { connection = null; updateControls(); idleStatus(); }
      }
    },
  };
}
