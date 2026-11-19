if ("serviceWorker" in navigator && window.isSecureContext) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js", { scope: "/app/" }).catch(() => {});
  }, { once: true });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";

import { initializeSettings } from "./settings.js?v=status-length";
import { setPipelineUser, resolveRowStage, getAnalyticsStages } from "./pipeline.js?v=status-length";

import { initializeAIWorkspace } from "./ai-workspace.js?v=lead-details";

import { initializeSearchCriteria } from "./search-criteria.js?v=crm-trial";
import { initializeSearchTrial } from "./search-trial.js?v=step-feedback";
import { initializeAppSelects } from "../public/app-selects.v1.js?v=crm-stage-counts";
import { initializeLeadDetails } from "./crm-lead-details.js";
import { initializeCRMViews } from "./crm-views.js?v=board-drag";
import { readCRMRecords, initializeAnalytics } from "./analytics.js?v=funnel-label-spacing";

import { initializeSidebar } from "../public/app-sidebar.v1.js";
initializeSidebar();
initializeAppSelects();

const authView = document.body;
const views = [...document.querySelectorAll("[data-view]")];
const viewLinks = [...document.querySelectorAll("[data-view-link]")];
const searchForm = document.querySelector("#lead-search-form");
const searchCriteria = initializeSearchCriteria(searchForm);
const viewNames = { home: "Home", search: "Busca", crm: "CRM", analytics: "Analytics", plans: "Planos", referrals: "Indique e ganhe", settings: "Configurações" };

function showView(name, updateUrl = true) {
  const view = viewNames[name] ? name : "home";
  if (view !== "crm") document.querySelector("#crm-lead-drawer")?.close();
  if (view !== "search" && searchScreen === "form" && searchFormReturn === "results") {
    showSearchScreen("results", false);
  }
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
const searchIntro = document.querySelector("#search-intro");
const searchEditor = document.querySelector("#search-editor");
const openSearchForm = document.querySelector("#open-search-form");
const closeSearchForm = document.querySelector("#close-search-form");
const searchScreens = {
  restoring: document.querySelector("#trial-search-restoring"),
  intro: searchIntro,
  form: searchEditor,
  loading: document.querySelector("#trial-search-loading"),
  results: document.querySelector("#trial-results"),
};
const searchFocusTargets = {
  intro: openSearchForm,
  form: document.querySelector("#search-niche"),
  loading: document.querySelector("#trial-search-loading-title"),
  results: document.querySelector("#search-title"),
};
let searchScreen = "restoring";
let searchFormReturn = "intro";
let dimensionalFieldLoad = null;
function ensureDimensionalField() {
  if (dimensionalFieldLoad || !searchEditor.querySelector(".search-dimensional-canvas")) return;
  dimensionalFieldLoad = import("../public/dimensional-field.v1.js")
    .then(({ mountDimensionalField }) => mountDimensionalField(searchEditor))
    .catch(() => { searchEditor.dataset.fieldState = "fallback"; });
}


function showSearchScreen(screen, restoreFocus = true) {
  searchScreen = screen;
  if (screen === "loading") searchFormReturn = "intro";
  for (const [key, panel] of Object.entries(searchScreens)) panel.hidden = key !== screen;
  openSearchForm.setAttribute("aria-expanded", String(screen === "form"));
  if (screen === "form") ensureDimensionalField();
  if (!restoreFocus || searchIntro.closest("[data-view]").hidden) return;
  window.scrollTo({ top: 0, behavior: "instant" });
  searchFocusTargets[screen]?.focus({ preventScroll: true });
}
function openSearchEditor() {
  searchFormReturn = searchScreen;
  showSearchScreen("form");
}
openSearchForm.addEventListener("click", openSearchEditor);
document.querySelector("#trial-new-search").addEventListener("click", openSearchEditor);
closeSearchForm.addEventListener("click", () => showSearchScreen(searchFormReturn));
showView(location.hash.slice(1) || "home", false);


const installCard = document.querySelector("#pwa-install-card");
const installButton = document.querySelector("#pwa-install-button");
const installDismiss = document.querySelector("#pwa-install-dismiss");
const installHelp = document.querySelector("#pwa-install-help");

if (installCard && installButton && installHelp) {
  const installKey = "sfl:pwa-installed";
  let deferredInstallPrompt = null;
  let installConfirmed = false;

  function hideInstallCard() {
    installConfirmed = true;
    deferredInstallPrompt = null;
    installCard.hidden = true;
  }

  function rememberInstall() {
    hideInstallCard();
    try { localStorage.setItem(installKey, "1"); } catch { /* Keep the card hidden for this session if storage is blocked. */ }
  }

  async function checkInstallation() {
    if (window.matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches || navigator.standalone === true) {
      rememberInstall();
      return;
    }
    try {
      if (localStorage.getItem(installKey) === "1") {
        hideInstallCard();
        return;
      }
    } catch { /* Installation detection can still work without storage. */ }
    try {
      const relatedApps = await navigator.getInstalledRelatedApps?.();
      if (relatedApps?.some(({ platform }) => platform === "webapp")) rememberInstall();
    } catch { /* Browsers can restrict installation detection. */ }
    if (!installConfirmed) installCard.hidden = false;
  }

  function showInstallHelp() {
    const isAppleMobile = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    installHelp.textContent = isAppleMobile
      ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início."
      : "No Chrome ou Edge, abra o menu do navegador e escolha Instalar SearchForLeads ou Adicionar à tela inicial.";
    installHelp.hidden = false;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    if (installConfirmed) return;
    deferredInstallPrompt = event;
    installHelp.hidden = true;
  });

  window.addEventListener("appinstalled", rememberInstall);
  window.addEventListener("storage", (event) => {
    if (event.key === installKey && event.newValue === "1") hideInstallCard();
  });

  installButton.addEventListener("click", async () => {
    if (installConfirmed) return;
    if (deferredInstallPrompt) {
      const prompt = deferredInstallPrompt;
      deferredInstallPrompt = null;
      installButton.disabled = true;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") installCard.hidden = true;
      } catch {
        if (!installConfirmed) showInstallHelp();
      } finally {
        installButton.disabled = false;
      }
      return;
    }

    showInstallHelp();
  });

  installDismiss?.addEventListener("click", () => {
    installCard.hidden = true;
  });
  checkInstallation();
}

