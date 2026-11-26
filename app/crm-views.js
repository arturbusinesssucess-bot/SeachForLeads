import { getAnalyticsStages } from "./pipeline.js?v=mobile-sync-20261126";
import { initializeBoardDrag } from "./crm-board-drag.js";

const modeKey = "sfl:crm:view";

export function initializeCRMViews({ openLead, moveLeadStage }) {
  const host = document.querySelector("#crm-presentations");
  const list = document.querySelector("#crm-lead-list");
  const board = document.querySelector("#crm-lead-board");
  const status = document.querySelector("#crm-board-status");
  const moving = new Set();
  const template = document.querySelector("#crm-lead-card-template");
  const toggles = [...document.querySelectorAll("[data-crm-mode]")];
  let mode = "list";
  let records = [];
  let selectedStage = "all";
  let cardButtons = new Map();
  try {
    if (sessionStorage.getItem(modeKey) === "board") mode = "board";
  } catch { /* Use the default view when browser storage is unavailable. */ }

  const drag = initializeBoardDrag(board, async (button, column) => {
    const id = button.dataset.crmLeadId;
    if (!id || moving.has(id)) return;
    moving.add(id);
    button.setAttribute("aria-busy", "true");
    status.textContent = "Movendo lead…";
    try {
      const updated = await moveLeadStage(id, column.dataset.crmDropStage, button.dataset.crmSourceStage);
      if (updated) status.textContent = `Lead movido para ${column.dataset.crmStageLabel}.`;
    } catch (error) {
      status.textContent = error.message === "trial-stage-conflict"
        ? "O lead mudou de etapa em outro dispositivo. Confira a etapa atual."
        : error.message === "trial-stage-changed"
          ? "Essa etapa mudou em outro dispositivo. Confira o funil atualizado."
          : "Não foi possível mover o lead. Tente novamente.";
    } finally {
      moving.delete(id);
      cardButtons.get(id)?.removeAttribute("aria-busy");
    }
  });

  function focusTarget(id) {
    if (host.closest("[data-view]").hidden) return null;
    return cardButtons.get(id) ?? toggles.find((toggle) => toggle.dataset.crmMode === mode);
  }

  function card(record, stage) {
    const item = template.content.cloneNode(true);
    const button = item.querySelector("button");
    const id = record.row.dataset.leadId;
    button.disabled = !id;
    button.dataset.crmLeadId = id ?? "";
    if (mode === "board") button.dataset.crmSourceStage = record.row.dataset.status ?? record.stage;
    if (moving.has(id)) button.setAttribute("aria-busy", "true");
    item.querySelector("[data-crm-card-name]").textContent = record.name;
    item.querySelector("[data-crm-card-city]").textContent = record.city;
    const category = item.querySelector("[data-crm-card-category]");
    category.textContent = record.row.dataset.category ?? "";
    category.hidden = !category.textContent;
    item.querySelector("[data-crm-card-stage]").textContent = stage.label;
    item.querySelector(".stage-color-dot").dataset.stageColor = stage.color;
    button.setAttribute("aria-label", `Ver detalhes de ${record.name}`);
    button.addEventListener("click", () => openLead(id, () => focusTarget(id)));
    if (id) cardButtons.set(id, button);
    return item;
  }

  function render(next = records, stageFilter = selectedStage) {
    drag.cancel();
    records = next;
    selectedStage = stageFilter;
    const focusedLead = document.activeElement?.dataset.crmLeadId;
    cardButtons = new Map();
    host.hidden = records.length === 0;
    list.hidden = mode !== "list";
    board.hidden = mode !== "board";
    for (const toggle of toggles) toggle.setAttribute("aria-pressed", String(toggle.dataset.crmMode === mode));
    const stages = getAnalyticsStages();
    const stagesByKey = new Map(stages.map((stage) => [stage.key, stage]));
    const fallback = stagesByKey.get("other");
    const content = document.createDocumentFragment();
    if (mode === "list") {
      for (const record of records) content.append(card(record, stagesByKey.get(record.stage) ?? fallback));
      list.replaceChildren(content);
      board.replaceChildren();
    } else {
      const recordsByStage = new Map(stages.map(({ key }) => [key, []]));
      for (const record of records) (recordsByStage.get(record.stage) ?? recordsByStage.get("other")).push(record);
      for (const stage of stages) {
        const leads = recordsByStage.get(stage.key);
        if (stage.key === "other" && !leads.length) continue;
        const column = document.createElement("section");
        column.className = "crm-board-column";
        column.dataset.crmColumn = stage.key;
        if (stage.key !== "other") {
          column.dataset.crmDropStage = stage.key;
          column.dataset.crmStageLabel = stage.label;
        }
        if (selectedStage !== "all" && stage.key !== selectedStage) {
          column.dataset.crmFilteredColumn = "";
          column.hidden = true;
        }
        const title = document.createElement("h2");
        const dot = document.createElement("span");
        dot.className = "stage-color-dot";
        dot.dataset.stageColor = stage.color;
        dot.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = stage.label;
        const count = document.createElement("span");
        count.className = "crm-board-count";
        count.textContent = String(leads.length);
        count.setAttribute("aria-label", leads.length === 1 ? "1 lead" : `${leads.length} leads`);
        title.append(dot, label, count);
        column.append(title);
        if (leads.length) {
          const cards = document.createElement("ul");
          cards.className = "crm-board-cards";
          for (const lead of leads) cards.append(card(lead, stage));
          column.append(cards);
        } else {
          const empty = document.createElement("p");
          empty.className = "crm-board-empty";
          empty.textContent = "Sem leads";
          column.append(empty);
        }
        content.append(column);
      }
      const scrollLeft = board.scrollLeft;
      board.replaceChildren(content);
      board.scrollLeft = scrollLeft;
      list.replaceChildren();
    }
    if (focusedLead) focusTarget(focusedLead)?.focus({ preventScroll: true });
  }

  for (const toggle of toggles) {
    toggle.addEventListener("click", () => {
      mode = toggle.dataset.crmMode;
      status.textContent = "";
      try { sessionStorage.setItem(modeKey, mode); } catch { /* Keep the current view in memory. */ }
      render();
    });
  }
  return { render };
}
