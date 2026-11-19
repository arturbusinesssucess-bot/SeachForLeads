"use client";

import * as React from "react";

export interface ActivityDatum {
  /** Local calendar date, YYYY-MM-DD. Duplicate dates use the last value. */
  date: string;
  value: number;
}

export type ActivityHeatmapView = "calendar" | "weekdays" | "months";
export type ActivityHeatmapProps = React.ComponentProps<"div"> & {
  data: ActivityDatum[];
  /** Number of calendar days ending at endDate; no extra padded dates. */
  days?: number;
  /** Defaults to the browser's local date after mount. */
  endDate?: string | Date;
  /** Maximum square edge. At least 6px; spacing is responsive. */
  cellSize?: number;
  /** CSS color for the squares. Defaults to the theme primary, whether it is a full color (Tailwind v4) or bare HSL channels (Tailwind v3). */
  color?: string;
  unit?: string;
  formatValue?: (value: number) => string;
  showMonths?: boolean;
  showWeekdays?: boolean;
  showLegend?: boolean;
  view?: ActivityHeatmapView;
  defaultView?: ActivityHeatmapView;
  onViewChange?: (view: ActivityHeatmapView) => void;
  autoPlay?: boolean;
  startPaused?: boolean;
  /** Time between changes; at least 900ms so a transition can finish. */
  interval?: number;
};

type Cell = { date: string; value: number; day: number; week: number; month: string; label: string };
type Month = { key: string; label: string; cells: Cell[]; firstWeek: number };
type Tip = { cell: Cell; left: number; top: number; right: number; bottom: number };
const VIEWS: ActivityHeatmapView[] = ["calendar", "weekdays", "months"];
const VIEW_NAMES = { calendar: "Calendar", weekdays: "Weekdays", months: "Months" };
const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const LEVEL_MIX = [0, 28, 48, 72, 100];
const THEME_PRIMARY = "var(--color-primary, currentColor)";

// shadcn stores --primary either as a full color (Tailwind v4: oklch) or as bare HSL channels
// (Tailwind v3: "0 0% 9%"); read the live value and build whichever form is a valid color.
function resolveThemeColor(node: HTMLElement, color: string | undefined) {
  const token = color === undefined ? "--primary" : /^hsl\(var\((--[\w-]+)\)\)$/.exec(color)?.[1];
  if (!token) return color ?? THEME_PRIMARY;
  const value = getComputedStyle(node).getPropertyValue(token).trim();
  if (value && CSS.supports("color", value)) return `var(${token})`;
  const channels = `hsl(${value})`;
  return value && CSS.supports("color", channels) ? channels : color ?? THEME_PRIMARY;
}
const PLOT_HEIGHT = 256;
const LEFT = 58;
const BASELINE = 230;
const DATE_LABEL = new Intl.DateTimeFormat("pt-BR", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
const SHORT_DATE = new Intl.DateTimeFormat("pt-BR", { month: "short", day: "numeric" });
const END_DATE = new Intl.DateTimeFormat("pt-BR", { month: "short", day: "numeric", year: "numeric" });
const MONTH_LABEL = new Intl.DateTimeFormat("pt-BR", { month: "short" });

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fromKey(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year = 0, month = 0, day = 0] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return toKey(date) === key ? date : null;
}

export function formatCompact(value: number) {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return String(value);
}

function buildDays(data: ActivityDatum[], days: number, endKey: string | null) {
  const end = endKey ? fromKey(endKey) : null;
  if (!end) return [] as Cell[];
  const count = Number.isFinite(days) ? Math.max(1, Math.floor(days)) : 365;
  const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - count + 1);
  const offset = start.getDay();
  const byDate = new Map(data.map((entry) => [entry.date, Number.isFinite(entry.value) ? Math.max(0, entry.value) : 0] as const));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = toKey(date);
    return { date: key, value: byDate.get(key) ?? 0, day: date.getDay(), week: Math.floor((index + offset) / 7), month: key.slice(0, 7), label: DATE_LABEL.format(date) };
  });
}

