import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { LiquidGlassTabBar, type LiquidGlassTabItem } from "../components/ui/liquid-glass-tab-bar";

function NavIcon({ svg }: { svg: SVGElement }) {
  const copy = useCallback((host: HTMLSpanElement | null) => {
    if (host) host.replaceChildren(svg.cloneNode(true));
  }, [svg]);
  return <span ref={copy} aria-hidden="true" />;
}

interface MobileNavigationProps {
  host: HTMLElement;
  items: LiquidGlassTabItem[];
  pages: LiquidGlassTabItem[];
  logoutIcon: SVGElement;
  view: string;
  navigate: (view: string) => void;
  signOut: () => Promise<void>;
}

function MobileNavigation({ host, items, pages, logoutIcon, view, navigate, signOut }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLElement>(null);
  const value = items.some(item => item.id === view) ? view : "more";
  const focusTab = (id = "more") => host.querySelector<HTMLButtonElement>(`[data-glass-tab="${id}"]`)?.focus({ preventScroll: true });

  useEffect(() => { setOpen(false); }, [view]);
  useLayoutEffect(() => {
    if (open) panel.current?.querySelector<HTMLAnchorElement>("a")?.focus({ preventScroll: true });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: Event) => {
      if (!host.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        focusTab();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open, host]);

  const select = (id: string) => {
    if (id === "more") {
      setOpen(current => !current);
      setError("");
      return;
    }
    setOpen(false);
    focusTab(items.some(item => item.id === id) ? id : "more");
    navigate(id);
  };

  async function logout() {
    setSigningOut(true);
    setError("");
    try {
      await signOut();
    } catch {
      setError("Não foi possível sair. Tente novamente.");
    } finally {
      setSigningOut(false);
    }
  }

  return <>
    {open && <nav id="mobile-more-panel" className="mobile-more-panel" aria-label="Todas as abas" ref={panel}>
      {pages.map(item => <a key={item.id} href={`#${item.id}`} className="mobile-more-link"
        aria-current={item.id === view ? "page" : undefined}
        onClick={event => { event.preventDefault(); select(item.id); }}>
        <span className="mobile-more-icon">{item.icon}</span><span>{item.label}</span>
      </a>)}
      <button type="button" className="mobile-more-link" disabled={signingOut} onClick={logout}>
        <span className="mobile-more-icon"><NavIcon svg={logoutIcon} /></span>
        <span>{signingOut ? "Saindo…" : "Sair da conta"}</span>
      </button>
      {error && <p role="alert" className="mobile-more-error">{error}</p>}
    </nav>}
    <LiquidGlassTabBar items={items.map(item => item.id === "more" ? { ...item, expanded: open } : item)}
      value={open ? "more" : value} onChange={select} />
  </>;
}

export function mountMobileNavigation(host: HTMLElement, navigate: (view: string) => void, signOut: () => Promise<void>) {
  const pages = Array.from(document.querySelectorAll<HTMLAnchorElement>("#app-sidebar [data-view-link]"), source => {
    const svg = source.querySelector("svg");
    const label = source.getAttribute("aria-label");
    if (!svg || !label) throw new Error("Item de navegação incompleto.");
    return { id: source.dataset.viewLink!, label, icon: <NavIcon svg={svg} /> };
  });
  const moreIcon = document.querySelector<SVGElement>("#sidebar-menu-button svg");
  const logoutIcon = document.querySelector<SVGElement>("#sign-out svg");
  if (!moreIcon || !logoutIcon) throw new Error("Ícones de navegação incompletos.");
  const items: LiquidGlassTabItem[] = [
    ...pages.filter(item => ["home", "crm", "search", "analytics"].includes(item.id)),
    { id: "more", label: "Mais", icon: <NavIcon svg={moreIcon} />, controls: "mobile-more-panel" },
  ];
  const root = createRoot(host);
  return {
    setView(view: string) {
      root.render(<MobileNavigation host={host} items={items} pages={pages} logoutIcon={logoutIcon}
        view={view} navigate={navigate} signOut={signOut} />);
    },
    unmount() { root.unmount(); },
  };
}
