import { verifyAIUser } from '../server/ai-auth.mjs';

export function createSearchTrialHandler({ authenticate = verifyAIUser, env = process.env } = {}) {
  return async function GET(request) {
    const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
    try {
      await authenticate(request, { allowedEmails: env.SEARCH_TRIAL_ALLOWED_EMAILS });
      return Response.json({ available: true }, { headers });
    } catch (error) {
      const status = [401, 403, 503].includes(error?.status) ? error.status : 500;
      return Response.json({ available: false }, { status, headers });
    }
  };
}

export const GET = createSearchTrialHandler();
