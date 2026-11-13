const mascotStage = document.querySelector("#mascot-stage");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modalTitle = document.querySelector("#modal-title");
const modalForm = document.querySelector("#modal-form");

function openModal(kind = "signup") {
  modalTitle.textContent = kind === "login" ? "Volte para o radar." : "Entre no radar.";
  modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  window.setTimeout(() => document.querySelector("#email")?.focus(), 20);
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.style.overflow = "";
}

document.querySelectorAll("[data-open-modal]").forEach((button) => {
  button.addEventListener("click", () => openModal(button.dataset.openModal));
});

document.querySelectorAll("[data-close-modal]").forEach((button) => {
  button.addEventListener("click", closeModal);
});

modalBackdrop.addEventListener("click", (event) => {
  if (event.target === modalBackdrop) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modalBackdrop.hidden) closeModal();
});

document.querySelectorAll("[data-scroll-to-search]").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.href = "qualify.html";
  });
});

modalForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const submitButton = modalForm.querySelector("button");
  submitButton.querySelector(".cta-label").textContent = "Acesso liberado";
  submitButton.style.setProperty("--cta-success", "#157b58");
  window.setTimeout(() => {
    closeModal();
    submitButton.querySelector(".cta-label").textContent = "Continuar";
    submitButton.style.removeProperty("--cta-success");
  }, 900);
});

// Em telas touch, o mesmo gesto que substitui o hover revela a fala do mascote.
mascotStage?.addEventListener("click", () => {
  mascotStage.classList.toggle("is-touched");
});

