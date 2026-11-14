import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "../firebase-config.js";

const authView = document.body;
const views = [...document.querySelectorAll("[data-view]")];
const viewLinks = [...document.querySelectorAll("[data-view-link]")];
const breadcrumb = document.querySelector("#breadcrumb");
const status = document.querySelector("#search-status");
const searchForm = document.querySelector("#lead-search-form");
const viewNames = { home: "Home", search: "Busca", crm: "CRM" };

function showView(name, updateUrl = true) {
  const view = viewNames[name] ? name : "home";
  views.forEach((panel) => { panel.hidden = panel.dataset.view !== view; });
  viewLinks.forEach((link) => {
    if (link.dataset.viewLink === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  breadcrumb.textContent = viewNames[view];
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

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  status.textContent = "A fonte de prospecção ainda não está conectada. Quando estiver, os resultados desta busca poderão ser salvos no CRM.";
});

document.querySelectorAll(".crm-filter").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".crm-filter").forEach((filter) => filter.classList.toggle("is-active", filter === button));
  });
});
document.querySelector("#crm-filter").addEventListener("input", () => {
  document.querySelector("#crm-empty").hidden = Boolean(document.querySelector("#crm-filter").value.trim());
});

document.querySelector("#sign-out").addEventListener("click", async () => {
  if (!auth) return;
  try {
    await signOut(auth);
    window.location.replace("/auth?mode=login");
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
    document.querySelector("#account-email").textContent = user.email || "";
    document.querySelector("#account-avatar").textContent = Array.from(name)[0]?.toLocaleUpperCase("pt-BR") || "S";
    authView.dataset.auth = "ready";
  });
} else {
  window.location.replace("/auth?mode=login");
}

