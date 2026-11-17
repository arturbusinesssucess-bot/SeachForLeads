const DEFAULT_PIPELINE = Object.freeze([
  Object.freeze({ key: 'new', label: 'Novos' }),
  Object.freeze({ key: 'qualified', label: 'Qualificados' }),
  Object.freeze({ key: 'contacted', label: 'Primeiro contato' }),
  Object.freeze({ key: 'responded', label: 'Em conversa' }),
  Object.freeze({ key: 'won', label: 'Fechado' }),
  Object.freeze({ key: 'lost', label: 'Perdido' }),
]);
const OPEN_KEYS = new Set(['new', 'qualified', 'contacted', 'responded']);
const ALL_KEYS = new Set(DEFAULT_PIPELINE.map((stage) => stage.key));
const STORAGE_PREFIX = 'sfl:pipeline:v1:';
const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim().replace(/\s+/g, ' ');
const aliases = {
  new: ['new', 'novo', 'novos', 'novo lead'],
  qualified: ['qualified', 'saved', 'salvo', 'qualificado', 'qualificados'],
  contacted: ['contacted', 'contatado', 'primeiro contato', 'em contato'],
  responded: ['responded', 'interessado', 'respondeu', 'em conversa', 'negociacao'],
  won: ['won', 'fechado', 'fechados', 'ganho', 'venda realizada'],
  lost: ['lost', 'perdido', 'perdidos', 'descartado'],
};
const aliasKeys = new Map();
for (const [key, values] of Object.entries(aliases)) for (const value of values) aliasKeys.set(normalize(value), key);
const reservedOther = new Set(['other', 'outro', 'outros']);
let currentUser = null;
let currentStages = getDefaultPipeline();
let rowStates = new WeakMap();

function copy(stages) { return stages.map(({ key, label }) => ({ key, label })); }
function invalidStructure() { return new Error('Mantenha as quatro etapas abertas e os resultados Fechado e Perdido.'); }
function storageFailure() { return new Error('Não foi possível salvar neste dispositivo. Verifique as permissões de armazenamento e tente novamente.'); }

export function getDefaultPipeline() { return copy(DEFAULT_PIPELINE); }
export function getPipeline() { return copy(currentStages); }

export function validatePipeline(input) {
  if (!Array.isArray(input) || input.length !== DEFAULT_PIPELINE.length) throw invalidStructure();
  const keys = new Set(), names = new Set(), stages = [];
  for (let index = 0; index < input.length; index++) {
    const stage = input[index];
    if (!stage || typeof stage !== 'object' || Array.isArray(stage) || Object.keys(stage).some((field) => field !== 'key' && field !== 'label') || !ALL_KEYS.has(stage.key) || keys.has(stage.key)) throw invalidStructure();
    if (index < 4 ? !OPEN_KEYS.has(stage.key) : stage.key !== DEFAULT_PIPELINE[index].key) {
      throw new Error('As etapas Fechado e Perdido permanecem no fim e não podem mudar de posição.');
    }
    if (typeof stage.label !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(stage.label)) throw new Error('Informe um nome de 2 a 40 caracteres para cada etapa.');
    const label = stage.label.trim().replace(/\s+/g, ' ');
    if (label.length < 2 || label.length > 40) throw new Error('Informe um nome de 2 a 40 caracteres para cada etapa.');
    if (index >= 4 && label !== DEFAULT_PIPELINE[index].label) throw new Error('As etapas Fechado e Perdido não podem ser renomeadas.');
    const normalized = normalize(label);
    if (names.has(normalized)) throw new Error('O nome de cada etapa deve ser único, mesmo sem acentos ou com letras maiúsculas.');
    if (reservedOther.has(normalized) || (aliasKeys.has(normalized) && aliasKeys.get(normalized) !== stage.key)) throw new Error('Esse nome já identifica outra etapa do funil ou é um nome reservado.');
    keys.add(stage.key);names.add(normalized);stages.push({ key: stage.key, label });
  }
  return stages;
}

function dispatchChange() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  const EventConstructor = window.CustomEvent || globalThis.CustomEvent;
  if (typeof EventConstructor !== 'function') return;
  window.dispatchEvent(new EventConstructor('sfl:pipeline-changed', { detail: { uid: currentUser, stages: getPipeline() } }));
}

export function setPipelineUser(uid) {
  const nextUser = typeof uid === 'string' && uid.trim() && uid.length <= 128 && !/[\u0000-\u001f\u007f]/u.test(uid) ? uid : null;
  if (nextUser !== currentUser) rowStates = new WeakMap();
  currentUser = nextUser;
  let loaded = getDefaultPipeline();
  if (currentUser && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + currentUser);
      if (saved !== null && saved.length <= 10000) loaded = validatePipeline(JSON.parse(saved));
    } catch { loaded = getDefaultPipeline(); }
  }
  currentStages = loaded;
  dispatchChange();
  return getPipeline();
}

export function savePipeline(stages) {
  if (!currentUser) throw new Error('Entre na sua conta para salvar o funil neste dispositivo.');
  const normalized = validatePipeline(stages);
  try {
    if (typeof window === 'undefined' || typeof window.localStorage?.setItem !== 'function') throw storageFailure();
    window.localStorage.setItem(STORAGE_PREFIX + currentUser, JSON.stringify(normalized));
  } catch { throw storageFailure(); }
  currentStages = normalized;
  dispatchChange();
  return getPipeline();
}

export function resetPipeline() { return savePipeline(getDefaultPipeline()); }

export function classifyStage(value) {
  const status = normalize(value);
  if (aliasKeys.has(status)) return aliasKeys.get(status);
  const current = currentStages.find((stage) => normalize(stage.label) === status);
  return current?.key || 'other';
}

function statusCell(row) { return row?.cells?.[3] || null; }
function cellText(cell) { return String(cell?.textContent ?? '').trim(); }
function interactive(cell) { return !!cell?.querySelector?.('button,select,input,textarea,a,[contenteditable]:not([contenteditable="false"])'); }

export function resolveRowStage(row) {
  if (!row || (typeof row !== 'object' && typeof row !== 'function')) return 'other';
  const cell = statusCell(row);
  const renderedLabel = cellText(cell);
  const sourceStatus = row.dataset?.status ?? '';
  let state = rowStates.get(row);
  if (!state) {
    state = { key: classifyStage(sourceStatus || renderedLabel), renderedLabel, sourceStatus };
    rowStates.set(row, state);
  } else if (sourceStatus !== state.sourceStatus) {
    state.key = classifyStage(sourceStatus || renderedLabel);
    state.sourceStatus = sourceStatus;
    state.renderedLabel = renderedLabel;
  } else if (renderedLabel !== state.renderedLabel) {
    state.key = classifyStage(interactive(cell) && sourceStatus ? sourceStatus : renderedLabel);
    state.renderedLabel = renderedLabel;
  } else if (state.key === 'other') {
    state.key = classifyStage(sourceStatus || renderedLabel);
  }
  return state.key;
}

export function decorateRowStage(row) {
  const key = resolveRowStage(row);
  const cell = statusCell(row);
  const stage = currentStages.find((item) => item.key === key);
  if (cell && stage && !interactive(cell) && cell.textContent !== stage.label) cell.textContent = stage.label;
  const state = row && rowStates.get(row);
  if (state) state.renderedLabel = cellText(cell);
  return key;
}

export function getAnalyticsStages() { return [...getPipeline(), { key: 'other', label: 'Outros' }]; }
