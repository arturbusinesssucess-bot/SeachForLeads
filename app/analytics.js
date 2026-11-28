import { contactRingPath } from "./contact-ring.mjs";
import { classifyStage, decorateRowStage, getAnalyticsStages, getStageColor, isCustomStage, resolveRowStage } from "./pipeline.js?v=mobile-sync-20261126";

const unspecifiedCity = "Localização não informada";

export let crmStages = getAnalyticsStages();
export function classifyCRMStatus(value) { return classifyStage(value); }

export function readCRMRecords(tbody) {
  return [...tbody.querySelectorAll("tr")].filter((row) => row.cells.length >= 4).map((row) => {
    const stage = resolveRowStage(row);
    return {
      row,
      name: row.dataset.company || row.cells[0].textContent.trim(),
      city: row.dataset.city || row.cells[1].textContent.trim() || unspecifiedCity,
      stage,
      savedAt: row.dataset.savedAt,
      contacted: row.dataset.contacted === "true" || !!row.dataset.contactedAt || ["contacted", "responded", "won"].includes(stage),
    };
  });
}

export function summarizeCRM(records) {
  const counts = Object.fromEntries(crmStages.map((stage) => [stage.key, 0]));
  let contacted = 0;
  let customPending = 0;
  let customFollowing = 0;
  const cities = new Map();
  for (const record of records) {
    const stage = Object.hasOwn(counts, record.stage) ? record.stage : "other";
    counts[stage]++;
    if (record.contacted) contacted++;
    if (isCustomStage(stage)) {
      if (record.contacted) customFollowing++;
      else customPending++;
    }
    cities.set(record.city, (cities.get(record.city) || 0) + 1);
  }
  const total = records.length;
  return {
    total, counts, contacted,
    pending: counts.new + counts.qualified + customPending,
    following: counts.contacted + counts.responded + customFollowing,
    active: total - counts.won - counts.lost,
    contactRate: total ? contacted / total * 100 : null,
    winRate: counts.won + counts.lost ? counts.won / (counts.won + counts.lost) * 100 : null,
    cities: [...cities].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")),
  };
}

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element && element.textContent !== value) element.textContent = value;
}
function percent(value) { return value === null ? "—" : `${percentage.format(value)}%`; }


function stageDot(color) {
  const dot = document.createElement("span");
  dot.className = "stage-color-dot";
  dot.dataset.stageColor = color;
  dot.setAttribute("aria-hidden", "true");
  return dot;
}

function renderBars(container, values, total) {
  const fragment = document.createDocumentFragment();
  for (const item of values) {
    const row = document.createElement("div");
    row.className = "analytics-bar-row";
    const caption = document.createElement("div");
    caption.className = "analytics-bar-caption";
    const label = document.createElement("span"); label.textContent = item.label;
    if (item.color) {
      label.className = "analytics-stage-label";
      label.prepend(stageDot(item.color));
    }
    const value = document.createElement("strong"); value.textContent = number.format(item.value);
    caption.append(label, value);
    const track = document.createElement("div"); track.className = "analytics-bar-track";
    const fill = document.createElement("span");
    fill.style.width = `${total ? item.value / total * 100 : 0}%`;
    track.append(fill); row.append(caption, track); fragment.append(row);
  }
  container.replaceChildren(fragment);
}

