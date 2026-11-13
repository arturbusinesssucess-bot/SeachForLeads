const mascotStage = document.querySelector("#mascot-stage");

// Em telas touch, o mesmo gesto que substitui o hover revela a fala do mascote.
mascotStage?.addEventListener("click", () => mascotStage.classList.toggle("is-touched"));

