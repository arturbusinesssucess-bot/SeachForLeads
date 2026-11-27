// Liquid Glass Tab Bar, adapted from pedro21062014's 21st.dev component.
import React, { useCallback, useLayoutEffect, useRef } from "react";

export interface LiquidGlassTabItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel?: string;
  controls?: string;
  expanded?: boolean;
}

export interface LiquidGlassTabBarProps {
  items: LiquidGlassTabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}

function rubberBandClamp(value: number, min: number, max: number) {
  if (value < min) return min - 14 * (1 - Math.exp(-(min - value) / 42));
  if (value > max) return max + 14 * (1 - Math.exp(-(value - max) / 42));
  return value;
}

const padding = 5;
const tabCenter = (index: number, slot: number) => padding + (index + 0.5) * slot;

export function LiquidGlassTabBar({ items, value, onChange, className = "" }: LiquidGlassTabBarProps) {
  const bar = useRef<HTMLElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const blue = useRef<HTMLDivElement>(null);
  const frame = useRef<number | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const gesture = useRef<{ id: number; downX: number; downY: number; downTime: number; center: number; dragged: boolean } | null>(null);
  const ignorePointerClick = useRef(false);
  const quickTap = useRef(false);
  const spring = useRef({
    x: 0, vx: 0, targetX: 0, lift: 0, vLift: 0, targetLift: 0,
    width: 0, height: 0, slot: 0, reducedMotion: false,
  });
  const activeIndex = Math.max(0, items.findIndex(item => item.id === value));

  const paint = useCallback(() => {
    if (!lens.current || !blue.current || !base.current) return;
    const p = spring.current;
    const lift = Math.min(1.18, Math.max(0, p.lift));
    const opticalLift = Math.min(1, lift);
    const speed = Math.min(1, Math.abs(p.vx) / 1150) * opticalLift;
    const width = (p.slot + 10 * lift) * (1 + speed * 0.1);
    const restHeight = p.height - 8;
    const height = Math.max(restHeight, (restHeight + 8 * lift) * (1 - speed * 0.06));
    const left = p.x - width / 2;
    const top = (p.height - height) / 2;
    const right = left + width;
    const bottom = top + height;
    const radius = Math.min(width, height) / 2;

    const style = lens.current.style;
    style.opacity = "1";
    style.width = `${width}px`;
    style.height = `${height}px`;
    style.transform = `translate3d(${left}px, ${top}px, 0)`;
    style.setProperty("--rest-opacity", String(Math.max(0, 1 - opticalLift * 1.9)));
    style.setProperty("--shell-opacity", String(Math.min(1, opticalLift * 1.25)));

    const zoom = 1 + 0.06 * opticalLift;
    blue.current.style.width = `${p.width}px`;
    blue.current.style.height = `${p.height}px`;
    blue.current.style.transform = `translate3d(${width / 2 - p.x * zoom}px, ${height / 2 - p.height / 2 * zoom}px, 0) scale(${zoom})`;

    // Cut the lens silhouette out of the base icons so only their magnified copy shows.
    const arc = `A ${radius} ${radius} 0 0 1`;
    const cutout = `M ${left + radius} ${top} H ${right - radius} ${arc} ${right} ${top + radius}
      V ${bottom - radius} ${arc} ${right - radius} ${bottom} H ${left + radius}
      ${arc} ${left} ${bottom - radius} V ${top + radius} ${arc} ${left + radius} ${top} Z`;
    base.current.style.clipPath = `path(evenodd, "M 0 0 H ${p.width} V ${p.height} H 0 Z ${cutout.replace(/\s+/g, " ")}")`;
  }, []);

  const animate = useCallback(() => {
    const p = spring.current;
    function finish() {
      p.x = p.targetX;
      p.lift = p.reducedMotion ? 0 : p.targetLift;
      p.vx = p.vLift = 0;
      frame.current = null;
      paint();
    }
    if (p.reducedMotion) {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      finish();
      return;
    }
    if (frame.current !== null) return;
    let previous = performance.now();
    function step(now: number) {
      const dt = Math.min(0.032, Math.max(0.001, (now - previous) / 1000));
      previous = now;
      const dragging = gesture.current !== null;
      const rising = p.targetLift > p.lift;
      p.vx += ((p.targetX - p.x) * (dragging ? 540 : 280) - p.vx * (dragging ? 31 : 20.5)) * dt;
      p.x += p.vx * dt;
      p.vLift += ((p.targetLift - p.lift) * (rising ? 420 : 280) - p.vLift * (rising ? 23 : 22)) * dt;
      p.lift = Math.max(0, p.lift + p.vLift * dt);
      if (Math.abs(p.targetX - p.x) < 0.06 && Math.abs(p.vx) < 0.35 &&
          Math.abs(p.targetLift - p.lift) < 0.002 && Math.abs(p.vLift) < 0.015) {
        finish();
        return;
      }
      paint();
      frame.current = requestAnimationFrame(step);
    }
    frame.current = requestAnimationFrame(step);
  }, [paint]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      spring.current.reducedMotion = media.matches;
      if (spring.current.slot) animate();
    };
    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => {
      media.removeEventListener("change", syncPreference);
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
      window.clearTimeout(settleTimer.current);
    };
  }, [animate]);

  useLayoutEffect(() => {
    const element = bar.current;
    if (!element || !items.length) return;
    const sync = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width <= padding * 2 || !height) return;
      const p = spring.current;
      const resized = p.width !== width || p.height !== height;
      p.width = width;
      p.height = height;
      p.slot = (width - padding * 2) / items.length;
      if (resized && gesture.current) {
        gesture.current = null;
        ignorePointerClick.current = true;
        p.targetLift = p.lift = 0;
        p.vLift = 0;
      }
      if (gesture.current) return;
      p.targetX = tabCenter(activeIndex, p.slot);
      if (resized) {
        p.x = p.targetX;
        p.vx = 0;
        paint();
      } else {
        animate();
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeIndex, items.length, animate, paint]);

  function nearestIndex(x: number) {
    const index = Math.floor((x - padding) / spring.current.slot);
    return Math.max(0, Math.min(items.length - 1, index));
  }

  function activate(index: number, lift: boolean) {
    const p = spring.current;
    p.targetX = tabCenter(index, p.slot);
    p.targetLift = lift && !p.reducedMotion ? 1 : 0;
    window.clearTimeout(settleTimer.current);
    if (p.targetLift) {
      settleTimer.current = window.setTimeout(() => {
        p.targetLift = 0;
        animate();
      }, 210);
    }
    animate();
    onChange(items[index].id);
  }

  function pointerDown(event: React.PointerEvent<HTMLElement>) {
    const button = (event.target as Element).closest("button");
    if (!button || !event.isPrimary || event.button !== 0 || !spring.current.slot) return;
    const p = spring.current;
    const localX = event.clientX - event.currentTarget.getBoundingClientRect().left;
    const center = tabCenter(nearestIndex(localX), p.slot);
    button.setPointerCapture(event.pointerId);
    ignorePointerClick.current = false;
    gesture.current = { id: event.pointerId, downX: event.clientX, downY: event.clientY, downTime: performance.now(), center, dragged: false };
    window.clearTimeout(settleTimer.current);
    p.targetX = center;
    p.targetLift = 1;
    animate();
  }

  function pointerMove(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const delta = event.clientX - current.downX;
    const vertical = event.clientY - current.downY;
    if (!current.dragged) {
      if (Math.abs(vertical) > 10 && Math.abs(vertical) >= Math.abs(delta)) {
        pointerCancel(event);
        return;
      }
      if (Math.abs(delta) <= 12 || Math.abs(delta) <= Math.abs(vertical) * 1.35) return;
    }
    current.dragged = true;
    const p = spring.current;
    p.targetX = rubberBandClamp(current.center + delta, tabCenter(0, p.slot), tabCenter(items.length - 1, p.slot));
    animate();
  }

  function pointerUp(event: React.PointerEvent<HTMLElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    pointerMove(event);
    if (gesture.current !== current) return;
    gesture.current = null;
    quickTap.current = performance.now() - current.downTime < 240;
    const p = spring.current;
    p.targetLift = 0;
    if (current.dragged) {
      ignorePointerClick.current = true;
      const releaseX = event.clientX - event.currentTarget.getBoundingClientRect().left;
      activate(nearestIndex(releaseX), false);
    } else {
      animate();
    }
  }

  function pointerCancel(event: React.PointerEvent<HTMLElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    ignorePointerClick.current = true;
    const p = spring.current;
    p.targetX = tabCenter(activeIndex, p.slot);
    p.targetLift = 0;
    animate();
  }

  function focusNeighbor(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    switch (event.key) {
      case "ArrowRight": next = (index + 1) % items.length; break;
      case "ArrowLeft": next = (index - 1 + items.length) % items.length; break;
      case "Home": next = 0; break;
      case "End": next = items.length - 1; break;
      default: return;
    }
    event.preventDefault();
    bar.current?.querySelectorAll("button")[next]?.focus();
  }

  const icons = items.map(item => (
    <span className="liquid-glass-item" key={item.id}>
      <span className="liquid-glass-icon">{item.icon}</span>
      <span className="liquid-glass-label">{item.label}</span>
    </span>
  ));

  return (
    <nav aria-label="Navegação móvel" className={`liquid-glass-tab-bar ${className}`} ref={bar}
      style={{ "--tab-count": items.length } as React.CSSProperties}
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
      onPointerCancel={pointerCancel} onLostPointerCapture={pointerCancel}
      onContextMenu={event => { if (gesture.current) event.preventDefault(); }}>
      <div className="liquid-glass-track" aria-hidden="true" />
      <div className="liquid-glass-base liquid-glass-grid" ref={base} aria-hidden="true">{icons}</div>
      <div className="liquid-glass-lens" ref={lens} aria-hidden="true">
        <div className="liquid-glass-rest" />
        <div className="liquid-glass-blue liquid-glass-grid" ref={blue}>{icons}</div>
        <div className="liquid-glass-shell" />
      </div>
      <div className="liquid-glass-actions liquid-glass-grid">
        {items.map((item, index) => (
          <button key={item.id} type="button" aria-label={item.ariaLabel ?? item.label}
            data-glass-tab={item.id} aria-current={item.id === value ? "page" : undefined}
            aria-controls={item.controls} aria-expanded={item.expanded}
            onKeyDown={event => focusNeighbor(event, index)}
            onClick={event => {
              if (!event.detail || !ignorePointerClick.current) activate(index, !event.detail || quickTap.current);
              ignorePointerClick.current = false;
            }} />
        ))}
      </div>
    </nav>
  );
}

export default LiquidGlassTabBar;
