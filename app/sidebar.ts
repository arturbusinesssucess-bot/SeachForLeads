const SIDEBAR_PREFERENCE = "searchforleads-sidebar-expanded";

export function initializeSidebar() {
  const sidebar = document.querySelector<HTMLElement>("#app-sidebar");
  const trigger = document.querySelector<HTMLButtonElement>("#sidebar-menu-button");
  const closeButton = document.querySelector<HTMLButtonElement>("#sidebar-close");
  const toggle = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
  const backdrop = document.querySelector<HTMLElement>("#sidebar-backdrop");
  const main = document.querySelector<HTMLElement>(".app-main");
  const mobileBar = document.querySelector<HTMLElement>(".sidebar-mobile-bar");
  const tabBar = document.querySelector<HTMLElement>("#mobile-tab-bar");
  if (!sidebar || !trigger || !closeButton || !toggle || !backdrop || !main || !mobileBar) return;

  const mobile = window.matchMedia("(max-width: 767px)");
  let desktopExpanded = true;
  let mobileOpen = false;

  try {
    desktopExpanded = localStorage.getItem(SIDEBAR_PREFERENCE) !== "false";
  } catch {
    // The menu remains usable when browser storage is disabled.
  }

  const renderDesktop = () => {
    const label = desktopExpanded ? "Recolher menu" : "Expandir menu";
    sidebar.dataset.expanded = String(desktopExpanded);
    toggle.setAttribute("aria-expanded", String(desktopExpanded));
    toggle.setAttribute("aria-label", label);
    toggle.title = label;
  };

  const setMobileOpen = (next: boolean, restoreFocus = false) => {
    const moreButton = tabBar?.querySelector<HTMLButtonElement>('button[aria-controls="app-sidebar"]');
    mobileOpen = mobile.matches && next;
    sidebar.dataset.mobileOpen = String(mobileOpen);
    sidebar.inert = mobile.matches && !mobileOpen;
    trigger.setAttribute("aria-expanded", String(mobileOpen));
    moreButton?.setAttribute("aria-expanded", String(mobileOpen));
    if (tabBar) tabBar.inert = mobileOpen;
    backdrop.hidden = !mobileOpen;
    main.inert = mobileOpen;
    mobileBar.inert = mobileOpen;

    if (mobileOpen) {
      sidebar.setAttribute("role", "dialog");
      sidebar.setAttribute("aria-modal", "true");
      closeButton.focus({ preventScroll: true });
    } else {
      sidebar.removeAttribute("role");
      sidebar.removeAttribute("aria-modal");
      if (restoreFocus) (moreButton ?? trigger).focus({ preventScroll: true });
    }
  };

  toggle.addEventListener("click", () => {
    desktopExpanded = !desktopExpanded;
    renderDesktop();
    try {
      localStorage.setItem(SIDEBAR_PREFERENCE, String(desktopExpanded));
    } catch {
      // Keep the preference for the current page.
    }
  });

  trigger.addEventListener("click", () => setMobileOpen(true));
  closeButton.addEventListener("click", () => setMobileOpen(false, true));
  backdrop.addEventListener("click", () => setMobileOpen(false, true));
  sidebar.addEventListener("click", event => {
    if (mobileOpen && event.target instanceof Element && event.target.closest("[data-view-link]")) {
      setMobileOpen(false, true);
    }
  });

  document.addEventListener("keydown", event => {
    if (!mobileOpen || event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setMobileOpen(false, true);
    }
    if (event.key !== "Tab") return;

    const items = Array.from(sidebar.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"))
      .filter(item => item.getClientRects().length > 0);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });

  mobile.addEventListener("change", () => {
    const fromSidebar = sidebar.contains(document.activeElement);
    const wasOpen = mobileOpen;
    setMobileOpen(false, mobile.matches && fromSidebar);
    if (!mobile.matches && (wasOpen || mobileBar.contains(document.activeElement) || tabBar?.contains(document.activeElement))) {
      toggle.focus({ preventScroll: true });
    }
  });

  renderDesktop();
  setMobileOpen(false);
  return { openMobileMenu: () => setMobileOpen(true) };
}
