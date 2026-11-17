import { AIError, runAI, validateInput } from './ai-core.mjs';
import { verifyAIUser } from './ai-auth.mjs';

const MAX_BODY_BYTES = 16384;
const DEFAULT_MODEL = 'google/gemini-2.5-flash';
const RESPONSE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const cancelled = () => new AIError(499, 'REQUEST_CANCELLED', 'A solicitação foi cancelada.');
const invalidJSON = () => new AIError(400, 'INVALID_JSON', 'Não foi possível ler os dados enviados. Revise e tente novamente.');
const tooLarge = () => new AIError(413, 'BODY_TOO_LARGE', 'Os dados enviados são muito grandes. Reduza o texto ou a quantidade de leads.');

async function readJSON(request) {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    if (!/^\d+$/u.test(declared)) throw invalidJSON();
    if (!Number.isSafeInteger(Number(declared)) || Number(declared) > MAX_BODY_BYTES) throw tooLarge();
  }
  if (request.signal.aborted) throw cancelled();
  const reader = request.body?.getReader();
  if (!reader) throw invalidJSON();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let raw = '';
  const stop = () => { reader.cancel().catch(() => {}); };
  request.signal.addEventListener('abort', stop, { once: true });
  try {
    while (true) {
      if (request.signal.aborted) throw cancelled();
      const { done, value } = await reader.read();
      if (request.signal.aborted) throw cancelled();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { stop(); throw tooLarge(); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
    try { return JSON.parse(raw); } catch { throw invalidJSON(); }
  } catch (error) {
    if (request.signal.aborted) throw cancelled();
    if (error instanceof AIError) throw error;
    stop();
    throw invalidJSON();
  } finally {
    request.signal.removeEventListener('abort', stop);
    reader.releaseLock();
  }
}

export function createAIHandler({ env = process.env, authenticate = verifyAIUser, infer = runAI, log = (code) => console.error(code) } = {}) {
  return async function handleAI(request) {
    let allow = false;
    try {
      if (request.method !== 'GET' && request.method !== 'POST') { allow = true; throw new AIError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.'); }
      if (request.signal.aborted) throw cancelled();
      const origin = request.headers.get('origin');
      if (origin && origin !== new URL(request.url).origin) throw new AIError(403, 'ORIGIN_NOT_ALLOWED', 'Abra o app para usar a análise por IA.');
      await authenticate(request, { allowedEmails: env.AI_ALLOWED_EMAILS });
      if (request.signal.aborted) throw cancelled();
      const apiKey = typeof env.OPENROUTER_API_KEY === 'string' ? env.OPENROUTER_API_KEY.trim() : '';
      const model = env.OPENROUTER_MODEL || DEFAULT_MODEL;
      if (!apiKey || typeof model !== 'string' || !model.trim() || model.length > 200 || /\s/u.test(model)) throw new AIError(503, 'AI_NOT_CONFIGURED', 'A análise por IA ainda não está disponível.');
      if (request.method === 'GET') return Response.json({ available: true, maxLeads: 5 }, { headers: RESPONSE_HEADERS });
      const contentType = request.headers.get('content-type')?.split(';')[0].trim().toLocaleLowerCase('en-US');
      if (contentType !== 'application/json') throw new AIError(415, 'CONTENT_TYPE_REQUIRED', 'Envie os dados no formato JSON.');
      const input = validateInput(await readJSON(request));
      if (request.signal.aborted) throw cancelled();
      const output = await infer(input, { apiKey, model, signal: request.signal });
      if (request.signal.aborted) throw cancelled();
      return Response.json(output, { headers: RESPONSE_HEADERS });
    } catch (error) {
      const failure = request.signal.aborted ? cancelled() : error instanceof AIError ? error : new AIError(500, 'AI_INTERNAL_ERROR', 'Não foi possível concluir a análise. Tente novamente.');
      if (failure.status >= 500) { try { log(failure.code); } catch {} }
      return Response.json({ error: { code: failure.code, message: failure.message } }, { status: failure.status, headers: { ...RESPONSE_HEADERS, ...(allow ? { Allow: 'GET, POST' } : {}) } });
    }
  };
}

export const handleAI = createAIHandler();