function daysLabel(days: number) {
  return `${days} ${days === 1 ? "dia" : "dias"}`;
}

function strongestFirst(a: Cell, b: Cell) {
  return b.value - a.value || a.date.localeCompare(b.date);
}

function arrange(cells: Cell[], width: number, maxCell: number) {
  const usable = Math.max(7, width - LEFT - 8);
  const totalWeeks = (cells.at(-1)?.week ?? 0) + 1;
  const capacity = Math.max(1, Math.floor((usable + 1) / 7));
  const firstWeek = Math.max(0, totalWeeks - capacity);
  const shown = cells.filter((cell) => cell.week >= firstWeek);
  const weeks = Math.max(1, totalWeeks - firstWeek);
  const weekdays = Array.from({ length: 7 }, () => [] as Cell[]);
  const months: Month[] = [];
  for (const cell of shown) {
    let month = months.find((entry) => entry.key === cell.month);
    if (!month) {
      month = { key: cell.month, label: MONTH_LABEL.format(fromKey(cell.date)!).replace(/\.$/, ""), cells: [], firstWeek: cell.week };
      months.push(month);
    }
    if (cell.value > 0) {
      weekdays[cell.day]!.push(cell);
      month.cells.push(cell);
    }
  }
  weekdays.forEach((group) => group.sort(strongestFirst));
  months.forEach((month) => month.cells.sort(strongestFirst));
  const weekdayRanks = new Map(weekdays.flatMap((group) => group.map((cell, rank) => [cell.date, rank] as const)));
  const monthRanks = new Map(months.flatMap((month, column) => month.cells.map((cell, rank) => [cell.date, { rank, column }] as const)));
  const maxMonth = Math.max(1, ...months.map((month) => month.cells.length));
  const maxWeekday = Math.max(1, ...weekdays.map((group) => group.length));
  const edge = Math.max(6, Math.min(maxCell, 16, usable / weeks - 1, (BASELINE - 24) / maxMonth - 0.5));
  const weekdayStep = Math.min(edge + 2, (usable - edge) / Math.max(1, maxWeekday - 1));
  const monthStep = Math.min(edge + 1, (BASELINE - 24) / maxMonth);
  const calendarStep = usable / weeks;
  const monthColumn = usable / Math.max(1, months.length);
  let total = 0;
  let active = 0;
  let longest = 0;
  let current = 0;
  for (const cell of shown) {
    total += cell.value;
    if (cell.value > 0) { active += 1; current += 1; longest = Math.max(longest, current); }
    else current = 0;
  }
  const bestWeekday = weekdays.findIndex((group) => group.length === maxWeekday);
  const bestMonth = months.findIndex((month) => month.cells.length === maxMonth);
  return { shown, weeks, firstWeek, weekdays, months, weekdayRanks, monthRanks, edge, weekdayStep, monthStep, calendarStep, monthColumn, total, active, longest, current, bestWeekday, bestMonth };
}

const EMPTY_LAYOUT = arrange([], 660, 10);
type Layout = typeof EMPTY_LAYOUT;

function position(cell: Cell, view: ActivityHeatmapView, layout: Layout) {
  const calendar = { x: LEFT + (cell.week - layout.firstWeek) * layout.calendarStep, y: 52 + cell.day * 24 };
  if (view === "calendar" || cell.value <= 0) return calendar;
  if (view === "weekdays") return { x: LEFT + (layout.weekdayRanks.get(cell.date) ?? 0) * layout.weekdayStep, y: calendar.y };
  const at = layout.monthRanks.get(cell.date)!;
  return { x: LEFT + (at.column + 0.5) * layout.monthColumn - layout.edge / 2, y: BASELINE - layout.edge - at.rank * layout.monthStep };
}

