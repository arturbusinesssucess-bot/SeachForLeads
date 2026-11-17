import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

let sequence = 0;
async function setup() {
  const entries = new Map(), events = [], failures = { read: false, write: false };
  const storage = {
    getItem(key) { if (failures.read) throw Error('read denied'); return entries.get(key) ?? null; },
    setItem(key, value) { if (failures.write) throw Error('quota exceeded'); entries.set(key, value); },
  };
  globalThis.window = { localStorage: storage, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } }, dispatchEvent(event) { events.push(event); return true; } };
  const source = await readFile(new URL('./pipeline.js', import.meta.url), 'utf8');
  const pipeline = await import('data:text/javascript;base64,' + Buffer.from(source + '\n// isolated-test-' + (++sequence)).toString('base64'));
  return { pipeline, entries, events, failures };
}
function rename(stages, key, label) { return stages.map(stage => stage.key === key ? { ...stage, label } : stage); }
function row(text, status, interactive = false) {
  const cell = { textContent: text, querySelector() { return interactive ? {} : null; } };
  return { dataset: status === undefined ? {} : { status }, cells: [{}, {}, {}, cell] };
}

test('defaults keep six stable keys and immutable final outcomes', async () => {
  const { pipeline: p } = await setup();
  assert.deepEqual(p.getDefaultPipeline().map(stage => stage.key), ['new', 'qualified', 'contacted', 'responded', 'won', 'lost']);
  assert.deepEqual(p.getDefaultPipeline().slice(-2), [{ key: 'won', label: 'Fechado', color: 'green' }, { key: 'lost', label: 'Perdido', color: 'red' }]);
});

test('validates renames and reordering while returning fresh normalized objects', async () => {
  const { pipeline: p } = await setup();
  const defaults = p.getDefaultPipeline();
  const input = [defaults[2], defaults[0], defaults[3], { ...defaults[1], label: '  Em   análise  ' }, ...defaults.slice(-2)];
  const result = p.validatePipeline(input);
  assert.equal(result[3].label, 'Em análise');
  assert.deepEqual(result.map(stage => stage.key), ['contacted', 'new', 'responded', 'qualified', 'won', 'lost']);
  assert.equal(input[3].label, '  Em   análise  ');
  assert.notEqual(result[0], input[0]);
});

test('rejects missing, duplicate, unknown and extra stage structures', async () => {
  const { pipeline: p } = await setup(), d = p.getDefaultPipeline();
  for (const invalid of [null, {}, [], d.slice(1), [...d, { key: 'extra', label: 'Extra' }], [{ ...d[0], key: 'unknown' }, ...d.slice(1)], [d[0], d[0], ...d.slice(2)], [{ ...d[0], extra: true }, ...d.slice(1)]]) assert.throws(() => p.validatePipeline(invalid));
});

test('does not rename, reorder or move the fixed outcomes into open positions', async () => {
  const { pipeline: p } = await setup(), d = p.getDefaultPipeline();
  for (const invalid of [rename(d, 'won', 'Vendido'), rename(d, 'lost', 'Descartado'), rename(d, 'won', 'fechado'), [...d.slice(0,4), d[5], d[4]], [d[4], ...d.slice(1,4), d[0], d[5]]]) assert.throws(() => p.validatePipeline(invalid), /Fechado|Perdido|etapas/i);
});

test('requires labels of two to forty characters and unique names ignoring accent and case', async () => {
  const { pipeline: p } = await setup(), d = p.getDefaultPipeline();
  for (const label of ['', ' ', 'A', 'x'.repeat(41), null, 10]) assert.throws(() => p.validatePipeline(rename(d, 'new', label)));
  assert.equal(p.validatePipeline(rename(d, 'new', 'x'.repeat(40)))[0].label.length, 40);
  assert.equal(p.validatePipeline(rename(d, 'new', 'Oi'))[0].label, 'Oi');
  assert.throws(() => p.validatePipeline(rename(rename(d, 'new', 'Análise'), 'qualified', 'ANALISE')), /nome|igual|repetid|exclusiv/i);
});

