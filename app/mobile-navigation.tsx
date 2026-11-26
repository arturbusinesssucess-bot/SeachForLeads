import { useCallback } from "react";
import { createRoot } from "react-dom/client";
import { LiquidGlassTabBar, type LiquidGlassTabItem } from "../components/ui/liquid-glass-tab-bar";

function NavIcon({ svg }: { svg: SVGElement }) {
  const copy = useCallback((host: HTMLSpanElement | null) => {
    if (host) host.replaceChildren(svg.cloneNode(true));
  }, [svg]);
  return <span ref={copy} aria-hidden="true" />;
}

export function mountMobileNavigation(host: HTMLElement, navigate: (view: string) => void, openMenu: () => void) {
  const items: LiquidGlassTabItem[] = [];
  for (const id of ["home", "crm", "search", "analytics", "more"]) {
    const source = document.querySelector(id === "more" ? "#sidebar-menu-button" : `#app-sidebar [data-view-link="${id}"]`);
    const svg = source?.querySelector("svg");
    const label = id === "more" ? "Mais" : source?.getAttribute("aria-label");
    if (!svg || !label) throw new Error(`Item de navegação incompleto: ${id}`);
    const item: LiquidGlassTabItem = { id, label, icon: <NavIcon svg={svg} /> };
    if (id === "more") {
      item.controls = "app-sidebar";
      item.expanded = false;
    }
    items.push(item);
  }

  const root = createRoot(host);
  const select = (id: string) => id === "more" ? openMenu() : navigate(id);
  return {
    setView(view: string) {
      const value = items.some(item => item.id === view) ? view : "more";
      root.render(<LiquidGlassTabBar items={items} value={value} onChange={select} />);
    },
    unmount() { root.unmount(); },
  };
}