function ViewIcon({ view }: { view: ActivityHeatmapView }) {
  return <svg aria-hidden="true" className="activity-view-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
    {view === "calendar" ? <><rect x="2" y="3" width="12" height="11" rx="2" /><path d="M5 2v3m6-3v3M2 7h12M5 10h1m4 0h1" /></> : view === "weekdays" ? <path d="M2 4h12M2 8h8M2 12h10" /> : <path d="M4 14V7m4 7V2m4 12V5" />}
  </svg>;
}

export function ActivityHeatmap({
  data,
  days = 365,
  endDate,
  cellSize = 10,
  color,
  unit = "",
  formatValue = formatCompact,
  showMonths = true,
  showWeekdays = true,
  showLegend = true,
  view,
  defaultView = "calendar",
  onViewChange,
  autoPlay = false,
  startPaused = false,
  interval = 3200,
  ref,
  className = "",
  style,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onPointerDown,
  ...rest
}: ActivityHeatmapProps) {
  const [today, setToday] = React.useState(null as string | null);
  const [internalView, setInternalView] = React.useState(defaultView);
  const [width, setWidth] = React.useState(0);
  const [reduced, setReduced] = React.useState(true);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [stopped, setStopped] = React.useState(startPaused);
  const [hidden, setHidden] = React.useState(false);
  const [focusedDate, setFocusedDate] = React.useState("");
  const [tooltip, setTooltip] = React.useState(null as Tip | null);
  const [resolvedColor, setResolvedColor] = React.useState(color ?? THEME_PRIMARY);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const host = React.useRef(null as HTMLDivElement | null);
  const tipRef = React.useRef(null as HTMLDivElement | null);
  const plotRef = React.useRef(null as HTMLDivElement | null);
  const descriptionId = React.useId();
  const tooltipId = React.useId();
  const currentView = view ?? internalView;
  const endKey = endDate instanceof Date ? (Number.isNaN(endDate.getTime()) ? null : toKey(endDate)) : endDate ?? today;
  const cells = React.useMemo(() => buildDays(data, days, endKey), [data, days, endKey]);
  const maxCell = Number.isFinite(cellSize) ? Math.max(6, cellSize) : 10;
  const layout = React.useMemo(() => cells.length ? arrange(cells, width || 660, maxCell) : EMPTY_LAYOUT, [cells, width, maxCell]);
  const ready = width > 0 && !!endKey;
  const truncated = layout.shown.length < cells.length;
  const visibleCells = currentView === "calendar" ? layout.shown : layout.shown.filter((cell) => cell.value > 0);
  const tabDate = visibleCells.some((cell) => cell.date === focusedDate) ? focusedDate : visibleCells.at(-1)?.date;
  const maxValue = Math.max(1, ...layout.shown.map((cell) => cell.value));
  const bestDay = layout.weekdays[layout.bestWeekday];
  const bestMonth = layout.months[layout.bestMonth];
  const running = autoPlay && !reduced && !hovered && !focused && !stopped && !hidden && ready;
  const levelOf = (value: number) => value <= 0 ? 0 : Math.min(4, Math.ceil(value / maxValue * 4));
  const levelColor = (level: number) => level === 0 ? undefined : `color-mix(in srgb, var(--heatmap-color) ${LEVEL_MIX[level]}%, transparent)`;
  const valueLabel = (value: number) => {
    const label = unit === "leads" && value === 1 ? "lead" : unit;
    return `${formatValue(value)}${label ? ` ${label}` : ""}`;
  };

  React.useEffect(() => {
    setToday(toKey(new Date()));
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => {
      setHidden(document.hidden);
      if (!document.hidden) setToday(toKey(new Date()));
    };
    update(); visibility();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    return () => { media.removeEventListener("change", update); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  React.useEffect(() => {
    const node = host.current;
    if (!node) return;
    const plot = plotRef.current;
    if (!plot) return;
    const resize = () => { setWidth(plot.getBoundingClientRect().width); setTooltip(null); };
    const observer = new ResizeObserver(resize);
    observer.observe(plot);
    resize();
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const node = host.current;
    if (!node) return;
    const update = () => setResolvedColor(resolveThemeColor(node, color));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, [color]);

  React.useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && width) scroll.scrollLeft = currentView === "calendar" ? scroll.scrollWidth : 0;
  }, [currentView, width]);

  const changeView = React.useCallback((next: ActivityHeatmapView, manual = false) => {
    if (manual) setStopped(true);
    setTooltip(null);
    if (next === currentView) return;
    if (view === undefined) setInternalView(next);
    onViewChange?.(next);
  }, [currentView, view, onViewChange]);

  React.useEffect(() => {
    if (!running) return;
    const timer = window.setTimeout(() => changeView(VIEWS[(VIEWS.indexOf(currentView) + 1) % VIEWS.length]!), Number.isFinite(interval) ? Math.max(900, interval) : 3200);
    return () => window.clearTimeout(timer);
  }, [running, interval, currentView, changeView]);

  React.useEffect(() => {
    const clear = () => setTooltip(null);
    window.addEventListener("scroll", clear, true);
    return () => window.removeEventListener("scroll", clear, true);
  }, []);

  React.useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!tip || !tooltip) return;
    const bounds = tip.getBoundingClientRect();
    const left = (tooltip.left + tooltip.right - bounds.width) / 2;
    const top = tooltip.top - bounds.height - 8 >= 8 ? tooltip.top - bounds.height - 8 : tooltip.bottom + 8;
    tip.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, left))}px`;
    tip.style.top = `${Math.max(8, Math.min(innerHeight - bounds.height - 8, top))}px`;
  }, [tooltip]);

  const showTooltip = (cell: Cell, target: HTMLElement) => {
    const { left, top, right, bottom } = target.getBoundingClientRect();
    setTooltip({ cell, left, top, right, bottom });
  };
  const navigateDay = (event: React.KeyboardEvent, cell: Cell) => {
    if (event.key === "Escape") { setTooltip(null); return; }
    const directions = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] };
    const direction = directions[event.key as keyof typeof directions];
    if (!direction && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    setStopped(true);
    let next = event.key === "Home" ? visibleCells[0] : event.key === "End" ? visibleCells.at(-1) : undefined;
    if (direction) {
      const here = position(cell, currentView, layout);
      const candidates = visibleCells.map((candidate) => {
        const at = position(candidate, currentView, layout);
        const dx = at.x - here.x;
        const dy = at.y - here.y;
        const forward = dx * direction[0]! + dy * direction[1]!;
        const sideways = Math.abs(dx * direction[1]! - dy * direction[0]!);
        return { cell: candidate, forward, distance: forward + sideways * 20 };
      }).filter((candidate) => candidate.forward > 0.5).sort((a, b) => a.distance - b.distance);
      next = candidates[0]?.cell;
    }
    if (next) (plotRef.current?.querySelector(`[data-date="${next.date}"]`) as HTMLButtonElement | null)?.focus();
  };
  const first = layout.shown[0];
  const last = layout.shown.at(-1);
  const rangeLabel = first && last ? `${SHORT_DATE.format(fromKey(first.date)!)} – ${END_DATE.format(fromKey(last.date)!)}` : "Preparando calendário";
  const insight = !layout.active ? "Sem leads registrados neste período." : currentView === "weekdays" && bestDay ? `Mais dias ativos em ${WEEKDAYS[layout.bestWeekday]} (${daysLabel(bestDay.length)}).` : currentView === "months" && bestMonth ? `Mais dias ativos em ${bestMonth.label} (${daysLabel(bestMonth.cells.length)}).` : "Leads salvos por data";

  return (
    <div
      {...rest}
      ref={ref}
      data-slot="activity-heatmap"
      data-layout={currentView}
      data-ready={ready}
      data-autoplay={autoPlay}
      data-running={running}
      data-reduced={reduced}
      className={`activity-heatmap ${className}`}
      style={{ "--heatmap-color": resolvedColor, ...style } as React.CSSProperties}
      onMouseEnter={(event) => { if (window.matchMedia("(hover: hover)").matches) setHovered(true); onMouseEnter?.(event); }}
      onMouseLeave={(event) => {
        if (window.matchMedia("(hover: hover)").matches) {
          setHovered(false);
          setTooltip(null);
        }
        onMouseLeave?.(event);
      }}
      onFocus={(event) => { setFocused(!(event.target as Element).closest("[data-autoplay-toggle]")); onFocus?.(event); }}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false); onBlur?.(event); }}
      onPointerDown={(event) => { if (!(event.target as Element).closest("[data-autoplay-toggle]")) setStopped(true); onPointerDown?.(event); }}
    >
      <div ref={host} className="activity-content">
        <div className="activity-stats">
          {[{ key: "total", label: "Leads salvos", value: valueLabel(layout.total) }, { key: "active", label: "Dias ativos", value: String(layout.active) }, { key: "longest", label: "Maior sequência", value: daysLabel(layout.longest) }, { key: "current", label: "Sequência atual", value: daysLabel(layout.current) }].map((stat) => (
            <div key={stat.key} className="activity-stat">
              <p className="activity-muted">{stat.label}</p>
              <p data-stat={stat.key} className="activity-stat-value" title={stat.value}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="activity-toolbar">
          <div role="radiogroup" aria-label="Visualização do mapa de calor" className="activity-views" onKeyDown={(event) => {
            let next = -1;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (VIEWS.indexOf(currentView) + 1) % 3;
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (VIEWS.indexOf(currentView) + 2) % 3;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = 2;
            if (next < 0) return;
            event.preventDefault();
            changeView(VIEWS[next]!, true);
            (event.currentTarget.querySelector(`[data-view-option="${VIEWS[next]}"]`) as HTMLButtonElement | null)?.focus();
          }}>
            {VIEWS.map((option) => <button key={option} type="button" role="radio" data-view-option={option} aria-checked={currentView === option} tabIndex={currentView === option ? 0 : -1} onClick={() => changeView(option, true)} className={"activity-view-option"}><ViewIcon view={option} />{VIEW_NAMES[option]}</button>)}
          </div>
          {autoPlay && !reduced && <button type="button" data-autoplay-toggle aria-label={stopped ? "Ativar rotação automática" : "Pausar rotação automática"} className="activity-play" onClick={() => setStopped(!stopped)}><svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">{stopped ? <path d="m3 1 8 5-8 5Z" /> : <path d="M2 2h3v8H2zm5 0h3v8H7z" />}</svg></button>}
        </div>

        <div className="activity-context">
          <p data-insight className="activity-insight" aria-live="polite" aria-atomic="true">{insight}</p>
          <span aria-hidden="true" className="activity-context-key">Cada quadrado é um dia</span>
        </div>
        <p id={descriptionId} data-range-notice className={truncated ? "activity-muted" : "activity-sr-only"}>
          {truncated ? `Exibindo as últimas ${layout.weeks} semanas (${layout.shown.length} de ${cells.length} dias).` : `${rangeLabel}. Cada quadrado representa um dia.`} Use as setas do teclado para explorar as datas.
        </p>

        <div ref={scrollRef} className="activity-scroll">
          <div ref={plotRef} role="group" aria-label={`Atividade no CRM · ${VIEW_NAMES[currentView]}`} aria-describedby={descriptionId} aria-busy={!ready} data-plot className="activity-plot" style={{ height: PLOT_HEIGHT, visibility: ready ? "visible" : "hidden" }}>
            <div aria-hidden="true" className="activity-axis">
              {WEEKDAYS.map((day, index) => <div key={day} style={{ position: "absolute", left: 0, right: 0, top: 52 + index * 24, height: layout.edge, opacity: currentView === "months" ? 0 : 1, transition: reduced ? "none" : "opacity 180ms" }}>
                <div className="activity-axis-line" style={{ left: LEFT }} />
                {showWeekdays && <span data-weekday-label={index} data-count={layout.weekdays[index]!.length} data-peak={currentView === "weekdays" && index === layout.bestWeekday} className={"activity-weekday"}><span>{day}</span>{currentView === "weekdays" && <span className="activity-axis-count">{layout.weekdays[index]!.length}</span>}</span>}
              </div>)}
              {showMonths && layout.months.map((month, index) => {
                const isBar = currentView === "months";
                const x = isBar ? LEFT + (index + 0.5) * layout.monthColumn : LEFT + (month.firstWeek - layout.firstWeek) * layout.calendarStep;
                const countY = BASELINE - (month.cells.length ? layout.edge + (month.cells.length - 1) * layout.monthStep : 0) - 17;
                return <React.Fragment key={month.key}>
                  <span data-month-label={month.key} data-count={month.cells.length} data-peak={isBar && index === layout.bestMonth} className={"activity-month"} style={{ left: x, top: isBar ? BASELINE + 9 : 25, transform: isBar ? "translateX(-50%)" : undefined, opacity: currentView === "weekdays" || (!isBar && (layout.months[index + 1]?.firstWeek ?? Infinity) - month.firstWeek < 3) ? 0 : 1 }}>{month.label}</span>
                  {isBar && <span data-month-count={month.key} className={"activity-month activity-axis-count"} style={{ left: x, top: countY, transform: "translateX(-50%)" }}>{month.cells.length}</span>}
                </React.Fragment>;
              })}
            </div>
            {layout.shown.map((cell, index) => {
              const at = position(cell, currentView, layout);
              const visible = currentView === "calendar" || cell.value > 0;
              const level = levelOf(cell.value);
              return <button
                key={cell.date}
                type="button"
                data-date={cell.date}
                data-value={cell.value}
                data-day={cell.day}
                data-month={cell.month}
                data-level={level}
                aria-label={`${cell.label}: ${valueLabel(cell.value)}`}
                aria-describedby={tooltip?.cell.date === cell.date ? tooltipId : undefined}
                aria-hidden={!visible}
                disabled={!visible}
                tabIndex={visible && cell.date === tabDate ? 0 : -1}
                className="activity-cell"
                style={{ width: layout.edge, height: layout.edge, transform: `translate(${at.x}px, ${at.y}px)`, opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none", backgroundColor: levelColor(level), transitionProperty: "transform, opacity", transitionDuration: reduced ? "0ms" : "620ms", transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", transitionDelay: reduced ? "0ms" : `${index % 13 * 12}ms` }}
                onClick={(event) => showTooltip(cell, event.currentTarget)}
                onPointerEnter={(event) => { if (event.pointerType !== "touch") showTooltip(cell, event.currentTarget); }}
                onPointerLeave={(event) => { if (event.pointerType !== "touch") setTooltip(null); }}
                onFocus={(event) => { setFocusedDate(cell.date); showTooltip(cell, event.currentTarget); }}
                onBlur={() => setTooltip(null)}
                onKeyDown={(event) => navigateDay(event, cell)}
              />;
            })}
          </div>
        </div>

        <div className="activity-footer">
          <span>{rangeLabel}</span>
          {showLegend && <div data-legend className="activity-legend" aria-label="Intensidade da cor, da menor à maior atividade"><span>Menos</span>{LEVEL_MIX.map((_, level) => <span key={level} className="activity-swatch" style={{ backgroundColor: levelColor(level) }} />)}<span>Mais</span></div>}
        </div>
      </div>
      {tooltip && <div ref={tipRef} id={tooltipId} role="tooltip" className="activity-tooltip" style={{ left: 8, top: 8 }}>
        <p className="activity-muted">{tooltip.cell.label}</p>
        <p className="activity-tooltip-value">{valueLabel(tooltip.cell.value)}{tooltip.cell.value === 0 ? " · Sem atividade" : ""}</p>
      </div>}
    </div>
  );
}

export default ActivityHeatmap;
