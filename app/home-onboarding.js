export function initializeHomeOnboarding(openView) {
  const panel = document.querySelector("#home-onboarding");
  const progressBar = panel.querySelector("#home-onboarding-progress");
  const counter = panel.querySelector("#home-onboarding-count");
  const steps = new Map([...panel.querySelectorAll("[data-onboarding-step]")].map((item) => {
    const button = item.querySelector("button");
    return [item.dataset.onboardingStep, { item, button, label: button.textContent.trim() }];
  }));
  let storageKey = "";
  let completed = new Set();

  function readProgress(raw) {
    try {
      const keys = JSON.parse(raw);
      return Array.isArray(keys) ? keys.filter((key) => steps.has(key)) : [];
    } catch {
      return [];
    }
  }

  function storedProgress() {
    try {
      return readProgress(localStorage.getItem(storageKey));
    } catch {
      return [];
    }
  }

  function render() {
    const count = completed.size;
    const text = `${count} de ${steps.size} concluídos`;
    const next = [...steps.keys()].find((key) => !completed.has(key));
    counter.textContent = text;
    progressBar.setAttribute("aria-valuemax", String(steps.size));
    progressBar.setAttribute("aria-valuenow", String(count));
    progressBar.setAttribute("aria-valuetext", text);
    progressBar.style.setProperty("--onboarding-progress", count / steps.size);
    for (const [key, { item, button, label }] of steps) {
      const done = completed.has(key);
      item.dataset.complete = String(done);
      if (key === next) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
      if (done) button.setAttribute("aria-label", `${label}, concluído`);
      else button.removeAttribute("aria-label");
    }
    panel.hidden = !storageKey || count === steps.size;
  }

  function complete(...keys) {
    if (!storageKey || keys.every((key) => completed.has(key))) return;
    const merged = new Set([...completed, ...storedProgress(), ...keys.filter((key) => steps.has(key))]);
    if (merged.size === completed.size) return;
    completed = merged;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...completed]));
    } catch {
      // Keep the checklist usable when browser storage is unavailable.
    }
    render();
  }

  for (const { button } of steps.values()) {
    button.addEventListener("click", () => openView(button.dataset.onboardingView));
  }
  window.addEventListener("storage", (event) => {
    if (storageKey && event.key === storageKey) complete(...readProgress(event.newValue));
  });

  return {
    complete,
    setUser(uid) {
      const key = uid ? `sfl:home-onboarding:v1:${uid}` : "";
      if (key === storageKey) return;
      storageKey = key;
      completed = new Set(key ? storedProgress() : []);
      render();
    },
  };
}
