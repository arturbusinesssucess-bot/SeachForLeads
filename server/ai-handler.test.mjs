import test from 'node:test';
import assert from 'node:assert/strict';
import { AIError } from './ai-core.mjs';
import { createAIHandler } from './ai-handler.mjs';

const origin = 'https://searchforleads.vercel.app';
const offer = { task: 'offer', offer: 'Sites para clínicas.' };
const result = { summary: 'Sites para clínicas.', niches: [{ name: 'Clínicas', reason: 'Podem apresentar os serviços.' }], qualificationCriteria: ['Verificar o site atual.'] };
const env = { OPENROUTER_API_KEY: 'test-server-key', AI_ALLOWED_EMAILS: 'owner@example.com' };
const request = (body = offer, options = {}) => new Request(origin + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json', ...options.headers }, body: JSON.stringify(body), ...options });
const permitted = async () => ({ uid: 'owner', email: 'owner@example.com' });
const handler = (options = {}) => createAIHandler({ env, authenticate: permitted, infer: async () => result, log: () => {}, ...options });
const jsonError = async (response, status, code) => { assert.equal(response.status, status); const body = await response.json(); assert.equal(body.error.code, code); assert.equal(typeof body.error.message, 'string'); return body; };

test('returns validated AI output directly and keeps the model and credential server-side', async () => {
  let captured;
  const response = await handler({ infer: async (...args) => { captured = args; return result; } })(request());
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), result);
  assert.deepEqual(captured[0], offer); assert.equal(captured[1].apiKey, env.OPENROUTER_API_KEY); assert.equal(captured[1].model, 'google/gemini-2.5-flash'); assert(captured[1].signal instanceof AbortSignal);
});

test('authenticated readiness returns only non-sensitive availability data', async () => {
  let called = 0;
  const response = await handler({ infer: async () => { called++; } })(new Request(origin + '/api/ai'));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { available: true, maxLeads: 5 }); assert.equal(called, 0);
});

test('authenticates before reporting missing configuration or calling the provider', async () => {
  let called = 0;
  const denied = handler({ env: {}, authenticate: async () => { throw new AIError(401, 'AUTH_REQUIRED', 'Entre para continuar.'); }, infer: async () => { called++; } });
  await jsonError(await denied(request()), 401, 'AUTH_REQUIRED'); assert.equal(called, 0);
  await jsonError(await handler({ env: {} })(request()), 503, 'AI_NOT_CONFIGURED');
  await jsonError(await handler({ env: { ...env, OPENROUTER_API_KEY: ' ' } })(new Request(origin + '/api/ai')), 503, 'AI_NOT_CONFIGURED');
});

test('passes server allowlist to the authentication verifier and does not spend for a forbidden user', async () => {
  let configuration, called = 0;
  const response = await handler({ authenticate: async (_request, value) => { configuration = value; throw new AIError(403, 'AI_ACCESS_DENIED', 'Acesso não liberado.'); }, infer: async () => { called++; } })(request());
  await jsonError(response, 403, 'AI_ACCESS_DENIED'); assert.equal(configuration.allowedEmails, env.AI_ALLOWED_EMAILS); assert.equal(called, 0);
});

test('rejects unsupported methods with an Allow header', async () => {
  let called = 0;
  for (const method of ['PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']) {
    const response = await handler({ authenticate: async () => { called++; return {}; } })(new Request(origin + '/api/ai', { method }));
    await jsonError(response, 405, 'METHOD_NOT_ALLOWED'); assert.equal(response.headers.get('allow'), 'GET, POST');
  }
  assert.equal(called, 0);
});

test('rejects cross-origin requests and does not emit permissive CORS headers', async () => {
  let calls = 0;
  for (const value of ['https://attacker.invalid', 'null']) {
    const response = await handler({ authenticate: async () => { calls++; return {}; } })(request(offer, { headers: { 'Content-Type': 'application/json', Origin: value } }));
    await jsonError(response, 403, 'ORIGIN_NOT_ALLOWED'); assert.equal(response.headers.get('access-control-allow-origin'), null);
  }
  assert.equal(calls, 0);
  assert.equal((await handler()(request(offer, { headers: { 'Content-Type': 'application/json', Origin: origin } }))).status, 200);
});

