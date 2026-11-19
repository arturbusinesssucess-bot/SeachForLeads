import { readLeadContact } from '../shared/lead-contact.mjs';
import { verifyAIUser } from '../server/ai-auth.mjs';

const limit = 10;
const states = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));

function validText(value, max) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function readCriteria(input) {
  if (!input || !validText(input.niche, 100) || !states.has(input.state) || !validText(input.stateName, 45)
    || !Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > limit) return null;
  if (input.cityId === null ? input.cityName !== null
    : !Number.isInteger(input.cityId) || !/^\d{7}$/.test(String(input.cityId)) || !validText(input.cityName, 75)) return null;
  return { niche: input.niche.trim(), state: input.state, stateName: input.stateName.trim(),
    cityId: input.cityId, cityName: input.cityName?.trim() ?? null, quantity: input.quantity };
}

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

async function fetchVPSResults(criteria, env, fetchSearch) {
  const url = new URL(env.LEAD_SEARCH_URL);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid-search-url');
  const headers = { 'Content-Type': 'application/json' };
  if (env.LEAD_SEARCH_TOKEN) headers.Authorization = `Bearer ${env.LEAD_SEARCH_TOKEN}`;
  const response = await fetchSearch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(criteria),
    redirect: 'error',
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error('search-upstream');
  const { leads } = await response.json();
  if (!Array.isArray(leads)) throw new Error('invalid-search-results');
  const results = new Map();
  for (const lead of leads.slice(0, criteria.quantity)) {
    if (!validText(lead?.id, 300) || !validText(lead.company, 160) || !validText(lead.location, 100)) {
      throw new Error('invalid-search-result');
    }
    const id = `vps:${lead.id.trim()}`;
    results.set(id, {
      id,
      company: lead.company.trim(),
      location: lead.location.trim(),
      category: validText(lead.category, 100) ? lead.category.trim() : criteria.niche,
      ...readLeadContact(lead),
      stage: 'new',
      contacted: false,
    });
  }
  return [...results.values()];
}

export function createSearchTrialHandler({ authenticate = verifyAIUser, env = process.env, fetchSearch = fetch } = {}) {
  return async function searchTrial(request) {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    try {
      await authenticate(request, { allowedEmails: env.SEARCH_TRIAL_ALLOWED_EMAILS });
      const mode = env.LEAD_SEARCH_URL ? 'live' : 'trial';
      if (request.method === 'GET') return Response.json({ available: true, mode }, { headers });
      const criteria = readCriteria(await request.json().catch(() => null));
      if (!criteria) return Response.json({ error: 'invalid-search' }, { status: 400, headers });
      if (mode === 'trial') return Response.json({ mode, leads: makeResults(criteria) }, { headers });
      try {
        return Response.json({ mode, leads: await fetchVPSResults(criteria, env, fetchSearch) }, { headers });
      } catch {
        return Response.json({ error: 'search-unavailable' }, { status: 502, headers });
      }
    } catch (error) {
      const status = [401, 403, 503].includes(error?.status) ? error.status : 500;
      return Response.json({ available: false }, { status, headers });
    }
  };
}

export const GET = createSearchTrialHandler();
export const POST = GET;