export function initializeAnalytics(tbody) {
  const view = document.querySelector('[data-view="analytics"]');
  const stageFilter = document.querySelector("#analytics-stage");
  const cityFilter = document.querySelector("#analytics-city");
  if (!view || !stageFilter || !cityFilter) return null;
  const reset = document.querySelector("#analytics-reset");
  const filtersButton = document.querySelector("#analytics-filters-toggle");
  const filtersPanel = document.querySelector("#analytics-filters-panel");
  const filtersCount = document.querySelector("#analytics-filters-count");
  const stageChart = document.querySelector("#analytics-stage-chart");
  const stageBars = document.querySelector("#analytics-stage-bars");
  const funnelHost = document.querySelector("#analytics-funnel");
  const funnelNote = document.querySelector("#analytics-funnel-note");
  const activityHost = document.querySelector("#analytics-activity");
  const activityUndated = document.querySelector("#analytics-activity-undated");
  let funnelStages = [];
  let activity = [];
  let charts;
  let loadingCharts;
  let records = [];
  let citySignature = "";
  let stageSignature = "";
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const ring = document.querySelector("#analytics-contact-ring");
  const contactCard = ring.closest(".analytics-card");
  const animatedCards = [...view.querySelectorAll(".analytics-card")]
    .filter((card) => !card.contains(funnelHost));
  let contactRate = 0;
  let displayedRate = 0;
  let ringFrame;

  function drawContactRate(from = displayedRate) {
    cancelAnimationFrame(ringFrame);
    const target = contactRate;
    if (motionPreference.matches || !contactCard.hasAttribute("data-chart-entered")) {
      displayedRate = target;
      ring.setAttribute("d", contactRingPath(target));
      return;
    }
    let started;
    function frame(time) {
      started ??= time;
      const progress = Math.min((time - started) / 800, 1);
      displayedRate = from + (target - from) * (1 - (1 - progress) ** 3);
      ring.setAttribute("d", contactRingPath(displayedRate));
      if (progress < 1) ringFrame = requestAnimationFrame(frame);
    }
    ring.setAttribute("d", contactRingPath(from));
    ringFrame = requestAnimationFrame(frame);
  }

  const entranceObserver = new IntersectionObserver((entries) => {
    if (view.hidden || document.body.dataset.auth !== "ready") return;
    for (const { target, isIntersecting } of entries) {
      if (!isIntersecting || target.hasAttribute("data-chart-entered")) continue;
      target.setAttribute("data-chart-entered", "");
      if (target === contactCard) drawContactRate(0);
    }
  }, { threshold: 0.08 });

  function syncChartEntrance() {
    cancelAnimationFrame(ringFrame);
    for (const card of animatedCards) {
      entranceObserver.unobserve(card);
      card.removeAttribute("data-chart-entered");
      if (!view.hidden && document.body.dataset.auth === "ready") entranceObserver.observe(card);
    }
    updateCharts();
  }

  motionPreference.addEventListener("change", () => drawContactRate());
  new MutationObserver(syncChartEntrance).observe(document.body, { attributes: true, attributeFilter: ["data-auth"] });

  function updateCharts() {
    if (view.hidden || (!funnelHost && !activityHost)) return;
    if (charts) {
      if (funnelHost) {
        charts.renderAnalyticsFunnel(funnelHost, funnelStages);
        funnelHost.hidden = false;
        funnelNote.hidden = false;
        stageBars.hidden = true;
      }
      if (activityHost) charts.renderAnalyticsActivity(activityHost, activity);
    } else if (!loadingCharts) {
      loadingCharts = import("/public/analytics-funnel.v2.js?v=mobile-sync-20261126")
        .then((module) => {
          charts = module;
          updateCharts();
        })
        .catch(() => {
          const status = activityHost?.querySelector('[role="status"]');
          if (status) status.textContent = "Não foi possível carregar o mapa de calor.";
        })
        .finally(() => { loadingCharts = null; });
    }
  }

  function updateActivity(filtered) {
    if (!activityHost) return;
    activity = filtered.map(({ savedAt }) => Date.parse(savedAt)).filter(Number.isFinite);
    activityUndated.hidden = activity.length === filtered.length;
  }

  function renderFiltered() {
    const filtered = records.filter((record) => (stageFilter.value === "all" || stageFilter.value === record.stage) && (!cityFilter.value || cityFilter.value === record.city));
    const summary = summarizeCRM(filtered);
    setText("#analytics-total", number.format(summary.total));
    setText("#analytics-active", number.format(summary.active));
    setText("#analytics-contacted", number.format(summary.contacted));
    setText("#analytics-win-rate", percent(summary.winRate));
    setText("#analytics-pending", number.format(summary.pending));
    setText("#analytics-won", number.format(summary.counts.won));
    setText("#analytics-lost", number.format(summary.counts.lost));
    setText("#analytics-localities", number.format(summary.cities.filter(({ label }) => label !== unspecifiedCity).length));
    setText("#analytics-result-count", `${number.format(summary.total)} de ${number.format(records.length)} leads`);
    const activeFilters = Number(stageFilter.value !== "all") + Number(Boolean(cityFilter.value));
    reset.hidden = activeFilters === 0;
    filtersCount.hidden = activeFilters === 0;
    filtersCount.textContent = String(activeFilters);
    filtersButton.setAttribute("aria-label", activeFilters ? `Filtros, ${activeFilters} ${activeFilters === 1 ? "ativo" : "ativos"}` : "Filtros");
    funnelStages = crmStages.filter((stage) => stage.key !== "other" || summary.counts.other).map((stage) => ({ id: stage.key, label: stage.label, color: stage.color, value: summary.counts[stage.key] }));
    renderBars(stageBars, funnelStages, summary.total);
    const stageDescription = funnelStages.map((stage) => `${stage.label}: ${number.format(stage.value)}`).join("; ");
    stageChart.setAttribute("aria-label", summary.total ? `Leads por etapa. ${stageDescription}.` : "Leads por etapa. Ainda não há leads para os filtros selecionados.");
    if (funnelNote) funnelNote.textContent = summary.total
      ? "A porcentagem compara cada etapa à que tem mais leads no recorte."
      : "Prévia visual do funil. Nenhum lead neste recorte.";
    updateActivity(filtered);
    updateCharts();
    const nextContactRate = summary.contactRate ?? 0;
    if (nextContactRate !== contactRate) {
      contactRate = nextContactRate;
      drawContactRate();
    }
    document.querySelector("#analytics-contact-chart").setAttribute("aria-label", summary.total ? `${number.format(summary.contacted)} de ${number.format(summary.total)} leads em etapas de contato: ${percent(summary.contactRate)}.` : "Cobertura de contato. Ainda não há leads.");
    setText("#analytics-contact-rate", percent(summary.contactRate));
    setText("#analytics-contact-caption", summary.total ? `${number.format(summary.contacted)} em etapas de contato` : "Aguardando os primeiros leads");
    setText("#analytics-not-contacted", number.format(summary.total - summary.contacted));
    setText("#analytics-contact-yes", number.format(summary.contacted));
    renderBars(document.querySelector("#analytics-city-bars"), summary.cities.slice(0, 5), summary.total);
    const cityEmpty = document.querySelector("#analytics-city-empty");
    cityEmpty.hidden = summary.total > 0;
    setText("#analytics-city-description", summary.total ? `As ${Math.min(5, summary.cities.length)} localidades com mais leads no recorte selecionado.` : "As localidades aparecerão conforme você salvar leads.");
    const empty = document.querySelector("#analytics-empty");
    empty.hidden = records.length > 0;
    document.querySelector("#analytics-no-matches").hidden = !records.length || !!summary.total;
  }

  function refresh() {
    crmStages = getAnalyticsStages();
    for (const row of tbody.querySelectorAll("tr")) {
      const stage = decorateRowStage(row);
      const status = row.cells[3];
      if (status) status.dataset.stageColor = getStageColor(stage);
    }
    const nextStageSignature = JSON.stringify(crmStages);
    if (nextStageSignature !== stageSignature) {
      const previous = stageFilter.value;
      const options = document.createDocumentFragment();
      options.append(new Option("Todas as etapas", "all"));
      for (const stage of crmStages) options.append(new Option(stage.label, stage.key));
      stageFilter.replaceChildren(options);
      stageFilter.value = previous === "all" || crmStages.some((stage) => stage.key === previous) ? previous : "all";
      stageSignature = nextStageSignature;
    }
    records = readCRMRecords(tbody);
    const summary = summarizeCRM(records);
    setText("#home-lead-total", number.format(summary.total));
    setText("#home-new-total", number.format(summary.pending));
    setText("#home-following-total", number.format(summary.following));
    setText("#home-won-total", number.format(summary.counts.won));
    setText("#crm-metric-total", number.format(summary.total));
    setText("#crm-metric-pending", number.format(summary.pending));
    setText("#crm-metric-won", number.format(summary.counts.won));
    setText("#lead-count", number.format(summary.total));
    const navCount = document.querySelector("#lead-count"); if (navCount) navCount.hidden = !summary.total;
    const cities = [...new Set(records.map((record) => record.city))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const signature = JSON.stringify(cities);
    if (signature !== citySignature) {
      const previous = cityFilter.value;
      const options = document.createDocumentFragment(); options.append(new Option("Todas as localidades", ""));
      for (const city of cities) options.append(new Option(city, city));
      cityFilter.replaceChildren(options);
      cityFilter.value = cities.includes(previous) ? previous : "";
      citySignature = signature;
    }
    cityFilter.disabled = cities.length === 0;
    const recent = document.querySelector("#home-recent-leads");
    const recentEmpty = document.querySelector("#home-recent-empty");
    if (recent && recentEmpty) {
      recent.hidden = records.length === 0;
      recentEmpty.hidden = records.length > 0;
      const fragment = document.createDocumentFragment();
      for (const record of records.slice(0, 4)) {
        const item = document.createElement("div"); item.className = "recent-lead-item"; item.setAttribute("role", "listitem");
        const company = document.createElement("div");
        const name = document.createElement("strong"); name.textContent = record.name;
        const city = document.createElement("span"); city.textContent = record.city;
        company.append(name, city);
        const stageDefinition = crmStages.find((stage) => stage.key === record.stage);
        const stage = document.createElement("span");
        stage.className = "recent-lead-stage";
        stage.append(stageDot(stageDefinition.color), stageDefinition.label);
        item.append(company, stage); fragment.append(item);
      }
      recent.replaceChildren(fragment);
    }
    renderFiltered();
  }

  filtersButton.addEventListener("click", () => {
    if (filtersPanel.open) return;
    filtersPanel.showModal();
    filtersButton.setAttribute("aria-expanded", "true");
  });
  document.querySelector("#analytics-filters-done").addEventListener("click", () => filtersPanel.close());
  filtersPanel.addEventListener("close", () => filtersButton.setAttribute("aria-expanded", "false"));
  filtersPanel.addEventListener("click", (event) => {
    if (event.target !== filtersPanel) return;
    const bounds = filtersPanel.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) filtersPanel.close();
  });
  new MutationObserver(() => {
    if (view.hidden && filtersPanel.open) filtersPanel.close();
    syncChartEntrance();
  }).observe(view, { attributes: true, attributeFilter: ["hidden"] });
  window.addEventListener("sfl:pipeline-changed", refresh);
  stageFilter.addEventListener("change", renderFiltered);
  cityFilter.addEventListener("change", renderFiltered);
  reset.addEventListener("click", () => {
    stageFilter.value = "all"; cityFilter.value = "";
    stageFilter.dispatchEvent(new Event("change", { bubbles: true }));
    cityFilter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  refresh();
  syncChartEntrance();
  return { refresh };
}

