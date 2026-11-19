import { dialLeadPhone, leadMapURL, readLeadContact } from "../shared/lead-contact.mjs";
import { getDefaultPipeline, getPipeline } from "./pipeline.js?v=status-length";

const limit = 10;
const trialLoadingMs = 10000;
const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const countFormat = new Intl.NumberFormat("pt-BR");
const cacheKey = (uid) => `sfl:search-trial:cache:v1:${uid}`;
const lastSearchKey = (uid) => `sfl:search-trial:last-result:v1:${uid}`;
const contactedStages = new Set(["contacted", "responded", "won"]);

function readSaved(key, fallback = []) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("invalid-trial-data");
  return readLeads(parsed);
}

function isLead(lead) {
  return lead && typeof lead.id === "string" && lead.id.trim()
    && [lead.company, lead.location, lead.category, lead.stage].every((field) => typeof field === "string");
}

function readLeads(value) {
  const unique = new Map();
  for (const lead of Array.isArray(value) ? value : []) {
    if (!isLead(lead) || unique.has(lead.id)) continue;
    unique.set(lead.id, lead);
    if (unique.size === limit) break;
  }
  return [...unique.values()];
}

function readLastSearch(uid) {
  try {
    const raw = localStorage.getItem(lastSearchKey(uid));
    if (!raw || raw.length > 50000) return null;
    const result = JSON.parse(raw);
    if (!result || !Array.isArray(result.leads) || result.leads.length > limit || typeof result.scope !== "string"
      || !result.scope.trim() || result.scope.length > 220 || !["trial", "live"].includes(result.mode)) return null;
    if (!result.leads.every(isLead)) return null;
    return { leads: readLeads(result.leads), scope: result.scope, mode: result.mode };
  } catch { return null; }
}

