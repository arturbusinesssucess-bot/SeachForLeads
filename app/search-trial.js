import { getPipeline } from "./pipeline.js?v=workspace-sync";

const limit = 10;
const contactedStages = new Set(["contacted", "responded", "won"]);

function makeResults({ niche, state, stateName, cityId, cityName, quantity }) {
  const normalized = niche.toLocaleLowerCase("pt-BR").replace(/\s+/gu, " ");
  const location = cityName ? `${cityName}, ${state}` : stateName;
  return Array.from({ length: Math.min(limit, quantity) }, (_, index) => ({
    id: JSON.stringify([normalized, state, cityId, index]),
    company: `Empresa de teste ${String(index + 1).padStart(2, "0")} · ${niche}`,
    location,
    category: niche,
    stage: "new",
    contacted: false,
  }));
}

function readSaved(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("invalid-trial-data");
  return readLeads(parsed);
}

function readLeads(value) {
  return (value ?? []).filter((lead) => lead && [lead.id, lead.company, lead.location, lead.category, lead.stage]
    .every((field) => typeof field === "string")).slice(0, limit);
}

function csvCell(value) {
  const text = String(value);
  const safe = /^\s*[=+@-]|^[\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function initializeSearchTrial({ form, criteria, rows, openCRM }) {
  const status = document.querySelector("#search-status");
  const notice = document.querySelector("#trial-search-notice");
  const resultPanel = document.querySelector("#trial-results");
  const resultStatus = document.querySelector("#trial-results-status");
  const results = document.querySelector("#trial-result-list");
  const template = document.querySelector("#trial-result-template");
  const editForm = document.querySelector("#trial-stage-form");
  const editStage = document.querySelector("#trial-stage");
  const editStatus = document.querySelector("#trial-stage-status");
  const crmStatus = document.querySelector("#trial-crm-status");
  const exportButton = document.querySelector("#export-leads");
  let uid = "";
  let syncClient;
  let stopWatching;
  let legacyLeads = [];
  let snapshotVersion = 0;
  let saved = [];
  let editingId = null;
  let editButtons = new Map();
  let resultButtons = new Map();
  let revision = 0;

  function syncButtons() {
    const savedIds = new Set(saved.map((lead) => lead.id));
    for (const [id, { button, label }] of resultButtons) {
      const stored = savedIds.has(id);
      const full = saved.length >= limit;
      button.disabled = stored || full || !syncClient;
      button.querySelector(".app-button-label").textContent = stored ? "Salvo no CRM" : full ? "Limite do teste" : "Salvar no CRM";
      button.setAttribute("aria-label", stored ? "Lead salvo no CRM" : full ? "Limite de 10 leads salvos atingido" : label);
    }
    exportButton.disabled = saved.length === 0;
    exportButton.setAttribute("aria-disabled", String(exportButton.disabled));
  }

  function closeEditor(restoreFocus = true) {
    const button = editButtons.get(editingId);
    editingId = null;
    editForm.hidden = true;
    editStatus.textContent = "";
    if (restoreFocus) button?.focus();
  }

  function openEditor(lead) {
    editingId = lead.id;
    document.querySelector("#trial-stage-company").textContent = lead.company;
    const stages = getPipeline();
    editStage.replaceChildren(...stages.map((stage) => new Option(stage.label, stage.key)));
    editStage.value = stages.some((stage) => stage.key === lead.stage) ? lead.stage : "new";
    editStage.dispatchEvent(new Event("change", { bubbles: true }));
    editForm.hidden = false;
    editStatus.textContent = "";
    document.querySelector("#trial-stage-title").focus();
  }

  function renderRows() {
    const items = document.createDocumentFragment();
    const stageLabels = new Map(getPipeline().map((stage) => [stage.key, stage.label]));
    editButtons = new Map();
    for (const lead of saved) {
      const row = document.createElement("tr");
      row.dataset.company = lead.company;
      row.dataset.city = lead.location;
      row.dataset.category = lead.category;
      row.dataset.status = lead.stage;
      row.dataset.contacted = String(lead.contacted === true);
      if (typeof lead.savedAt === "string") row.dataset.savedAt = lead.savedAt;
      for (const value of [lead.company, lead.location, "Busca de teste", stageLabels.get(lead.stage) || "Outros"]) row.insertCell().textContent = value;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "text-link trial-edit-stage";
      button.textContent = "Alterar etapa";
      button.setAttribute("aria-label", `Alterar etapa de ${lead.company}`);
      button.addEventListener("click", () => openEditor(lead));
      row.insertCell().append(button);
      editButtons.set(lead.id, button);
      items.append(row);
    }
    rows.replaceChildren(items);
    syncButtons();
  }

  function receiveLeads(next) {
    const ids = new Set(next.map(({ id }) => id));
    const archived = legacyLeads.filter((lead) => !ids.has(lead.id)).length;
    crmStatus.textContent = archived ? "O CRM atingiu 10 leads. Os leads excedentes continuam salvos neste navegador." : "";
    if (JSON.stringify(saved) === JSON.stringify(next)) return;
    saved = next;
    renderRows();
  }

  async function updateSaved(action) {
    if (!syncClient || !uid) throw new Error("trial-not-authorized");
    const account = uid;
    const session = revision;
    const version = snapshotVersion;
    const state = await syncClient.updateWorkspace(account, ({ leads, pipeline }) => {
      const current = readLeads(leads);
      const next = action(current, pipeline);
      return next === current ? null : { leads: next };
    });
    if (session !== revision) return false;
    if (snapshotVersion === version) receiveLeads(readLeads(state.leads));
    return true;
  }

  async function saveResult(lead, button) {
    button.disabled = true;
    try {
      const updated = await updateSaved((leads) => {
        if (leads.some((item) => item.id === lead.id)) return leads;
        if (leads.length >= limit) throw new Error("trial-limit");
        return [{ ...lead, savedAt: new Date().toISOString() }, ...leads];
      });
      if (updated) resultStatus.textContent = `Lead salvo no CRM. ${saved.length} de ${limit} leads do teste salvos.`;
    } catch (error) {
      resultStatus.textContent = error.message === "trial-limit" ? "O CRM já tem os 10 leads permitidos neste teste." : "Não foi possível sincronizar o lead. Verifique sua conexão e tente novamente.";
      syncButtons();
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!syncClient) {
      if (!status.textContent) status.textContent = "A busca de teste está indisponível para esta conta.";
      return;
    }
    const input = criteria?.read();
    if (!input) return;
    const batch = makeResults(input);
    const items = document.createDocumentFragment();
    resultButtons = new Map();
    for (const lead of batch) {
      const item = template.content.cloneNode(true);
      item.querySelector("h3").textContent = lead.company;
      item.querySelector("p").textContent = lead.location;
      const button = item.querySelector("button");
      const label = `Salvar ${lead.company} no CRM`;
      button.addEventListener("click", () => saveResult(lead, button));
      resultButtons.set(lead.id, { button, label });
      items.append(item);
    }
    results.replaceChildren(items);
    resultPanel.hidden = false;
    syncButtons();
    status.textContent = "";
    resultStatus.textContent = batch.length === 1 ? "1 lead fictício gerado para o teste." : `${batch.length} leads fictícios gerados para o teste.`;
    document.querySelector("#trial-results-title").focus();
  });

  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = editingId;
    const stage = editStage.value;
    if (!id || !getPipeline().some((item) => item.key === stage)) return;
    try {
      const updated = await updateSaved((leads, pipeline) => {
        if (pipeline && !pipeline.some(({ key }) => key === stage)) throw new Error("trial-stage-changed");
        return leads.map((lead) => lead.id === id
          ? { ...lead, stage, contacted: lead.contacted || contactedStages.has(stage) }
          : lead);
      });
      if (updated && editingId === id) {
        closeEditor();
        crmStatus.textContent = "Etapa atualizada.";
      }
    } catch (error) {
      editStatus.textContent = error.message === "trial-stage-changed"
        ? "Esta etapa mudou em outro dispositivo. Feche a edição e escolha uma opção do funil atual."
        : "Não foi possível sincronizar a etapa. Verifique sua conexão e tente novamente.";
    }
  });

  document.querySelector("#trial-stage-close").addEventListener("click", () => closeEditor());
  document.querySelector("#trial-open-crm").addEventListener("click", openCRM);
  exportButton.addEventListener("click", () => {
    if (!uid || !saved.length) return;
    const labels = new Map(getPipeline().map((stage) => [stage.key, stage.label]));
    const records = [["Empresa", "Localização", "Origem", "Etapa"], ...saved.map((lead) => [lead.company, lead.location, "Busca de teste", labels.get(lead.stage) || "Outros"])];
    const csv = records.map((row) => row.map(csvCell).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads-de-teste.csv";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  window.addEventListener("sfl:pipeline-changed", () => {
    if (uid) renderRows();
  });

  return {
    async setUser(user) {
      const current = ++revision;
      const wasEnabled = Boolean(uid);
      stopWatching?.();
      stopWatching = undefined;
      uid = "";
      syncClient = undefined;
      legacyLeads = [];
      saved = [];
      resultButtons = new Map();
      results.replaceChildren();
      resultPanel.hidden = true;
      resultStatus.textContent = "";
      crmStatus.textContent = "";
      notice.hidden = true;
      closeEditor(false);
      if (wasEnabled) renderRows();
      if (!user) return;
      status.textContent = "Verificando acesso à busca de teste…";
      try {
        const token = await user.getIdToken();
        if (current !== revision) return;
        const response = await fetch("/api/search-trial", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(10000) });
        const available = response.ok && (await response.json()).available === true;
        if (current !== revision) return;
        if (!available) {
          status.textContent = [401, 403].includes(response.status) ? "A busca de teste ainda não está liberada para esta conta." : "Não foi possível verificar a busca de teste.";
          return;
        }
        const account = user.uid;
        uid = account;
        try { legacyLeads = readSaved(`sfl:search-trial:v1:${account}`); } catch { legacyLeads = []; }
        saved = legacyLeads;
        renderRows();
        status.textContent = "Sincronizando os leads da sua conta…";
        const sync = await import("./workspace-sync.js");
        if (current !== revision) return;
        const backup = legacyLeads;
        if (backup.length) {
          await sync.updateWorkspace(account, ({ leads }) => {
            const existing = readLeads(leads);
            const known = new Set(existing.map(({ id }) => id));
            const missing = backup.filter(({ id }) => !known.has(id)).slice(0, limit - existing.length);
            return missing.length ? { leads: [...existing, ...missing] } : null;
          });
        }
        if (current !== revision) return;
        const unavailable = () => {
          if (current !== revision) return;
          syncClient = undefined;
          syncButtons();
          const message = "Não foi possível sincronizar o CRM. Verifique sua conexão e recarregue a página.";
          status.textContent = message;
          crmStatus.textContent = message;
        };
        stopWatching = sync.watchWorkspace(account, ({ leads }) => {
          if (current !== revision) return;
          snapshotVersion++;
          syncClient = sync;
          receiveLeads(readLeads(leads));
          syncButtons();
          notice.hidden = false;
          status.textContent = "";
        }, unavailable);
      } catch {
        if (current === revision) {
          status.textContent = "Não foi possível abrir a busca de teste. Recarregue a página para tentar novamente.";
          if (uid) crmStatus.textContent = "Não foi possível sincronizar o CRM. Os leads já salvos neste navegador continuam disponíveis.";
        }
      }
    },
  };
}