test('requires JSON and rejects malformed, empty, and oversized declared bodies', async () => {
  await jsonError(await handler()(request(offer, { headers: { 'Content-Type': 'text/plain' } })), 415, 'CONTENT_TYPE_REQUIRED');
  await jsonError(await handler()(new Request(origin + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' })), 400, 'INVALID_JSON');
  await jsonError(await handler()(new Request(origin + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' } })), 400, 'INVALID_JSON');
  await jsonError(await handler()(request(offer, { headers: { 'Content-Type': 'application/json', 'Content-Length': '16385' } })), 413, 'BODY_TOO_LARGE');
});

test('caps actual streamed UTF-8 bytes even when Content-Length is absent or understated', async () => {
  for (const declared of [undefined, '1']) {
    let cancelled = false, calls = 0;
    const bytes = new TextEncoder().encode(JSON.stringify({ task: 'offer', offer: 'é'.repeat(9000) }));
    const stream = new ReadableStream({ start(controller) { controller.enqueue(bytes.subarray(0, 10000)); controller.enqueue(bytes.subarray(10000)); }, cancel() { cancelled = true; } });
    const headers = { 'Content-Type': 'application/json' }; if (declared) headers['Content-Length'] = declared;
    const response = await handler({ infer: async () => { calls++; } })(new Request(origin + '/api/ai', { method: 'POST', headers, body: stream, duplex: 'half' }));
    await jsonError(response, 413, 'BODY_TOO_LARGE'); assert.equal(calls, 0); assert.equal(cancelled, true);
  }
});

test('rejects invalid task data and arbitrary model overrides before provider spending', async () => {
  let calls = 0;
  for (const body of [{ ...offer, model: 'expensive/model' }, { task: 'messages', offer: 'x' }, { task: 'offer', offer: '' }, { task: 'leads', offer: 'x', leads: [] }]) await jsonError(await handler({ infer: async () => { calls++; } })(request(body)), 400, 'INVALID_INPUT');
  assert.equal(calls, 0);
});

test('uses only a bounded server-configured model', async () => {
  let model;
  assert.equal((await handler({ env: { ...env, OPENROUTER_MODEL: 'provider/model' }, infer: async (_body, options) => { model = options.model; return result; } })(request())).status, 200);
  assert.equal(model, 'provider/model');
  for (const OPENROUTER_MODEL of ['x'.repeat(201), 'provider/model other']) await jsonError(await handler({ env: { ...env, OPENROUTER_MODEL } })(request()), 503, 'AI_NOT_CONFIGURED');
});

test('returns safe core errors and sanitizes unknown exceptions and logs', async () => {
  const logs = [];
  await jsonError(await handler({ infer: async () => { throw new AIError(429, 'AI_RATE_LIMITED', 'Tente novamente em instantes.'); }, log: (code) => logs.push(code) })(request()), 429, 'AI_RATE_LIMITED');
  const response = await handler({ infer: async () => { throw new Error('Bearer secret-key private-upstream-body'); }, log: (code) => logs.push(code) })(request());
  const body = await jsonError(response, 500, 'AI_INTERNAL_ERROR'); assert(!JSON.stringify(body).includes('secret')); assert(!JSON.stringify(logs).includes('secret')); assert(logs.includes('AI_INTERNAL_ERROR'));
});

test('does not spend if the request was cancelled and cancels a pending body read', async () => {
  let calls = 0;
  const controller = new AbortController(); controller.abort();
  await jsonError(await handler({ infer: async () => { calls++; } })(request(offer, { signal: controller.signal })), 499, 'REQUEST_CANCELLED');
  const pending = new AbortController();
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } });
  const response = handler({ infer: async () => { calls++; } })(new Request(origin + '/api/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: pending.signal, body: stream, duplex: 'half' }));
  await new Promise((resolve) => setTimeout(resolve, 5)); pending.abort();
  await jsonError(await response, 499, 'REQUEST_CANCELLED'); assert.equal(calls, 0);
});

test('sets no-store and nosniff on success and failure responses', async () => {
  for (const response of [await handler()(request()), await handler()(new Request(origin + '/api/ai', { method: 'OPTIONS' }))]) {
    assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert(response.headers.get('content-type').startsWith('application/json'));
  }
});
