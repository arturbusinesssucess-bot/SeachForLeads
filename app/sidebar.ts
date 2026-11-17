import { animate } from "motion";

export function initializeSidebar() {
  const sidebar = document.querySelector<HTMLElement>("#app-sidebar");
  const trigger = document.querySelector<HTMLButtonElement>("#sidebar-menu-button");
  const closeButton = document.querySelector<HTMLButtonElement>("#sidebar-close");
  const toggle = document.querySelector<HTMLButtonElement>("#sidebar-toggle");
  const backdrop = document.querySelector<HTMLElement>("#sidebar-backdrop");
  const main = document.querySelector<HTMLElement>(".app-main");
  const mobileBar = document.querySelector<HTMLElement>(".sidebar-mobile-bar");
  if (!sidebar || !trigger || !closeButton || !toggle || !backdrop || !main || !mobileBar) return;
  const labels = Array.from(sidebar.querySelectorAll<HTMLElement>(".sidebar-label"));
  const mobile = window.matchMedia("(max-width: 767px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let open = false;
  let previousOverflow = "";
  let locked = false;
  const controls: Array<ReturnType<typeof animate>> = [];

  function stop() { controls.splice(0).forEach(control => control.stop()); }
  function lock(active: boolean) {
    main!.inert = active;
    mobileBar!.inert = active;
    if (active && !locked) { previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; }
    if (!active && locked) document.body.style.overflow = previousOverflow;
    locked = active;
  }
  function setOpen(next: boolean, restore = false, immediate = false) {
    stop();
    open = next;
    sidebar!.dataset.expanded = String(next);
    const duration = reduced.matches || immediate ? 0 : .28;
    if (mobile.matches) {
      trigger!.setAttribute("aria-expanded", String(next));
      toggle!.setAttribute("aria-expanded", "false");
      backdrop!.hidden = !next;
      sidebar!.inert = !next;
      lock(next);
      if (next) {
        sidebar!.style.visibility = "visible";
        sidebar!.setAttribute("role", "dialog");
        sidebar!.setAttribute("aria-modal", "true");
      } else {
        sidebar!.removeAttribute("role");
        sidebar!.removeAttribute("aria-modal");
      }
      controls.push(animate(sidebar!, { x: next ? "0%" : "-100%", opacity: next ? 1 : 0 }, {
        duration, ease: [.22, 1, .36, 1],
        onComplete: () => { if (!open && mobile.matches) sidebar!.style.visibility = "hidden"; }
      }));
      if (next) closeButton!.focus({ preventScroll: true });
      else if (restore) trigger!.focus({ preventScroll: true });
    } else {
      sidebar!.inert = false;
      sidebar!.style.visibility = "visible";
      toggle!.setAttribute("aria-expanded", String(next));
      toggle!.setAttribute("aria-label", next ? "Recolher menu" : "Expandir menu");
      controls.push(animate(sidebar!, { width: next ? 300 : 72 }, { duration, ease: [.22, 1, .36, 1] }));
    }
    for (const label of labels) controls.push(animate(label, { opacity: next ? 1 : 0, x: next ? 0 : -6 }, { duration: duration ? .18 : 0, ease: "easeOut" }));
  }
  function keyboardFocusInside() { return !!sidebar!.querySelector(":focus-visible"); }
  function resetLayout() {
    const hadSidebarFocus = sidebar!.contains(document.activeElement);
    stop();
    lock(false);
    backdrop!.hidden = true;
    sidebar!.removeAttribute("role");
    sidebar!.removeAttribute("aria-modal");
    sidebar!.style.width = "";
    sidebar!.style.transform = "";
    sidebar!.style.opacity = "";
    trigger!.setAttribute("aria-expanded", "false");
    setOpen(false, false, true);
    if (mobile.matches && hadSidebarFocus) trigger!.focus({ preventScroll: true });
  }
  trigger.addEventListener("click", () => setOpen(true));
  closeButton.addEventListener("click", () => setOpen(false, true));
  backdrop.addEventListener("click", () => setOpen(false, true));
  toggle.addEventListener("click", () => setOpen(!open));
  sidebar.addEventListener("pointerenter", event => { if (!mobile.matches && event.pointerType !== "touch") setOpen(true); });
  sidebar.addEventListener("pointerleave", () => { if (!mobile.matches && !keyboardFocusInside()) setOpen(false); });
  sidebar.addEventListener("focusin", event => { if (!mobile.matches && (event.target as HTMLElement).matches(":focus-visible")) setOpen(true); });
  sidebar.addEventListener("focusout", () => {
    window.requestAnimationFrame(() => { if (!mobile.matches && !sidebar!.contains(document.activeElement) && !sidebar!.matches(":hover")) setOpen(false); });
  });
  sidebar.addEventListener("click", event => {
    if (mobile.matches && (event.target as HTMLElement).closest("[data-view-link]")) setOpen(false, true);
  });
  document.addEventListener("keydown", event => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false, mobile.matches); return; }
    if (!mobile.matches || event.key !== "Tab") return;
    const focusable = Array.from(sidebar!.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex="0"]')).filter(node => node.getClientRects().length > 0);
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  mobile.addEventListener("change", resetLayout);
  reduced.addEventListener("change", () => setOpen(open, false, true));
  resetLayout();
}
