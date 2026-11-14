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



// Keep the FAQ behavior to one open answer at a time.
const faqItems = [...document.querySelectorAll(".faq-item")];
faqItems.forEach((item) => item.addEventListener("toggle", () => {
  if (!item.open) return;
  faqItems.forEach((other) => { if (other !== item) other.open = false; });
}));