test('blocks names that collide with another stage aliases or the analytics fallback', async () => {
  const { pipeline: p } = await setup(), d = p.getDefaultPipeline();
  for (const label of ['Qualificado', 'em contato', 'Ganho', 'Perdidos', 'Outros', 'other']) assert.throws(() => p.validatePipeline(rename(d, 'new', label)), /nome|etapa|reservad/i);
  assert.equal(p.validatePipeline(rename(d, 'new', 'Novo lead'))[0].label, 'Novo lead');
});

test('defaults and active pipeline copies cannot mutate internal state', async () => {
  const { pipeline: p } = await setup();
  p.getDefaultPipeline()[0].label = 'Alterado';
  p.getPipeline().reverse();
  p.getPipeline()[0].label = 'Alterado';
  assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
});

test('saves only to the authenticated account key and dispatches cloned stage changes', async () => {
  const { pipeline: p, entries, events } = await setup();
  p.setPipelineUser('account-A');
  const input = rename(p.getDefaultPipeline(), 'new', 'Prospecção');
  const result = p.savePipeline(input);
  assert.equal(result[0].label, 'Prospecção');
  assert.deepEqual(JSON.parse(entries.get('sfl:pipeline:v1:account-A')), result);
  assert.equal(entries.size, 1);
  assert.equal(events.at(-1).type, 'sfl:pipeline-changed');
  assert.equal(events.at(-1).detail.uid, 'account-A');
  events.at(-1).detail.stages[0].label = 'Mutação externa';
  result[0].label = 'Mutação externa';
  input[0].label = 'Mutação externa';
  assert.equal(p.getPipeline()[0].label, 'Prospecção');
});

test('switches account data privately and clears active customizations on logout', async () => {
  const { pipeline: p, entries } = await setup();
  p.setPipelineUser('A');p.savePipeline(rename(p.getDefaultPipeline(), 'new', 'Captação'));
  p.setPipelineUser('B');assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
  p.savePipeline(rename(p.getDefaultPipeline(), 'new', 'Pesquisa'));
  p.setPipelineUser('A');assert.equal(p.getPipeline()[0].label, 'Captação');
  p.setPipelineUser(null);assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
  assert.throws(() => p.savePipeline(p.getDefaultPipeline()), /entr|conta|autenticad/i);
  assert.equal(entries.size, 2);
});

test('invalid stored JSON or invalid saved schemas load defaults without rewriting storage', async () => {
  const { pipeline: p, entries } = await setup();
  for (const value of ['{broken', '{}', 'null', '[1,2,3]', JSON.stringify(rename(p.getDefaultPipeline(), 'won', 'Outro'))]) {
    entries.set('sfl:pipeline:v1:A', value);p.setPipelineUser('A');
    assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
    assert.equal(entries.get('sfl:pipeline:v1:A'), value);
  }
});

test('v1 saved stages without colors keep their names and order and receive default colors by key', async () => {
  const { pipeline: p, entries } = await setup();
  const legacy = [
    { key: 'contacted', label: 'Conversa iniciada' },
    { key: 'new', label: 'Captação' },
    { key: 'qualified', label: 'Qualificados' },
    { key: 'responded', label: 'Em conversa' },
    { key: 'won', label: 'Fechado' },
    { key: 'lost', label: 'Perdido' },
  ];
  const storageKey = 'sfl:pipeline:v1:account-A';
  const before = JSON.stringify(legacy);
  entries.set(storageKey, before);
  const migrated = p.setPipelineUser('account-A');

  assert.deepEqual(migrated.map(({ key, label }) => ({ key, label })), legacy);
  assert.deepEqual(migrated.map(({ color }) => color), ['amber', 'blue', 'purple', 'cyan', 'green', 'red']);
  assert.equal(entries.get(storageKey), before);
  p.savePipeline(migrated);
  assert.deepEqual(JSON.parse(entries.get(storageKey)), migrated);
});

