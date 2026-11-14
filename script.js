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



// Animate FAQ answers on open and close, keeping only one answer open.
const faqItems = [...document.querySelectorAll(".faq-item")];
const faqAnimations = new WeakMap();

function setFaqOpen(item, open) {
  const answer = item.querySelector(".faq-answer");
  if (!answer || item.open === open) return;

  faqAnimations.get(item)?.cancel();

  if (reduceMotion) {
    item.open = open;
    return;
  }

  if (open) {
    item.open = true;
    answer.style.height = "auto";
    const fullHeight = answer.scrollHeight;
    answer.style.height = "0px";
    answer.style.opacity = "0";
    answer.style.overflow = "hidden";
    answer.getBoundingClientRect();

    const animation = answer.animate(
      [{ height: "0px", opacity: 0 }, { height: `${fullHeight}px`, opacity: 1 }],
      { duration: 380, easing: "cubic-bezier(.16, 1, .3, 1)" },
    );
    faqAnimations.set(item, animation);
    animation.onfinish = () => {
      answer.style.height = "";
      answer.style.opacity = "";
      answer.style.overflow = "";
      faqAnimations.delete(item);
    };
    return;
  }

  const currentHeight = answer.getBoundingClientRect().height;
  answer.style.height = `${currentHeight}px`;
  answer.style.overflow = "hidden";

  const animation = answer.animate(
    [{ height: `${currentHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
    { duration: 340, easing: "cubic-bezier(.4, 0, .2, 1)" },
  );
  faqAnimations.set(item, animation);
  animation.onfinish = () => {
    item.open = false;
    answer.style.height = "";
    answer.style.opacity = "";
    answer.style.overflow = "";
    faqAnimations.delete(item);
  };
}

faqItems.forEach((item) => {
  item.querySelector("summary")?.addEventListener("click", (event) => {
    event.preventDefault();
    const opening = !item.open;
    if (opening) faqItems.forEach((other) => {
      if (other !== item && other.open) setFaqOpen(other, false);
    });
    setFaqOpen(item, opening);
  });
});

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


// Show the privacy notice five seconds after landing entry.
const privacyNotice = document.querySelector("#privacy-notice");
const privacyNoticeDismiss = document.querySelector("#privacy-notice-dismiss");
const privacyNoticeKey = "sfl-privacy-notice-seen";
let privacyNoticeSeen = false;
try {
  privacyNoticeSeen = localStorage.getItem(privacyNoticeKey) === "1";
} catch {}

if (privacyNotice && privacyNoticeDismiss && !privacyNoticeSeen) {
  window.setTimeout(() => {
    privacyNotice.hidden = false;
    window.requestAnimationFrame(() => privacyNotice.classList.add("is-visible"));
  }, 5000);

  privacyNoticeDismiss.addEventListener("click", () => {
    privacyNotice.classList.remove("is-visible");
    try {
      localStorage.setItem(privacyNoticeKey, "1");
    } catch {}
    window.setTimeout(() => { privacyNotice.hidden = true; }, 330);
  });
}
