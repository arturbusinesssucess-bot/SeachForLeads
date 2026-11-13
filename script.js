const mascotStage = document.querySelector("#mascot-stage");

// Em telas touch, o mesmo gesto que substitui o hover revela a fala do mascote.
mascotStage?.addEventListener("click", () => mascotStage.classList.toggle("is-touched"));

const entranceBlocks = document.querySelectorAll(".animar");
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (entranceBlocks.length && "IntersectionObserver" in window && !reduceMotion) {
  document.documentElement.classList.add("motion-ready");

  const entranceObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("run");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -36px 0px" });

  entranceBlocks.forEach((block) => entranceObserver.observe(block));
}

