const DEFAULT_PIPELINE = Object.freeze([
  Object.freeze({ key: 'new', label: 'Novos', color: 'blue' }),
  Object.freeze({ key: 'qualified', label: 'Qualificados', color: 'purple' }),
  Object.freeze({ key: 'contacted', label: 'Primeiro contato', color: 'amber' }),
  Object.freeze({ key: 'responded', label: 'Em conversa', color: 'cyan' }),
  Object.freeze({ key: 'won', label: 'Fechado', color: 'green' }),
  Object.freeze({ key: 'lost', label: 'Perdido', color: 'red' }),
]);
export const STAGE_COLOR_OPTIONS = Object.freeze([
  { key: 'blue', label: 'Azul' },
  { key: 'purple', label: 'Roxo' },
  { key: 'cyan', label: 'Ciano' },
  { key: 'amber', label: 'Âmbar' },
  { key: 'pink', label: 'Rosa' },
  { key: 'green', label: 'Verde' },
  { key: 'red', label: 'Vermelho' },
  { key: 'slate', label: 'Cinza' },
].map((option) => Object.freeze(option)));
export const MAX_PIPELINE_STAGES = 15;
export const MAX_STAGE_NAME_LENGTH = 20;
const STORED_STAGE_NAME_LENGTH = 40;
const PALETTE_KEYS = new Set(STAGE_COLOR_OPTIONS.map(({ key }) => key));
const DEFAULT_OPEN_KEYS = new Set(['new', 'qualified', 'contacted', 'responded']);
const FINAL_STAGES = DEFAULT_PIPELINE.slice(-2);
const DEFAULT_COLORS = new Map(DEFAULT_PIPELINE.map(({ key, color }) => [key, color]));
const FALLBACK_COLOR = 'slate';
const STORAGE_PREFIX = 'sfl:pipeline:v1:';
const CUSTOM_STAGE_KEY = /^custom-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
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
let pipelineSync = null;
let stopWatchingPipeline;
let syncRevision = 0;

function copy(stages) { return stages.map(({ key, label, color }) => ({ key, label, color })); }
function invalidStructure() { return new Error('Mantenha as quatro etapas abertas padrão e os resultados Fechado e Perdido.'); }
function stageLimit() { return new Error(`O funil pode ter até ${MAX_PIPELINE_STAGES} etapas, incluindo Fechado e Perdido.`); }
function storageFailure() { return new Error('Não foi possível sincronizar o funil. Verifique sua conexão e tente novamente.'); }

export function getDefaultPipeline() { return copy(DEFAULT_PIPELINE); }
export function getPipeline() { return copy(currentStages); }
export function isCustomStage(key) { return typeof key === 'string' && CUSTOM_STAGE_KEY.test(key); }
export function isOpenStage(key) { return DEFAULT_OPEN_KEYS.has(key) || isCustomStage(key); }
export function getStageColor(key) {
  return currentStages.find((stage) => stage.key === key)?.color ?? FALLBACK_COLOR;
}

export function createCustomStage(stages = currentStages) {
  if (stages.length >= MAX_PIPELINE_STAGES) throw stageLimit();
  const names = new Set(stages.map(({ label }) => normalize(label)));
  const baseLabel = 'Nova etapa';
  let label = baseLabel;
  for (let number = 2; names.has(normalize(label)); number++) label = `${baseLabel} ${number}`;
  return { key: `custom-${globalThis.crypto.randomUUID()}`, label, color: FALLBACK_COLOR };
}

export function validateStageName(value, previousLabel, maxLength = MAX_STAGE_NAME_LENGTH) {
  const nameError = () => new Error(`Informe um nome de 2 a ${maxLength} caracteres para cada etapa.`);
  if (typeof value !== 'string' || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) throw nameError();
  const label = value.trim().replace(/\s+/g, ' ');
  // Keep stored names usable when a color or the order changes.
  if (label.length < 2 || label.length > (label === previousLabel ? STORED_STAGE_NAME_LENGTH : maxLength)) throw nameError();
  return label;
}

