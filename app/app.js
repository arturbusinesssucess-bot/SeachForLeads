if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/app/" }).catch(() => {});
  }, { once: true });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";

import { initializeSearchCriteria } from "./search-criteria.js?v=custom-selects-20261117";
import { initializeAppSelects } from "../public/app-selects.v1.js";
import { initializeAnalytics, classifyCRMStatus } from "./analytics.js?v=workspace-analytics-20261117";

import { initializeSidebar } from "../public/app-sidebar.v1.js";
initializeSidebar();
initializeAppSelects();

const authView = document.body;
const views = [...document.querySelectorAll("[data-view]")];
const viewLinks = [...document.querySelectorAll("[data-view-link]")];
const status = document.querySelector("#search-status");
const searchForm = document.querySelector("#lead-search-form");
const searchCriteria = initializeSearchCriteria(searchForm);
const viewNames = { home: "Home", search: "Busca", crm: "CRM", analytics: "Analytics" };

function showView(name, updateUrl = true) {
  const view = viewNames[name] ? name : "home";
  views.forEach((panel) => { panel.hidden = panel.dataset.view !== view; });
  viewLinks.forEach((link) => {
    if (link.dataset.viewLink === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  if (updateUrl && location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

viewLinks.forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  showView(link.dataset.viewLink);
}));
document.querySelectorAll("[data-open-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.dataset.openView));
});
window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
showView(location.hash.slice(1) || "home", false);

const searchIntro = document.querySelector("#search-intro");
const searchEditor = document.querySelector("#search-editor");
const openSearchForm = document.querySelector("#open-search-form");
const closeSearchForm = document.querySelector("#close-search-form");
let dimensionalFieldLoad = null;
function ensureDimensionalField() {
  if (dimensionalFieldLoad || !searchEditor.querySelector(".search-dimensional-canvas")) return;
  dimensionalFieldLoad = import("../public/dimensional-field.v1.js")
    .then(({ mountDimensionalField }) => mountDimensionalField(searchEditor))
    .catch(() => { searchEditor.dataset.fieldState = "fallback"; });
}


function setSearchEditor(open) {
  searchIntro.hidden = open;
  searchEditor.hidden = !open;
  if (open) ensureDimensionalField();
  openSearchForm.setAttribute("aria-expanded", String(open));
  window.requestAnimationFrame(() => {
    (open ? document.querySelector("#search-niche") : openSearchForm).focus();
  });
}
openSearchForm.addEventListener("click", () => setSearchEditor(true));
closeSearchForm.addEventListener("click", () => setSearchEditor(false));


const installCard = document.querySelector("#pwa-install-card");
const installButton = document.querySelector("#pwa-install-button");
const installDismiss = document.querySelector("#pwa-install-dismiss");
const installHelp = document.querySelector("#pwa-install-help");
let deferredInstallPrompt = null;

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
}

if (installCard && installButton && installHelp) {
  installCard.hidden = isAppInstalled();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installCard.hidden = false;
    installHelp.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installCard.hidden = true;
  });

  installButton.addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      installButton.disabled = true;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      installButton.disabled = false;
      if (choice.outcome === "accepted") installCard.hidden = true;
      return;
    }

    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    installHelp.textContent = isAppleMobile
      ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
      : "No Chrome ou Edge, abra o menu do navegador e escolha Instalar SearchForLeads ou Adicionar à tela inicial.";
    installHelp.hidden = false;
  });

  installDismiss?.addEventListener("click", () => {
    installCard.hidden = true;
  });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (searchCriteria) {
    const criteria = searchCriteria.read();
    if (!criteria) return;
    const locationLabel = criteria.cityName ? `${criteria.cityName}, ${criteria.state}` : criteria.stateName;
    status.textContent = `Busca configurada para ${criteria.quantity} leads em ${locationLabel}. A fonte de prospecção ainda não está conectada.`;
    return;
  }
  status.textContent = "A fonte de prospecção ainda não está conectada. Quando estiver, os resultados desta busca poderão ser salvos no CRM.";
});

document.querySelectorAll(".crm-filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".crm-filter").forEach((filter) => filter.classList.toggle("is-active", filter === button));
    renderCRM();
  });
});
const crmFilter = document.querySelector("#crm-filter");
const crmRows = document.querySelector("#crm-rows");
const crmEmpty = document.querySelector("#crm-empty");
const crmEmptyTitle = document.querySelector("#crm-empty-title");
const crmEmptyDescription = document.querySelector("#crm-empty-description");
const crmWorkspace = document.querySelector("#crm-workspace");
const crmTableWrap = document.querySelector("#crm-table-wrap");
const crmAnalytics = initializeAnalytics(crmRows);

function renderCRM() {
  crmAnalytics?.refresh();
  const query = crmFilter.value.trim().toLocaleLowerCase("pt-BR");
  const stageFilter = document.querySelector(".crm-filter.is-active")?.dataset.filter;
  const rows = [...crmRows.querySelectorAll("tr")];
  const visibleRows = rows.filter((row) => {
    const matchesText = !query || row.textContent.toLocaleLowerCase("pt-BR").includes(query);
    const matchesStage = stageFilter !== "new" || classifyCRMStatus(row.dataset.status || row.cells[3]?.textContent) === "new";
    const matches = matchesText && matchesStage;
    row.hidden = !matches;
    return matches;
  });
  if (crmWorkspace) crmWorkspace.hidden = rows.length === 0;
  if (crmTableWrap) crmTableWrap.hidden = visibleRows.length === 0;
  crmEmpty.hidden = visibleRows.length > 0;
  if (rows.length && !visibleRows.length) {
    crmEmptyTitle.textContent = "Nenhum lead corresponde à busca";
    crmEmptyDescription.textContent = "Tente outro nome, cidade ou etapa do CRM.";
  } else {
    crmEmptyTitle.textContent = "Seu CRM começa aqui.";
    crmEmptyDescription.textContent = "Encontre empresas na Busca e salve os contatos que quiser acompanhar por aqui.";
  }
}
crmFilter.addEventListener("input", renderCRM);
new MutationObserver(renderCRM).observe(crmRows, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-status", "data-contacted", "data-contacted-at", "data-city", "data-company"] });
renderCRM();


document.querySelector("#sign-out").addEventListener("click", async () => {
  if (!auth) return;
  try {
    await signOut(auth);
    window.location.replace("/");
  } catch {
    const accountEmail = document.querySelector("#account-email");
    accountEmail.textContent = "Não foi possível sair. Tente novamente.";
  }
});

let auth = null;
if (isFirebaseConfigured) {
  auth = getAuth(initializeApp(firebaseConfig));
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.replace("/auth?mode=login");
      return;
    }
    const name = user.displayName?.trim() || user.email?.split("@")[0] || "Sua conta";
    document.querySelector("#account-name").textContent = name;
    const firstName = name.trim().split(/\s+/)[0].split(/[._-]/)[0] || "você";
    document.querySelector("#home-greeting-name").textContent = firstName.charAt(0).toLocaleUpperCase("pt-BR") + firstName.slice(1);
    document.querySelector("#account-email").textContent = user.email || "";
    document.querySelector("#account-avatar").textContent = Array.from(name)[0]?.toLocaleUpperCase("pt-BR") || "S";
    authView.dataset.auth = "ready";
  });
} else {
  window.location.replace("/auth?mode=login");
}