function csvCell(value) {
  const text = String(value);
  const safe = /^\s*[=+@-]|^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function foundLeadCount(count) {
  return count === 1 ? "1 lead encontrado" : `${countFormat.format(count)} leads encontrados`;
}

async function waitForTrialStep(startedAt, offset, signal) {
  const remaining = startedAt + offset - performance.now();
  if (remaining > 0 && !signal.aborted) {
    await new Promise((resolve) => {
      const finish = () => {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = window.setTimeout(finish, remaining);
      signal.addEventListener("abort", finish, { once: true });
    });
  }
  signal.throwIfAborted();
}

export function initializeSearchTrial({ form, criteria, rows, showSearchScreen, leadDetails, onCRMReady, onProgress = () => {} }) {
  const status = document.querySelector("#search-status");
  const searchSubmit = form.querySelector('button[type="submit"]');
  const notice = document.querySelector("#trial-search-notice");
  const loadingDescription = document.querySelector("#trial-search-loading-description");
  const loadingMode = document.querySelector("#trial-search-mode");
  const loadingProgress = document.querySelector("#trial-search-progress");
  const loadingPosition = document.querySelector("#trial-search-step-position");
  const loadingStatus = document.querySelector("#trial-search-step-status");
  const loadingSteps = [...document.querySelector("#trial-search-steps").children];
  const accessStatus = document.querySelector("#trial-search-access-status");
  const selectAll = document.querySelector("#trial-select-all");
  const saveSelected = document.querySelector("#trial-save-selected");
  const resultStatus = document.querySelector("#trial-results-status");
  const results = document.querySelector("#trial-result-list");
  const template = document.querySelector("#trial-result-template");
  const drawer = document.querySelector("#crm-lead-drawer");
  const drawerTitle = document.querySelector("#trial-stage-title");
  const editForm = document.querySelector("#trial-stage-form");
  const editSave = editForm.querySelector('[type="submit"]');
  const editStage = document.querySelector("#trial-stage");
  const editStatus = document.querySelector("#trial-stage-status");
  const crmStatus = document.querySelector("#trial-crm-status");
  const exportButton = document.querySelector("#export-leads");
  const exportHighlight = exportButton.querySelector(".crm-export-highlight");
  let uid = "";
  let trialUser;
  let trialMode = true;
  let pendingSearch;
  let savingResults = false;
  let syncClient;
  let stopWatching;
  let legacyLeads = [];
  let snapshotVersion = 0;
  let saved = [];
  let editingId = null;
  let returnFocus;
  let confirmedStage = "";
  let savingStage = false;
  let resultButtons = new Map();
  let revision = 0;

  function showSearchStep(index, demo, message) {
    const total = loadingSteps.length;
    const percent = Math.round(100 * (index + 1) / total);
    loadingMode.textContent = demo ? "Modo de teste" : "Busca em tempo real";
    loadingPosition.textContent = `Etapa ${index + 1} de ${total}`;
    loadingStatus.textContent = message;
    loadingSteps.forEach((step, position) => {
      step.dataset.state = position < index ? "completed" : position === index ? "active" : "pending";
      if (position === index) step.setAttribute("aria-current", "step");
      else step.removeAttribute("aria-current");
    });
    const indeterminate = !demo && index < total - 1;
    loadingProgress.toggleAttribute("data-indeterminate", indeterminate);
    loadingProgress.style.setProperty("--search-progress", percent / 100);
    if (indeterminate) loadingProgress.removeAttribute("aria-valuenow");
    else loadingProgress.setAttribute("aria-valuenow", String(percent));
  }

  function syncButtons() {
    searchSubmit.disabled = !trialUser;
    const savedIds = new Set(saved.map((lead) => lead.id));
    const availableChoices = [];
    for (const [id, { button, label, choice }] of resultButtons) {
      const stored = savedIds.has(id);
      const full = saved.length >= limit;
      button.disabled = stored || full || !trialUser || !syncClient || savingResults;
      choice.disabled = button.disabled;
      if (stored || full) choice.checked = false;
      if (!choice.disabled) availableChoices.push(choice);
      button.dataset.saved = String(stored);
      button.querySelector(".app-button-label").textContent = stored ? "Salvo" : full ? "Limite do teste" : "Salvar";
      button.setAttribute("aria-label", stored ? "Lead salvo no CRM" : full ? "Limite de 10 leads salvos atingido" : label);
    }
    const selected = availableChoices.filter((choice) => choice.checked).length;
    selectAll.disabled = !availableChoices.length;
    selectAll.checked = Boolean(selected) && selected === availableChoices.length;
    selectAll.indeterminate = selected > 0 && !selectAll.checked;
    saveSelected.disabled = selected === 0;
    syncStageControls();
    exportButton.disabled = saved.length === 0;
    exportButton.setAttribute("aria-disabled", String(exportButton.disabled));
  }

  function syncStageControls() {
    editStage.disabled = !syncClient || savingStage;
    editSave.disabled = editStage.disabled || !editStage.value || editStage.value === confirmedStage;
  }

  function closeEditor(restoreFocus = true) {
    const focusTarget = returnFocus;
    returnFocus = undefined;
    editingId = null;
    editStatus.textContent = "";
    leadDetails.clear();
    drawer.close();
    if (restoreFocus) focusTarget?.()?.focus();
  }

  function renderLeadDetails(lead, preserveDraft = false) {
    const draft = preserveDraft && editStage.value && editStage.value !== confirmedStage ? editStage.value : null;
    confirmedStage = lead.stage;
    drawerTitle.textContent = lead.company;
    leadDetails.render(lead);
    const stages = getPipeline();
    editStage.replaceChildren(new Option("Selecione uma etapa", ""), ...stages.map(({ label, key }) => new Option(label, key)));
    const selected = draft && stages.some(({ key }) => key === draft) ? draft : confirmedStage;
    editStage.value = stages.some(({ key }) => key === selected) ? selected : "";
    syncStageControls();
  }

  function openLead(id, findReturnFocus) {
    const lead = saved.find((item) => item.id === id);
    if (!lead) return;
    editingId = id;
    returnFocus = findReturnFocus;
    editStatus.textContent = "";
    renderLeadDetails(lead);
    if (!drawer.open) drawer.showModal();
    drawerTitle.focus();
  }

  function leadSource(lead) { return readLeadContact(lead).source ?? (lead.id.startsWith("vps:") ? "Busca" : "Busca de teste"); }

  function renderRows() {
    const items = document.createDocumentFragment();
    const stageLabels = new Map(getPipeline().map((stage) => [stage.key, stage.label]));
    for (const lead of saved) {
      const row = document.createElement("tr");
      row.dataset.leadId = lead.id;
      row.dataset.company = lead.company;
      row.dataset.city = lead.location;
      row.dataset.category = lead.category;
      const { website } = readLeadContact(lead);
      if (website) row.dataset.website = website;
      row.dataset.status = lead.stage;
      row.dataset.contacted = String(lead.contacted === true);
      if (typeof lead.savedAt === "string") row.dataset.savedAt = lead.savedAt;
      for (const value of [lead.company, lead.location, leadSource(lead), stageLabels.get(lead.stage) || "Outros"]) row.insertCell().textContent = value;
      items.append(row);
    }
    rows.replaceChildren(items);
    if (editingId) {
      const lead = saved.find(({ id }) => id === editingId);
      if (lead) renderLeadDetails(lead, true);
      else closeEditor(false);
    }
    syncButtons();
  }

  function markCRMProgress(leads) {
    if (leads.some(({ stage, contacted }) => stage !== "new" || contacted === true)) onProgress("search", "save", "move");
    else if (leads.length) onProgress("search", "save");
  }

  function receiveLeads(next) {
    const ids = new Set(next.map(({ id }) => id));
    const archived = legacyLeads.filter((lead) => !ids.has(lead.id)).length;
    crmStatus.textContent = archived ? "O CRM atingiu 10 leads. Os leads excedentes continuam salvos neste navegador." : "";
    try {
      localStorage.setItem(cacheKey(uid), JSON.stringify(next));
    } catch { /* CRM stays usable when browser storage is unavailable. */ }
    if (JSON.stringify(saved) !== JSON.stringify(next)) {
      saved = next;
      renderRows();
    }
    onCRMReady(true);
    markCRMProgress(next);
  }

  async function updateSaved(action) {
    if (!syncClient || !uid) throw new Error("trial-not-authorized");
    const account = uid;
    const session = revision;
    const version = snapshotVersion;
    const state = await syncClient.updateWorkspace(account, ({ leads, pipeline }) => {
      const current = readLeads(leads);
      const next = action(current, pipeline);
      return next === current ? null : { leads: next };
    });
    if (session !== revision) return false;
    if (snapshotVersion === version) receiveLeads(readLeads(state.leads));
    return true;
  }

  async function moveLeadStage(id, stage, expectedStage) {
    const session = revision;
    const updated = await updateSaved((leads, pipeline) => {
      if (!(pipeline ?? getDefaultPipeline()).some(({ key }) => key === stage)) throw new Error("trial-stage-changed");
      const index = leads.findIndex((lead) => lead.id === id);
      if (index === -1) throw new Error("trial-lead-missing");
      const lead = leads[index];
      if (lead.stage === stage) return leads;
      if (lead.stage !== expectedStage) throw new Error("trial-stage-conflict");
      const updated = { ...lead, stage, contacted: lead.contacted === true || contactedStages.has(stage) };
      return leads.with(index, updated);
    });
    if (updated && session === revision && stage !== expectedStage) onProgress("search", "save", "move");
    return updated;
  }

  async function saveResults(batch) {
    if (!trialUser || !syncClient || savingResults || !batch.length) return;
    const session = revision;
    const activeResults = resultButtons;
    savingResults = true;
    syncButtons();
    let added = 0;
    try {
      const updated = await updateSaved((leads) => {
        const savedIds = new Set(leads.map(({ id }) => id));
        const missing = readLeads(batch).filter(({ id }) => !savedIds.has(id));
        added = missing.length;
        if (leads.length + added > limit) throw new Error("trial-limit");
        const savedAt = new Date().toISOString();
        return added ? [...missing.map((lead) => ({ ...lead, savedAt })), ...leads] : leads;
      });
      if (updated && activeResults === resultButtons) {
        const label = added === 1 ? "Lead salvo no CRM." : added ? `${added} leads salvos no CRM.` : "Esses leads já estão no CRM.";
        resultStatus.textContent = `${label} ${saved.length} de ${limit} leads ${trialMode ? "do teste " : ""}salvos.`;
      }
      if (updated && session === revision && added) onProgress("search", "save");
    } catch (error) {
      if (session === revision && activeResults === resultButtons) resultStatus.textContent = error.message === "trial-limit"
        ? "A seleção ultrapassa o limite de 10 leads no CRM. Selecione menos empresas."
        : "Não foi possível sincronizar os leads. Verifique sua conexão e tente novamente.";
    } finally {
      if (session === revision) {
        savingResults = false;
        syncButtons();
      }
    }
  }

  function setContactLink(link, href, unavailable) {
    if (href) {
      link.href = href;
      return;
    }
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("aria-label", `${link.textContent}: ${unavailable}`);
    link.title = unavailable;
  }

  function renderResults(batch, scope, mode, restoreFocus = true) {
    const items = document.createDocumentFragment();
    resultButtons = new Map();
    for (const [index, lead] of batch.entries()) {
      const item = template.content.cloneNode(true);
      item.firstElementChild.style.setProperty("--lead-enter-delay", `${index * 30}ms`);
      const contact = readLeadContact(lead);
      const dial = dialLeadPhone(contact.phone);
      item.querySelector("h3").textContent = lead.company;
      const category = item.querySelector("[data-result-category]");
      category.textContent = lead.category;
      category.hidden = !lead.category;
      item.querySelector("[data-result-location]").textContent = lead.location;
      const phone = item.querySelector("[data-result-phone]");
      phone.textContent = contact.phone ?? "";
      phone.hidden = !contact.phone;
      const rating = item.querySelector("[data-result-rating]");
      const score = contact.rating === undefined ? "" : `${ratingFormat.format(contact.rating)} / 5`;
      const reviews = contact.reviewCount === undefined ? "" : `${countFormat.format(contact.reviewCount)} ${contact.reviewCount === 1 ? "avaliação" : "avaliações"}`;
      rating.textContent = [score, reviews].filter(Boolean).join(" · ");
      rating.parentElement.hidden = !rating.textContent;
      setContactLink(item.querySelector("[data-result-whatsapp]"), dial ? `https://wa.me/${dial.slice(1)}` : null, "Telefone não informado");
      setContactLink(item.querySelector("[data-result-maps]"), leadMapURL(lead, contact), "Localização no Maps indisponível");
      const button = item.querySelector(".trial-result-save");
      const choice = item.querySelector('input[type="checkbox"]');
      const label = `Salvar ${lead.company} no CRM`;
      choice.setAttribute("aria-label", `Selecionar ${lead.company}`);
      choice.addEventListener("change", syncButtons);
      button.addEventListener("click", () => saveResults([lead]));
      resultButtons.set(lead.id, { button, choice, label, lead });
      items.append(item);
    }
    results.replaceChildren(items);
    document.querySelector("#trial-results-summary").textContent = mode === "trial" ? `${scope} · Resultados fictícios do teste` : scope;
    document.querySelector("#trial-result-count").textContent = foundLeadCount(batch.length);
    resultStatus.textContent = batch.length ? "" : "Nenhuma empresa encontrada neste recorte.";
    syncButtons();
    onProgress("search");
    showSearchScreen("results", restoreFocus);
  }

  selectAll.addEventListener("change", () => {
    for (const { choice } of resultButtons.values()) if (!choice.disabled) choice.checked = selectAll.checked;
    syncButtons();
  });
  saveSelected.addEventListener("click", () => {
    saveResults([...resultButtons.values()].filter(({ choice }) => choice.checked && !choice.disabled).map(({ lead }) => lead));
  });
  document.querySelector("#trial-cancel-search").addEventListener("click", () => {
    pendingSearch?.abort();
    pendingSearch = undefined;
    showSearchScreen("form");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!trialUser) return;
    if (pendingSearch) return;
    const input = criteria?.read();
    if (!input) return;
    try {
      localStorage.removeItem(lastSearchKey(uid));
    } catch { /* The current tab still replaces its results. */ }
    resultButtons = new Map();
    results.replaceChildren();
    resultStatus.textContent = "";
    syncButtons();
    const scope = `${input.niche} · ${input.cityName ? `${input.cityName}, ${input.state}` : input.stateName}`;
    const controller = new AbortController();
    pendingSearch = controller;
    status.textContent = "";
    loadingDescription.textContent = scope;
    const startedAt = performance.now();
    const demoExpected = trialMode;
    showSearchStep(0, demoExpected, "Preparando os filtros de segmento e localização…");
    showSearchScreen("loading");
    try {
      const token = await trialUser.getIdToken();
      if (pendingSearch !== controller) return;
      if (demoExpected) await waitForTrialStep(startedAt, 1100, controller.signal);
      showSearchStep(1, demoExpected, demoExpected
        ? "Buscando empresas de demonstração para o perfil escolhido…"
        : "Consultando a fonte de empresas com os filtros escolhidos…");
      const response = await fetch("/api/search-trial", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55000)]),
      });
      if (!response.ok) throw new Error("search-response");
      const { leads, mode } = await response.json();
      if (pendingSearch !== controller) return;
      if (!Array.isArray(leads) || leads.length > limit || !["trial", "live"].includes(mode)) throw new Error("search-results");
      const demo = mode === "trial";
      if (demo) await waitForTrialStep(startedAt, 3500, controller.signal);
      showSearchStep(2, demo, demo
        ? "Organizando os resultados de demonstração…"
        : "Organizando os resultados e dados de contato disponíveis…");
      const batch = readLeads(leads);
      if (demo) await waitForTrialStep(startedAt, 7000, controller.signal);
      showSearchStep(3, demo, foundLeadCount(batch.length));
      if (demo) await waitForTrialStep(startedAt, trialLoadingMs, controller.signal);
      try {
        localStorage.setItem(lastSearchKey(uid), JSON.stringify({ leads: batch, scope, mode }));
      } catch { /* The results remain available while this page is open. */ }
      renderResults(batch, scope, mode);
    } catch {
      if (pendingSearch !== controller) return;
      status.textContent = "Não foi possível concluir a busca. Verifique sua conexão e tente novamente.";
      showSearchScreen("form");
    } finally {
      if (pendingSearch === controller) pendingSearch = undefined;
    }
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editingId;
    const stage = editStage.value;
    if (!id || !syncClient || savingStage || stage === confirmedStage || !getPipeline().some((item) => item.key === stage)) return;
    const session = revision;
    savingStage = true;
    syncStageControls();
    editStatus.textContent = "";
    try {
      const updated = await moveLeadStage(id, stage, confirmedStage);
      if (updated && editingId === id) {
        editStatus.textContent = "Etapa atualizada.";
      }
    } catch (error) {
      if (session === revision && editingId === id) {
        editStatus.textContent = error.message === "trial-stage-changed"
          ? "Esta etapa mudou em outro dispositivo. Escolha uma opção do funil atual."
          : error.message === "trial-stage-conflict"
            ? "O lead mudou de etapa em outro dispositivo. Confira a nova etapa antes de salvar."
            : "Não foi possível sincronizar a etapa. Verifique sua conexão e tente novamente.";
      }
    } finally {
      if (session === revision) {
        savingStage = false;
        syncStageControls();
      }
    }
  });

  editStage.addEventListener("change", () => {
    editStatus.textContent = "";
    syncStageControls();
  });
  document.querySelector("#trial-stage-close").addEventListener("click", () => closeEditor());
  drawer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeEditor();
  });
  drawer.addEventListener("close", () => {
    if (!drawer.open && editingId) closeEditor();
  });
  drawer.addEventListener("click", (event) => {
    if (event.target !== drawer) return;
    const { left, right, top, bottom } = drawer.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) closeEditor();
  });
  exportButton.addEventListener("click", () => {
    if (!uid || !saved.length) return;
    const labels = new Map(getPipeline().map((stage) => [stage.key, stage.label]));
    const records = [["Empresa", "Localização", "Origem", "Etapa"], ...saved.map((lead) => [lead.company, lead.location, leadSource(lead), labels.get(lead.stage) || "Outros"])];
    const csv = records.map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = saved.some((lead) => lead.id.startsWith("vps:")) ? "leads.csv" : "leads-de-teste.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    const [animation] = exportHighlight.getAnimations();
    if (animation) {
      animation.currentTime = 0;
      animation.play();
    }
  });

  window.addEventListener("sfl:pipeline-changed", () => {
    if (uid) renderRows();
  });

  async function checkSearchAccess(user, current) {
    const requestAccess = (token) => fetch("/api/search-trial", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    const unavailableMessage = "Não foi possível verificar o acesso à busca. Recarregue a página para tentar novamente.";
    let message = "";
    try {
      const token = await user.getIdToken();
      if (current !== revision) return;
      let response = await requestAccess(token);
      if (current !== revision) return;
      if (response.status === 401) {
        const refreshedToken = await user.getIdToken(true);
        if (current !== revision) return;
        response = await requestAccess(refreshedToken);
      }
      const access = response.ok ? await response.json() : null;
      if (current !== revision) return;
      if (access?.available === true) {
        trialUser = user;
        trialMode = access.mode !== "live";
      } else if (response.status === 401) {
        message = "Sua sessão expirou. Entre novamente para fazer novas buscas.";
      } else if (response.status === 403) {
        message = "A busca de teste ainda não está liberada para esta conta.";
      } else {
        message = unavailableMessage;
      }
    } catch {
      if (current !== revision) return;
      message = unavailableMessage;
    }
    status.textContent = "";
    accessStatus.textContent = message;
    accessStatus.hidden = !message;
    notice.hidden = !trialUser || !trialMode;
    syncButtons();
  }

  async function connectCRM(account, current) {
    const unavailable = () => {
      if (current !== revision) return;
      syncClient = undefined;
      syncButtons();
      crmStatus.textContent = saved.length
        ? "Não foi possível sincronizar o CRM. Exibindo os leads salvos neste navegador."
        : "Não foi possível sincronizar o CRM. Recarregue a página para tentar novamente.";
    };
    try {
      const sync = await import("./workspace-sync.js");
      if (current !== revision) return;
      const backup = legacyLeads;
      if (backup.length) {
        await sync.updateWorkspace(account, ({ leads }) => {
          const existing = readLeads(leads);
          const known = new Set(existing.map(({ id }) => id));
          const missing = backup.filter(({ id }) => !known.has(id)).slice(0, limit - existing.length);
          return missing.length ? { leads: [...existing, ...missing] } : null;
        });
      }
      if (current !== revision) return;
      stopWatching = sync.watchWorkspace(account, ({ leads }) => {
        if (current !== revision) return;
        snapshotVersion++;
        syncClient = sync;
        receiveLeads(readLeads(leads));
        syncButtons();
      }, unavailable);
    } catch {
      unavailable();
    }
  }

  return {
    openLead,
    moveLeadStage,
    async setUser(user) {
      const current = ++revision;
      stopWatching?.();
      stopWatching = undefined;
      uid = user?.uid ?? "";
      trialUser = undefined;
      pendingSearch?.abort();
      pendingSearch = undefined;
      savingResults = false;
      savingStage = false;
      syncClient = undefined;
      legacyLeads = [];
      saved = [];
      resultButtons = new Map();
      results.replaceChildren();
      resultStatus.textContent = "";
      status.textContent = user ? "Verificando acesso à busca…" : "";
      accessStatus.textContent = "";
      accessStatus.hidden = true;
      notice.hidden = true;
      closeEditor(false);
      if (!user) {
        renderRows();
        crmStatus.textContent = "";
        onCRMReady(false);
        showSearchScreen("intro", false);
        return;
      }

      const account = user.uid;
      try { legacyLeads = readSaved(`sfl:search-trial:v1:${account}`); } catch { legacyLeads = []; }
      try { saved = readSaved(cacheKey(account), legacyLeads); } catch { saved = legacyLeads; }
      crmStatus.textContent = saved.length ? "" : "Carregando leads…";
      renderRows();
      onCRMReady(saved.length > 0);
      markCRMProgress(saved);

      const lastSearch = readLastSearch(account);
      if (lastSearch) renderResults(lastSearch.leads, lastSearch.scope, lastSearch.mode, false);
      else showSearchScreen("intro", false);

      await Promise.all([checkSearchAccess(user, current), connectCRM(account, current)]);
    },
  };
}
