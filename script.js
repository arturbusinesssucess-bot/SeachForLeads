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
const faqOpenTargets = new WeakMap();

function setFaqOpen(item, open) {
  const answer = item.querySelector(".faq-answer");
  if (!answer) return;

  const activeAnimation = faqAnimations.get(item);
  if (!activeAnimation && item.open === open) return;

  const currentHeight = item.open ? answer.getBoundingClientRect().height : 0;
  const currentOpacity = item.open ? Number.parseFloat(getComputedStyle(answer).opacity) || 0 : 0;
  activeAnimation?.cancel();
  faqOpenTargets.set(item, open);

  if (reduceMotion) {
    item.open = open;
    faqOpenTargets.delete(item);
    return;
  }

  if (open) item.open = true;
  const targetHeight = open ? answer.scrollHeight : 0;
  answer.style.height = `${currentHeight}px`;
  answer.style.opacity = String(currentOpacity);
  answer.style.overflow = "hidden";
  answer.getBoundingClientRect();

  const animation = answer.animate(
    [
      { height: `${currentHeight}px`, opacity: currentOpacity },
      { height: `${targetHeight}px`, opacity: open ? 1 : 0 },
    ],
    {
      duration: open ? 380 : 340,
      easing: open ? "cubic-bezier(.16, 1, .3, 1)" : "cubic-bezier(.4, 0, .2, 1)",
    },
  );
  faqAnimations.set(item, animation);
  animation.onfinish = () => {
    if (!open) item.open = false;
    answer.style.height = "";
    answer.style.opacity = "";
    answer.style.overflow = "";
    faqAnimations.delete(item);
    faqOpenTargets.delete(item);
  };
}

faqItems.forEach((item) => {
  item.querySelector("summary")?.addEventListener("click", (event) => {
    event.preventDefault();
    const currentlyOpening = faqOpenTargets.get(item) ?? item.open;
    const opening = !currentlyOpening;
    if (opening) faqItems.forEach((other) => {
      if (other !== item && (faqOpenTargets.get(other) ?? other.open)) setFaqOpen(other, false);
    });
    setFaqOpen(item, opening);
  });
});


// Keep the radar's ambient movement in view and stop it offscreen.
const radarVisual = document.querySelector(".radar-visual");
if (radarVisual && !reduceMotion) {
  import("https://cdn.jsdelivr.net/npm/motion@14.13.0/+esm")
    .then(({ animate, inView, stagger }) => {
      const sweep = radarVisual.querySelector(".radar-sweep");
      const signals = radarVisual.querySelectorAll(".radar-signal");
      const floatingCards = radarVisual.querySelectorAll(".radar-float");
      if (!sweep || !signals.length || !floatingCards.length) return;

      inView(radarVisual, () => {
        const sweepMotion = animate(sweep, { rotate: 360 }, {
          duration: 12,
          ease: "linear",
          repeat: Infinity,
        });
        const signalMotion = animate(signals, {
          scale: [0.78, 1.12, 0.78],
          opacity: [0.55, 1, 0.55],
        }, {
          duration: 2.7,
          delay: stagger(0.34),
          ease: "easeInOut",
          repeat: Infinity,
        });
        const cardMotion = animate(floatingCards, { y: [0, -5, 0] }, {
          duration: 4.2,
          delay: stagger(0.55),
          ease: "easeInOut",
          repeat: Infinity,
        });

        return () => {
          sweepMotion.stop();
          signalMotion.stop();
          cardMotion.stop();
        };
      }, { amount: 0.2 });
    })
    .catch(() => {
      // The landing remains complete if the animation module cannot load.
    });
}


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
