import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const form = document.querySelector("#auth-form");
const title = document.querySelector("#auth-title");
const copy = document.querySelector("#auth-copy");
const submit = document.querySelector("#auth-submit");
const message = document.querySelector("#auth-message");
const tabs = [...document.querySelectorAll("[data-auth-mode]")];
const signupFields = [...document.querySelectorAll("[data-signup-only]")];
let mode = new URLSearchParams(window.location.search).get("mode") === "signup" ? "signup" : "login";
let auth = null;

function setMessage(text = "", type = "") {
  message.textContent = text;
  message.dataset.type = type;
}

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  tabs.forEach((tab) => {
    const active = tab.dataset.authMode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  signupFields.forEach((field) => {
    field.hidden = !signup;
    field.querySelector("input")?.toggleAttribute("required", signup);
  });
  title.textContent = signup ? "Crie seu acesso ao radar." : "Volte para o radar.";
  copy.textContent = signup ? "Comece seus 14 dias grátis e desbloqueie a análise completa." : "Entre para continuar sua busca de leads.";
  submit.innerHTML = `${signup ? "Criar conta" : "Entrar"} <span aria-hidden="true">↗</span>`;
  setMessage("");
}

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

tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.authMode)));
setMode(mode);

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "qualify.html";
  });
} else {
  setMessage("Configure o Firebase em firebase-config.js para ativar o acesso.", "error");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) {
    setMessage("Configure o Firebase antes de entrar ou criar uma conta.", "error");
    return;
  }
  const email = document.querySelector("#auth-email").value.trim();
  const password = document.querySelector("#auth-password").value;
  const name = document.querySelector("#auth-name").value.trim();
  const confirmation = document.querySelector("#auth-confirm").value;
  if (mode === "signup" && password !== confirmation) {
    setMessage("As senhas não conferem.", "error");
    return;
  }
  submit.disabled = true;
  setMessage("Verificando seu acesso…");
  try {
    if (mode === "signup") {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(result.user, { displayName: name });
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    setMessage("Acesso liberado. Abrindo seu radar…", "success");
    window.setTimeout(() => { window.location.href = "qualify.html"; }, 450);
  } catch (error) {
    setMessage(firebaseErrorMessage(error), "error");
  } finally {
    submit.disabled = false;
  }
});