export function validatePipeline(input, previousStages) {
  if (!Array.isArray(input) || input.length < DEFAULT_PIPELINE.length) throw invalidStructure();
  if (input.length > MAX_PIPELINE_STAGES) throw stageLimit();
  const finalStart = input.length - FINAL_STAGES.length;
  const keys = new Set(), names = new Set(), stages = [];
  const previousNames = new Map(previousStages?.map(({ key, label }) => [key, label]));
  const nameLimit = previousStages ? MAX_STAGE_NAME_LENGTH : STORED_STAGE_NAME_LENGTH;
  for (let index = 0; index < input.length; index++) {
    const stage = input[index];
    if (!stage || typeof stage !== 'object' || Array.isArray(stage) || Object.keys(stage).some((field) => field !== 'key' && field !== 'label' && field !== 'color') || (!DEFAULT_COLORS.has(stage.key) && !isCustomStage(stage.key)) || keys.has(stage.key)) throw invalidStructure();
    const finalStage = FINAL_STAGES[index - finalStart];
    if (finalStage ? stage.key !== finalStage.key : !isOpenStage(stage.key)) {
      throw new Error('As etapas Fechado e Perdido permanecem no fim e não podem mudar de posição.');
    }
    const label = validateStageName(stage.label, previousNames.get(stage.key), nameLimit);
    if (finalStage && label !== finalStage.label) throw new Error('As etapas Fechado e Perdido não podem ser renomeadas.');
    const normalized = normalize(label);
    if (names.has(normalized)) throw new Error('O nome de cada etapa deve ser único, mesmo sem acentos ou com letras maiúsculas.');
    if (reservedOther.has(normalized) || (aliasKeys.has(normalized) && aliasKeys.get(normalized) !== stage.key)) throw new Error('Esse nome já identifica outra etapa do funil ou é um nome reservado.');
    const color = Object.hasOwn(stage, 'color') ? stage.color : DEFAULT_COLORS.get(stage.key) ?? FALLBACK_COLOR;
    if (!PALETTE_KEYS.has(color)) throw new Error('Escolha uma cor da paleta para cada etapa.');
    keys.add(stage.key);
    names.add(normalized);
    stages.push({ key: stage.key, label, color });
  }
  if ([...DEFAULT_OPEN_KEYS].some((key) => !keys.has(key))) throw invalidStructure();
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
  const revision = ++syncRevision;
  stopWatchingPipeline?.();
  stopWatchingPipeline = undefined;
  pipelineSync = null;
  let loaded = getDefaultPipeline();
  if (currentUser && typeof window !== 'undefined') {
    try {
      const saved = window.localStorage.getItem(STORAGE_PREFIX + currentUser);
      if (saved !== null && saved.length <= 10000) loaded = validatePipeline(JSON.parse(saved));
    } catch { loaded = getDefaultPipeline(); }
  }
  currentStages = loaded;
  dispatchChange();
  if (currentUser && typeof window !== 'undefined') connectPipeline(currentUser, loaded, revision);
  return getPipeline();
}

function applyPipeline(stages) {
  if (JSON.stringify(currentStages) === JSON.stringify(stages)) return;
  currentStages = stages;
  dispatchChange();
}

async function connectPipeline(uid, localStages, revision) {
  const failed = () => {
    if (revision !== syncRevision) return;
    pipelineSync = null;
    window.dispatchEvent(new CustomEvent('sfl:pipeline-sync-error', { detail: { uid } }));
  };
  try {
    const sync = await import('./workspace-sync.js');
    if (revision !== syncRevision) return;
    const defaults = getDefaultPipeline();
    if (JSON.stringify(defaults) !== JSON.stringify(localStages)) {
      await sync.updateWorkspace(uid, ({ pipeline }) => pipeline === undefined ? { pipeline: localStages } : null);
    }
    if (revision !== syncRevision) return;
    stopWatchingPipeline = sync.watchWorkspace(uid, ({ pipeline }) => {
      if (revision !== syncRevision) return;
      try {
        applyPipeline(pipeline === undefined ? defaults : validatePipeline(pipeline));
        pipelineSync = sync;
      } catch { failed(); }
    }, failed);
  } catch { failed(); }
}

export async function savePipeline(stages, expected = getPipeline()) {
  if (!currentUser) throw new Error('Entre na sua conta para salvar o funil.');
  if (!pipelineSync) throw storageFailure();
  const normalized = validatePipeline(stages, expected);
  const uid = currentUser;
  const revision = syncRevision;
  const { pipeline } = await pipelineSync.updateWorkspace(uid, ({ pipeline, leads }) => {
    const remote = pipeline === undefined ? getDefaultPipeline() : validatePipeline(pipeline);
    if (JSON.stringify(remote) !== JSON.stringify(expected)) {
      throw new Error('O funil mudou em outro dispositivo. Descarte o rascunho e revise a versão atual.');
    }
    const kept = new Set(normalized.map(({ key }) => key));
    if (remote.some(({ key }) => !kept.has(key) && leads?.some((lead) => lead.stage === key))) {
      throw new Error('Mova os leads antes de remover uma etapa em uso.');
    }
    return { pipeline: normalized };
  });
  if (revision === syncRevision && JSON.stringify(currentStages) === JSON.stringify(expected)) applyPipeline(pipeline);
  return copy(pipeline);
}

export function resetPipeline() { return savePipeline(getDefaultPipeline()); }

export function classifyStage(value) {
  const status = normalize(value);
  if (aliasKeys.has(status)) return aliasKeys.get(status);
  if (isCustomStage(status)) return currentStages.some((stage) => stage.key === status) ? status : 'other';
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
    const sourceKey = normalize(sourceStatus);
    state.key = classifyStage(isCustomStage(sourceKey) || (interactive(cell) && sourceStatus) ? sourceStatus : renderedLabel);
    state.renderedLabel = renderedLabel;
  } else if (state.key === 'other') {
    state.key = classifyStage(sourceStatus || renderedLabel);
  }
  if (isCustomStage(state.key) && !currentStages.some((stage) => stage.key === state.key)) return 'other';
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

export function getAnalyticsStages() {
  return [...getPipeline(), { key: 'other', label: 'Outros', color: FALLBACK_COLOR }];
}

