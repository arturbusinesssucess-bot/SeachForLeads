import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const mascotStage = document.querySelector("#mascot-stage");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalTitle = document.querySelector("#modal-title");
const modalCopy = document.querySelector("#modal-copy");
const modalForm = document.querySelector("#modal-form");
const authMessage = document.querySelector("#auth-message");
const authActions = document.querySelector("#auth-actions");
const submitButton = modalForm?.querySelector("button[type=submit]");
const submitLabel = submitButton?.querySelector(".cta-label");
const signupOnlyFields = [...document.querySelectorAll("[data-signup-only]")];
const authTabs = [...document.querySelectorAll("[data-auth-mode]")];

let authMode = "login";
let currentUser = null;
let auth = null;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    renderAuthActions(user);
  });
} else {
  setAuthMessage("O Firebase ainda não foi configurado. Preencha firebase-config.js para ativar o acesso.", "error");
}

function renderAuthActions(user) {
  if (!authActions) return;
  authActions.innerHTML = user
    ? `<span class="auth-user" title="${escapeHtml(user.email || "Conta")}">${escapeHtml(user.displayName || user.email || "Conta")}</span><button class="text-button" data-signout type="button">Sair</button>`
    : '<button class="text-button" data-open-modal="login" type="button">Entrar</button>';
  authActions.querySelector("[data-open-modal]")?.addEventListener("click", () => openModal("login"));
  authActions.querySelector("[data-signout]")?.addEventListener("click", async () => {
    if (auth) await signOut(auth);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>\'\"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function setAuthMessage(message = "", type = "") {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.dataset.type = type;
}

function setAuthMode(mode = "login") {
  authMode = mode;
  const signup = mode === "signup";
  authTabs.forEach((tab) => {
    const active = tab.dataset.authMode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  signupOnlyFields.forEach((field) => {
    field.hidden = !signup;
    field.querySelector("input")?.toggleAttribute("required", signup);
  });
  modalTitle.textContent = signup ? "Crie seu acesso ao radar." : "Volte para o radar.";
  modalCopy.textContent = signup ? "Comece seus 14 dias grátis e desbloqueie a análise completa." : "Entre para continuar sua busca de leads.";
  submitLabel.textContent = signup ? "Criar conta" : "Entrar";
  setAuthMessage("");
}

function openModal(kind = "signup") {
  setAuthMode(kind);
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => document.querySelector(signupOnlyFields[0]?.hidden ? "#email" : "#display-name")?.focus(), 20);
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  modalForm?.reset();
  setAuthMode("login");
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.openModal));
});
authTabs.forEach((tab) => tab.addEventListener("click", () => setAuthMode(tab.dataset.authMode)));
document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
modalBackdrop?.addEventListener("click", (event) => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modalBackdrop && !modalBackdrop.hidden) closeModal(); });

document.querySelectorAll("[data-scroll-to-search]").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentUser) window.location.href = "qualify.html";
    else openModal("signup");
  });
});

modalForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) {
    setAuthMessage("Configure o Firebase antes de criar uma conta.", "error");
    return;
  }
  const email = document.querySelector("#email").value.trim();
  const password = document.querySelector("#password").value;
  const displayName = document.querySelector("#display-name").value.trim();
  const confirmation = document.querySelector("#password-confirm").value;
  if (authMode === "signup" && password !== confirmation) {
    setAuthMessage("As senhas não conferem.", "error");
    return;
  }
  submitButton.disabled = true;
  setAuthMessage("Verificando seu acesso…");
  try {
    if (authMode === "signup") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await updateProfile(result.user, { displayName });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    setAuthMessage("Acesso liberado. Abrindo seu radar…", "success");
    window.setTimeout(() => { closeModal(); window.location.href = "qualify.html"; }, 450);
  } catch (error) {
    setAuthMessage(firebaseErrorMessage(error), "error");
  } finally {
    submitButton.disabled = false;
  }
});

function firebaseErrorMessage(error) {
  const messages = {
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Tente entrar.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Confira o formato do e-mail.",
    "auth/weak-password": "Use uma senha com pelo menos 6 caracteres.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde um pouco e tente de novo.",
  };
  return messages[error?.code] || "Não foi possível concluir o acesso agora. Tente novamente.";
}

// Em telas touch, o mesmo gesto que substitui o hover revela a fala do mascote.
mascotStage?.addEventListener("click", () => mascotStage.classList.toggle("is-touched"));

