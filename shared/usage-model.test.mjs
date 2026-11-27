import test from 'node:test';
import assert from 'node:assert/strict';
import { remainingCapacity, buildUsageCards } from './usage-model.mjs';

test('remaining capacity uses the actual limit and never becomes negative', () => {
  assert.equal(remainingCapacity(20, 30), 10);
  assert.equal(remainingCapacity(30, 30), 0);
  assert.equal(remainingCapacity(31, 30), 0);
  assert.equal(remainingCapacity(0, 30), 30);
  for (const invalid of [null, undefined, NaN, Infinity, -1, 2.5]) assert.equal(remainingCapacity(invalid, 30), null);
});

test('five usage cards distinguish cached, missing and confirmed CRM counts', () => {
  const missing = buildUsageCards({ signedIn: true });
  assert.equal(missing.length, 5);
  assert.equal(missing[0].value, 'Verificando acesso');
  assert.equal(missing[1].value, '—');
  assert.equal(missing[1].progress, null);
  const confirmed = buildUsageCards({ signedIn: true, access: { available: true, mode: 'trial' }, crmCount: 7, crmConfirmed: true, pipelineCount: 6, search: { count: 4 }, ai: { available: true } });
  assert.equal(confirmed[0].value, 'Acesso de teste');
  assert.equal(confirmed[1].detail, '3 vagas disponíveis.');
  assert.equal(confirmed[3].detail, '9 vagas disponíveis.');
  assert.match(confirmed[2].detail, /Última busca neste aparelho: 4/);
  assert.equal(confirmed[4].detail, 'Disponível para sua conta.');
  const cached = buildUsageCards({ signedIn: true, crmCount: 7 });
  assert.equal(cached[1].detail, 'Aguardando atualização da conta.');
});

test('no paid plan or monthly quota is inferred from search access', () => {
  const live = buildUsageCards({ signedIn: true, access: { available: true, mode: 'live' } });
  assert.equal(live[0].value, 'Acesso antecipado');
  assert.equal(live[2].suffix, 'leads por busca');
  assert.equal(live[4].suffix, 'leads por análise');
  const denied = buildUsageCards({ signedIn: true, access: { available: false } });
  assert.equal(denied[0].value, 'Acesso indisponível');
  const signedOut = buildUsageCards({ crmCount: 7, crmConfirmed: true });
  assert.equal(signedOut[1].value, '—');
});
