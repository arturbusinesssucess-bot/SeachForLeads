import { classifyStage, decorateRowStage, getAnalyticsStages, resolveRowStage } from "./pipeline.js?v=20261117";

export let crmStages = getAnalyticsStages();
export function classifyCRMStatus(value) { return classifyStage(value); }

export function readCRMRecords(tbody) {
  return [...tbody.querySelectorAll("tr")].filter((row) => row.cells.length >= 4).map((row) => ({
    row,
    name: row.dataset.company || row.cells[0].textContent.trim(),
    city: row.dataset.city || row.cells[1].textContent.trim() || "Localização não informada",
    stage: resolveRowStage(row),
    contacted: row.dataset.contacted === "true" || !!row.dataset.contactedAt || ["contacted", "responded", "won"].includes(resolveRowStage(row)),
  }));
}

export function summarizeCRM(records) {
  const counts = Object.fromEntries(crmStages.map((stage) => [stage.key, 0]));
  let contacted = 0;
  const cities = new Map();
  for (const record of records) {
    counts[record.stage]++;
    if (record.contacted) contacted++;
    cities.set(record.city, (cities.get(record.city) || 0) + 1);
  }
  const total = records.length;
  return {
    total, counts, contacted,
    pending: counts.new + counts.qualified,
    following: counts.contacted + counts.responded,
    active: total - counts.won - counts.lost,
    contactRate: total ? contacted / total * 100 : null,
    winRate: counts.won + counts.lost ? counts.won / (counts.won + counts.lost) * 100 : null,
    cities: [...cities].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR")),
  };
}

const number = new Intl.NumberFormat("pt-BR");
const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
function setText(selector, value) { const element = document.querySelector(selector); if (element) element.textContent = value; }
function percent(value) { return value === null ? "—" : `${percentage.format(value)}%`; }

function renderBars(container, values, total) {
  const fragment = document.createDocumentFragment();
  for (const item of values) {
    const row = document.createElement("div");
    row.className = "analytics-bar-row";
    const caption = document.createElement("div");
    caption.className = "analytics-bar-caption";
    const label = document.createElement("span"); label.textContent = item.label;
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
  let records = [];
  let citySignature = "";
  let stageSignature = "";

  function renderFiltered() {
    const filtered = records.filter((record) => (stageFilter.value === "all" || stageFilter.value === record.stage) && (!cityFilter.value || cityFilter.value === record.city));
    const summary = summarizeCRM(filtered);
    setText("#analytics-total", number.format(summary.total));
    setText("#analytics-active", number.format(summary.active));
    setText("#analytics-contacted", number.format(summary.contacted));
    setText("#analytics-win-rate", percent(summary.winRate));
    setText("#analytics-result-count", `${number.format(summary.total)} de ${number.format(records.length)} leads`);
    reset.hidden = stageFilter.value === "all" && !cityFilter.value;
    const stages = crmStages.filter((stage) => stage.key !== "other" || summary.counts.other).map((stage) => ({ label: stage.label, value: summary.counts[stage.key] }));
    renderBars(document.querySelector("#analytics-stage-bars"), stages, summary.total);
    const stageDescription = stages.map((stage) => `${stage.label}: ${number.format(stage.value)}`).join("; ");
    document.querySelector("#analytics-stage-chart").setAttribute("aria-label", summary.total ? `Leads por etapa. ${stageDescription}.` : "Leads por etapa. Ainda não há leads para os filtros selecionados.");
    const ring = document.querySelector("#analytics-contact-ring");
    const rate = summary.contactRate ?? 0;
    ring.style.strokeDasharray = `${rate} ${100 - rate}`;
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
    for (const row of tbody.querySelectorAll("tr")) decorateRowStage(row);
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
    setText("#crm-total", number.format(summary.total));
    setText("#crm-new", number.format(summary.counts.new));
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
        const stage = document.createElement("span"); stage.className = "recent-lead-stage"; stage.textContent = crmStages.find((stage) => stage.key === record.stage).label;
        item.append(company, stage); fragment.append(item);
      }
      recent.replaceChildren(fragment);
    }
    renderFiltered();
  }

  window.addEventListener("sfl:pipeline-changed", refresh);
  stageFilter.addEventListener("change", renderFiltered);
  cityFilter.addEventListener("change", renderFiltered);
  reset.addEventListener("click", () => {
    stageFilter.value = "all"; cityFilter.value = "";
    stageFilter.dispatchEvent(new Event("change", { bubbles: true }));
    cityFilter.dispatchEvent(new Event("change", { bubbles: true }));
  });
  refresh();
  return { refresh };
}
