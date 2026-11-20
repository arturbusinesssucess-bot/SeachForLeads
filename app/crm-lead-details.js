import { dialLeadPhone, readLeadContact } from "../shared/lead-contact.mjs?v=crm-lead-drawer";
import { animateDisclosure } from "./ai-workspace.js?v=crm-lead-drawer";

const savedDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" });
const ratingFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const amountFormat = new Intl.NumberFormat("pt-BR");
const contactStages = new Set(["contacted", "responded", "won"]);
const signalPaths = {
  check: "m4.5 12.75 6 6 9-13.5",
  missing: "M18 6 6 18M6 6l12 12",
  star: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z",
};

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

function signalItem([label, kind, visibleText]) {
  const ns = "http://www.w3.org/2000/svg";
  const icon = document.createElementNS(ns, "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", signalPaths[kind]);
  icon.append(path);
  const item = document.createElement("li");
  item.dataset.signalIcon = kind;
  const text = element("span", visibleText ?? label);
  if (visibleText !== undefined) {
    const context = element("span", "Avaliação ");
    context.className = "crm-signal-context";
    text.prepend(context);
  }
  item.append(icon, text);
  return item;
}

export function initializeLeadDetails({ analyze, getOffer }) {
  const actions = document.querySelector("#crm-contact-actions");
  const contactLinks = actions.querySelectorAll("[data-lead-action]");
  const signals = document.querySelector("#crm-lead-signals");
  const companyFields = document.querySelector("#crm-company-fields");
  const panel = document.querySelector("#crm-lead-ai");
  const setAnalysisOpen = animateDisclosure(panel);
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
    setAnalysisOpen(false, { immediate: true });
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
    const urls = {
      whatsapp: contact.whatsapp ? `https://wa.me/${contact.whatsapp.slice(1)}` : null,
      call: dial ? `tel:${dial}` : null,
      maps: contact.mapsUrl,
      instagram: contact.instagram,
      website: contact.website,
    };
    for (const link of contactLinks) {
      const href = urls[link.dataset.leadAction];
      if (href) {
        link.href = href;
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
    const websiteLabel = contact.website ? "Site próprio informado"
      : contact.websiteChecked ? "Site não encontrado na busca" : "Site não informado";
    const rating = contact.rating === undefined ? undefined : ratingFormat.format(contact.rating);
    const reviewSource = contact.mapsUrl || /google maps/i.test(contact.source ?? "") ? " no Google" : "";
    const reviews = contact.reviewCount === undefined ? "Avaliações no Google não informadas"
      : `${amountFormat.format(contact.reviewCount)} ${contact.reviewCount === 1 ? "avaliação" : "avaliações"}${reviewSource}`;
    evidence = [
      [websiteLabel, contact.website ? "check" : "missing"],
      [dial ? "Telefone informado" : "Telefone não informado", dial ? "check" : "missing"],
      [rating === undefined ? "Avaliação não informada" : `Avaliação ${rating}`, "star", rating],
      [reviews, "star"],
      [contact.instagram ? "Instagram informado" : "Instagram não informado", contact.instagram ? "check" : "missing"],
      [contact.address ? "Endereço comercial informado" : "Endereço comercial não informado", contact.address ? "check" : "missing"],
    ];
    signals.replaceChildren(...evidence.map(signalItem));

    companyFields.replaceChildren();
    const timestamp = Date.parse(lead.savedAt);
    addField(companyFields, "Categoria", lead.category || "Não informada");
    addField(companyFields, "Cidade/Estado", lead.location || "Não informada");
    addField(companyFields, "Endereço", contact.address ?? "Não informado", contact.address && urls.maps);
    addField(companyFields, "Telefone", contact.phone ?? "Não informado", urls.call);
    addField(companyFields, "Site", contact.website ? new URL(contact.website).hostname : "Não informado", contact.website);
    addField(companyFields, "Instagram", contact.instagram ? "Abrir perfil" : "Não informado", urls.instagram);
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
