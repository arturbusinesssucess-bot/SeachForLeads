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

// Magnetic hover effect for the hero's secondary CTA.
const magnetMedia = window.matchMedia("(hover: hover) and (pointer: fine)");
if (!reduceMotion && magnetMedia.matches) {
  document.querySelectorAll(".hero-more").forEach((button) => {
    const area = button.parentElement;
    const limit = 16;

    area.addEventListener("mousemove", (event) => {
      const rect = button.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const distance = Math.hypot(dx, dy);
      if (!distance) {
        button.style.transform = "";
        return;
      }

      const strength = Math.min(1, distance);
      const x = (dx / distance) * limit * strength;
      const y = (dy / distance) * limit * strength;
      button.style.transform = `translate(${x}px, ${y}px)`;
    });

    area.addEventListener("mouseleave", () => {
      button.style.transform = "";
    });
  });
}