const crmSearch = document.querySelector("#crm-lead-search");
const crmFilter = document.querySelector("#crm-filter");
const crmStage = document.querySelector("#crm-search-stage");
const crmRows = document.querySelector("#crm-rows");
let crmReady = false;
const leadDetails = initializeLeadDetails({
  analyze: (...args) => aiWorkspace.analyzeLead(...args),
  getOffer: () => document.querySelector("#ai-crm-offer").value,
});
const searchTrial = initializeSearchTrial({
  form: searchForm,
  criteria: searchCriteria,
  rows: crmRows,
  showSearchScreen,
  leadDetails,
  onCRMReady(ready) {
    if (crmReady === ready) return;
    crmReady = ready;
    renderCRM();
  },
});
const aiWorkspace = initializeAIWorkspace({ crmRows });
const settingsWorkspace = initializeSettings({
  getAuthInstance: () => auth,
  isStageInUse: (key) => [...crmRows.rows].some((row) => resolveRowStage(row) === key),
  onProfileUpdated(name) {
    document.querySelector("#account-name").textContent = name;
    const firstName = name.trim().split(/\s+/)[0].split(/[._-]/)[0] || "você";
    document.querySelector("#home-greeting-name").textContent = firstName.charAt(0).toLocaleUpperCase("pt-BR") + firstName.slice(1);
    document.querySelector("#account-avatar").textContent = Array.from(name)[0]?.toLocaleUpperCase("pt-BR") || "S";
  },
});
document.querySelector("#crm-configure-pipeline").addEventListener("click", () => {
  showView("settings");
  settingsWorkspace?.open("pipeline");
  document.querySelector("#settings-panel-pipeline").focus({ preventScroll: true });
});
const crmMetrics = document.querySelector("#crm-metrics");
const crmEmpty = document.querySelector("#crm-empty");
const crmNoResults = document.querySelector("#crm-no-results");
const crmWorkspace = document.querySelector("#crm-workspace");
const crmViews = initializeCRMViews({ openLead: searchTrial.openLead, moveLeadStage: searchTrial.moveLeadStage });
const crmAnalytics = initializeAnalytics(crmRows);

function syncCRMStageOptions(records) {
  const counts = new Map();
  for (const { stage } of records) counts.set(stage, (counts.get(stage) ?? 0) + 1);

  const stages = getAnalyticsStages()
    .filter(({ key }) => key !== "other" || counts.has(key))
    .map(({ key, label }) => ({ key, label, count: counts.get(key) ?? 0 }));
  const options = [{ key: "all", label: "Todos", count: records.length }, ...stages];
  const current = [...crmStage.options];

  if (current.length === options.length && options.every(({ key, label, count }, index) => (
    current[index].value === key && current[index].text === label && current[index].dataset.selectCount === String(count)
  ))) return;

  const selection = crmStage.value;
  crmStage.replaceChildren(...options.map(({ key, label, count }) => {
    const option = new Option(label, key);
    option.dataset.selectCount = String(count);
    return option;
  }));
  crmStage.value = options.some(({ key }) => key === selection) ? selection : "all";
}

function renderCRM() {
  crmAnalytics?.refresh();
  const query = crmFilter.value.trim().toLocaleLowerCase("pt-BR");
  const records = readCRMRecords(crmRows);
  syncCRMStageOptions(records);
  const stageFilter = crmStage.value;
  const visible = records.filter(({ row, stage }) => {
    const matchesText = !query || row.textContent.toLocaleLowerCase("pt-BR").includes(query)
      || row.dataset.category?.toLocaleLowerCase("pt-BR").includes(query);
    const matches = matchesText && (stageFilter === "all" || stage === stageFilter);
    row.hidden = !matches;
    return matches;
  });
  const hasLeads = records.length > 0;
  crmWorkspace.hidden = !crmReady || !hasLeads;
  crmSearch.hidden = crmWorkspace.hidden;
  crmMetrics.hidden = !crmReady;
  crmEmpty.hidden = !crmReady || hasLeads;
  crmNoResults.hidden = crmWorkspace.hidden || visible.length > 0;
  crmViews.render(crmReady ? visible : [], stageFilter);
}
crmFilter.addEventListener("input", renderCRM);
crmStage.addEventListener("change", renderCRM);
crmSearch.addEventListener("submit", (event) => {
  event.preventDefault();
  renderCRM();
});
window.addEventListener("sfl:pipeline-changed", renderCRM);
new MutationObserver(renderCRM).observe(crmRows, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["data-status", "data-contacted", "data-contacted-at", "data-city", "data-company", "data-saved-at"] });
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
      setPipelineUser(null);
      settingsWorkspace?.setUser(null);
      aiWorkspace?.setUser(null);
      searchTrial.setUser(null);
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
    setPipelineUser(user.uid);
    settingsWorkspace?.setUser(user);
    aiWorkspace?.setUser(user);
    searchTrial.setUser(user);
  });
} else {
  window.location.replace("/auth?mode=login");
}