test('custom palette colors persist per account even when final outcomes stay locked', async () => {
  const { pipeline: p, events } = await setup();
  p.setPipelineUser('account-A');
  const stages = p.getPipeline();
  stages[0].color = 'pink';
  stages[4].color = 'cyan';
  stages[5].color = 'slate';
  const saved = p.savePipeline(stages);

  assert.deepEqual(saved.slice(-2), [
    { key: 'won', label: 'Fechado', color: 'cyan' },
    { key: 'lost', label: 'Perdido', color: 'slate' },
  ]);
  assert.equal(p.getStageColor('new'), 'pink');
  assert.equal(p.getStageColor('other'), 'slate');
  assert.equal(p.getAnalyticsStages().at(-1).color, 'slate');
  assert.equal(events.at(-1).detail.stages[0].color, 'pink');

  events.at(-1).detail.stages[0].color = 'red';
  saved[0].color = 'amber';
  assert.equal(p.getStageColor('new'), 'pink');
  p.setPipelineUser('account-B');
  assert.equal(p.getStageColor('new'), 'blue');
  p.setPipelineUser('account-A');
  assert.equal(p.getStageColor('new'), 'pink');
  p.resetPipeline();
  assert.equal(p.getStageColor('new'), 'blue');
});

test('rejects explicit colors outside the palette without saving changes', async () => {
  const { pipeline: p, entries } = await setup();
  p.setPipelineUser('account-A');
  const original = p.getPipeline();
  for (const color of ['#ff0000', 'url(https://example.invalid)', 'Blue', '', null, undefined, {}]) {
    const stages = [{ ...original[0], color }, ...original.slice(1)];
    assert.throws(() => p.savePipeline(stages), /cor da paleta/i);
  }
  assert.equal(entries.size, 0);
  assert.deepEqual(p.getPipeline(), original);
});

test('storage read failures load defaults and write failures never claim a saved mutation', async () => {
  const { pipeline: p, entries, events, failures } = await setup();
  failures.read = true;p.setPipelineUser('A');assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
  failures.read = false;p.savePipeline(rename(p.getDefaultPipeline(), 'new', 'Pesquisa'));
  const before = p.getPipeline(), eventCount = events.length;
  failures.write = true;
  assert.throws(() => p.savePipeline(rename(before, 'new', 'Mudança')), /salvar|armazenamento|dispositivo/i);
  assert.throws(() => p.resetPipeline(), /salvar|armazenamento|dispositivo/i);
  assert.deepEqual(p.getPipeline(), before);assert.equal(events.length, eventCount);
  assert.equal(JSON.parse(entries.get('sfl:pipeline:v1:A'))[0].label, 'Pesquisa');
});

test('resets only the current account and persists the immutable defaults', async () => {
  const { pipeline: p, entries } = await setup();
  p.setPipelineUser('A');p.savePipeline(rename(p.getDefaultPipeline(), 'new', 'Pesquisa'));
  p.setPipelineUser('B');p.savePipeline(rename(p.getDefaultPipeline(), 'new', 'Captação'));
  assert.deepEqual(p.resetPipeline(), p.getDefaultPipeline());
  assert.deepEqual(JSON.parse(entries.get('sfl:pipeline:v1:B')), p.getDefaultPipeline());
  assert.equal(JSON.parse(entries.get('sfl:pipeline:v1:A'))[0].label, 'Pesquisa');
});

test('invalid account identifiers use defaults and do not acquire a writable account key', async () => {
  const { pipeline: p, entries } = await setup();
  for (const uid of [null, undefined, '', ' ', 42, {}, 'x'.repeat(129)]) {
    p.setPipelineUser(uid);assert.deepEqual(p.getPipeline(), p.getDefaultPipeline());
    assert.throws(() => p.savePipeline(p.getDefaultPipeline()));
  }
  assert.equal(entries.size, 0);
});

test('classifies stable keys, old aliases, current labels and unknown values', async () => {
  const { pipeline: p } = await setup();p.setPipelineUser('A');
  const aliases = { new: ['new','novo','novos','novo lead'], qualified: ['saved','salvo','qualificado','qualified','Qualificados'], contacted: ['contacted','contatado','primeiro contato','em contato'], responded: ['responded','interessado','respondeu','em conversa','negociação'], won: ['won','fechado','ganho','venda realizada','Fechados'], lost: ['lost','perdido','descartado','Perdidos'] };
  for (const [key, values] of Object.entries(aliases)) for (const value of values) assert.equal(p.classifyStage('  '+value.toUpperCase()+'  '), key);
  p.savePipeline(rename(p.getDefaultPipeline(), 'qualified', 'Em análise'));
  assert.equal(p.classifyStage('EM ANALISE'), 'qualified');
  for (const value of ['', null, undefined, 'Etapa desconhecida', 'Outros']) assert.equal(p.classifyStage(value), 'other');
});

