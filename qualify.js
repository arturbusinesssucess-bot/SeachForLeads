import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const form = document.querySelector("#qualify-form");
const steps = [...document.querySelectorAll(".qualify-step")];
const previous = document.querySelector("#previous-step");
const next = document.querySelector("#next-step");
const stepNumber = document.querySelector("#step-number");
const progress = document.querySelector("#step-progress");
const success = document.querySelector("#qualify-success");
let currentStep = 0;

function showStep(index) {
  currentStep = index;
  steps.forEach((step, stepIndex) => { step.hidden = stepIndex !== currentStep; });
  stepNumber.textContent = String(currentStep + 1);
  progress.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  previous.hidden = currentStep === 0;
  next.innerHTML = currentStep === steps.length - 1 ? "Preparar meu radar <span aria-hidden=\"true\">↗</span>" : "Continuar <span aria-hidden=\"true\">↗</span>";
  steps[currentStep].querySelector("input, textarea, select")?.focus();
}

function currentStepIsValid() {
  const fields = steps[currentStep].querySelectorAll("input, textarea, select");
  for (const field of fields) {
    if (!field.checkValidity()) { field.reportValidity(); return false; }
  }
  return true;
}

function showAuthRequired() {
  form.hidden = true;
  success.hidden = false;
  success.innerHTML = `<div class="qualify-success-mark" aria-hidden="true">↗</div><h2>Entre para continuar.</h2><p>Faça login ou crie sua conta na landing para salvar seu perfil e liberar a análise de leads.</p><a class="qualify-button" href="index.html">Voltar para entrar <span aria-hidden="true">↗</span></a>`;
}

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  onAuthStateChanged(auth, (user) => {
    if (!user) showAuthRequired();
  });
}

next.addEventListener("click", () => {
  if (!currentStepIsValid()) return;
  if (currentStep === steps.length - 1) {
    form.hidden = true;
    success.hidden = false;
    return;
  }
  showStep(currentStep + 1);
});

previous.addEventListener("click", () => showStep(Math.max(0, currentStep - 1)));
form.addEventListener("submit", (event) => event.preventDefault());
showStep(0);

