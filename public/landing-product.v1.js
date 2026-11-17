const tour = document.querySelector("[data-product-tour]");

if (tour) {
  const tablist = tour.querySelector('[role="tablist"]');
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));

  function activate(index, focus) {
    tabs.forEach((tab, item) => {
      const active = item === index;
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
      panels[item].hidden = !active;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach((tab, index) => {
    const panel = panels[index];
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    panel.tabIndex = 0;
    tab.addEventListener("click", () => activate(index, false));
    tab.addEventListener("keydown", (event) => {
      const count = tabs.length;
      let destination;
      switch (event.key) {
        case "ArrowRight": destination = (index + 1) % count; break;
        case "ArrowLeft": destination = (index + count - 1) % count; break;
        case "Home": destination = 0; break;
        case "End": destination = count - 1; break;
        default: return;
      }
      event.preventDefault();
      activate(destination, true);
    });
  });

  activate(0, false);
  tablist.hidden = false;
}