test('analytics stages follow the editable order and append an independent fallback', async () => {
  const { pipeline: p } = await setup();p.setPipelineUser('A');const d = p.getDefaultPipeline();
  p.savePipeline([d[2],d[0],d[3],d[1],d[4],d[5]]);
  const stages = p.getAnalyticsStages();assert.deepEqual(stages.map(s=>s.key), ['contacted','new','responded','qualified','won','lost','other']);
  stages[0].label='External';assert.equal(p.getAnalyticsStages()[0].label,'Primeiro contato');
});

test('initial row resolution honors data-status and falls back to status text', async () => {
  const { pipeline: p } = await setup();
  assert.equal(p.resolveRowStage(row('Novo lead')), 'new');
  assert.equal(p.resolveRowStage(row('Novo lead','won')), 'won');
  assert.equal(p.resolveRowStage(row('Novo lead','unknown')), 'other');
  assert.equal(p.resolveRowStage(null), 'other');
});

test('row keys survive multiple label renames without changing stored status IDs', async () => {
  const { pipeline: p } = await setup();p.setPipelineUser('A');const lead = row('Novo lead','new');
  assert.equal(p.decorateRowStage(lead),'new');assert.equal(lead.cells[3].textContent,'Novos');
  p.savePipeline(rename(p.getDefaultPipeline(),'new','Captação'));p.decorateRowStage(lead);assert.equal(lead.cells[3].textContent,'Captação');
  p.savePipeline(rename(p.getPipeline(),'new','Pesquisa'));p.decorateRowStage(lead);assert.equal(lead.cells[3].textContent,'Pesquisa');
  assert.equal(p.resolveRowStage(lead),'new');assert.equal(lead.dataset.status,'new');
  const legacy = row('Novo lead');p.decorateRowStage(legacy);p.savePipeline(rename(p.getPipeline(),'new','Entradas'));p.decorateRowStage(legacy);
  assert.equal(p.resolveRowStage(legacy),'new');assert.equal(legacy.cells[3].textContent,'Entradas');
});

test('external status text or data-status mutations replace cached row stages', async () => {
  const { pipeline: p } = await setup();const lead = row('Novo lead','new');p.decorateRowStage(lead);
  lead.cells[3].textContent='Primeiro contato';assert.equal(p.resolveRowStage(lead),'contacted');p.decorateRowStage(lead);
  lead.dataset.status='won';assert.equal(p.resolveRowStage(lead),'won');p.decorateRowStage(lead);assert.equal(lead.cells[3].textContent,'Fechado');
  delete lead.dataset.status;lead.cells[3].textContent='Perdido';assert.equal(p.resolveRowStage(lead),'lost');
});

test('does not destroy interactive status controls or rewrite unknown statuses', async () => {
  const { pipeline: p } = await setup();p.setPipelineUser('A');p.savePipeline(rename(p.getDefaultPipeline(),'new','Captação'));
  const interactive = row('Novo lead','new',true);assert.equal(p.decorateRowStage(interactive),'new');assert.equal(interactive.cells[3].textContent,'Novo lead');
  const unknown = row('Aguardando confirmação');assert.equal(p.decorateRowStage(unknown),'other');assert.equal(unknown.cells[3].textContent,'Aguardando confirmação');
});

test('a previously unknown row can resolve after its label is configured', async () => {
  const { pipeline: p } = await setup();p.setPipelineUser('A');const lead = row('Captação');
  assert.equal(p.resolveRowStage(lead),'other');p.savePipeline(rename(p.getDefaultPipeline(),'new','Captação'));
  assert.equal(p.resolveRowStage(lead),'new');
});

