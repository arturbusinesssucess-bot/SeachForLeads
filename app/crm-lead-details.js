import { dialLeadPhone, leadMapURL, readLeadContact } from "../shared/lead-contact.mjs";

const savedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });
const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const amountFormat = new Intl.NumberFormat("pt-BR");
const contactStages = new Set(["contacted", "responded", "won"]);

function element(tag, text) {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function addField(list, label, value, href) {
  const row = document.createElement("div");
  const content = element("dd", href ? "" : value);
  if (href) {
    const link = element("a", value);
    link.href = href;
    if (!href.startsWith("tel:")) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }
    content.append(link);
  }
  row.append(element("dt", label), content);
  list.append(row);
}

export function initializeLeadDetails({ analyze, getOffer }) {
  const actions = document.querySelector("#crm-contact-actions");
  const signals = document.querySelector("#crm-lead-signals");
  const companyFields = document.querySelector("#crm-company-fields");
  const panel = document.querySelector("#crm-lead-ai");
  const form = document.querySelector("#crm-lead-ai-form");
  const offer = document.querySelector("#crm-lead-ai-offer");
  const submit = form.querySelector('[type="submit"]');
  const status = document.querySelector("#crm-lead-ai-status");
  const result = document.querySelector("#crm-lead-ai-result");
  let currentLead;
  let evidence = [];
  let pending;

  function clear() {
    pending?.abort();
    pending = undefined;
    currentLead = undefined;
    result.hidden = true;
    result.replaceChildren();
    status.textContent = "";
    panel.open = false;
    submit.disabled = false;
  }

  function render(lead) {
    if (currentLead?.id !== lead.id) {
      clear();
      if (!offer.value) offer.value = getOffer().trim();
    }
    currentLead = lead;
    const contact = readLeadContact(lead);
    const dial = dialLeadPhone(contact.phone);
    const map = leadMapURL(lead, contact);
    const urls = {
      whatsapp: dial ? `https://wa.me/${dial.slice(1)}` : null,
      call: dial ? `tel:${dial}` : null,
      maps: map,
      website: contact.website,
    };
    for (const link of actions.querySelectorAll("[data-lead-action]")) {
      const href = urls[link.dataset.leadAction];
      link.hidden = !href;
      if (href) link.href = href;
      else link.removeAttribute("href");
    }
    actions.hidden = !Object.values(urls).some(Boolean);
    actions.querySelector("[data-lead-whatsapp-phone]").textContent = contact.phone ?? "";

    evidence = [
      [contact.website ? "Site próprio informado" : contact.websiteChecked ? "Site não encontrado na busca" : "Site não informado", Boolean(contact.website)],
      [dial ? "Telefone informado" : "Telefone não informado", Boolean(dial)],
    ];
    if (contact.rating !== undefined) evidence.push([`Avaliação ${ratingFormat.format(contact.rating)} de 5`, true]);
    const reviewSource = contact.mapsUrl || /google maps/i.test(contact.source ?? "") ? " no Google" : "";
    if (contact.reviewCount !== undefined) evidence.push([
      `${amountFormat.format(contact.reviewCount)} ${contact.reviewCount === 1 ? "avaliação" : "avaliações"}${reviewSource}`,
      contact.reviewCount > 0,
    ]);
    signals.replaceChildren(...evidence.map(([label, present]) => {
      const item = element("li", label);
      item.dataset.present = String(present);
      return item;
    }));

    companyFields.replaceChildren();
    const timestamp = Date.parse(lead.savedAt);
    addField(companyFields, "Categoria", lead.category || "Não informada");
    addField(companyFields, "Cidade/Estado", lead.location || "Não informada");
    addField(companyFields, "Endereço", contact.address ?? "Não informado", contact.address && map);
    addField(companyFields, "Telefone", contact.phone ?? "Não informado", urls.call);
    addField(companyFields, "Site", contact.website ? new URL(contact.website).hostname : "Não informado", contact.website);
    addField(companyFields, "Fonte do lead", contact.source ?? (lead.id.startsWith("vps:") ? "Busca" : "Busca de teste"));
    addField(companyFields, "Salvo no CRM", Number.isFinite(timestamp) ? savedDate.format(timestamp) : "Data não registrada");
    addField(companyFields, "Contato", lead.contacted === true || contactStages.has(lead.stage) ? "Contato iniciado" : "Aguardando contato");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = offer.value.trim();
    if (!currentLead || pending || !value) return;
    const controller = new AbortController();
    pending = controller;
    submit.disabled = true;
    result.hidden = true;
    status.textContent = "Analisando o lead…";
    const contact = readLeadContact(currentLead);
    const lead = {
      id: "crm-lead",
      name: currentLead.company,
      city: currentLead.location,
      category: currentLead.category,
      ...(contact.website ? { website: contact.website } : {}),
      notes: evidence.map(([label]) => label).join(". "),
    };
    try {
      const analysis = await analyze(lead, value, controller);
      if (pending !== controller) return;
      const reasons = document.createElement("ul");
      reasons.append(...analysis.reasons.map((reason) => element("li", reason)));
      result.replaceChildren(element("strong", `Compatibilidade ${analysis.score}/100`), reasons);
      if (analysis.missingData.length) result.append(element("p", `Dados que faltam: ${analysis.missingData.join(" · ")}`));
      result.append(element("p", `Próximo passo: ${analysis.nextStep}`));
      result.hidden = false;
      status.textContent = "";
    } catch (error) {
      if (pending === controller) status.textContent = controller.signal.aborted
        ? "A análise demorou para responder. Tente novamente."
        : (error.message || "Não foi possível analisar o lead.");
    } finally {
      if (pending === controller) {
        pending = undefined;
        submit.disabled = false;
      }
    }
  });
  return { render, clear };
}
