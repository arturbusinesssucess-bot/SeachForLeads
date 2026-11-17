import { createRemoteJWKSet, decodeProtectedHeader, jwtVerify } from 'jose';
import { AIError } from './ai-core.mjs';

const publicKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'), { timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 300000 });
const invalidSession = () => new AIError(401, 'AUTH_INVALID', 'Sua sessão expirou ou é inválida. Entre novamente.');

export function createAuthVerifier({ projectId = 'seachforleads', keys = publicKeys } = {}) {
  return async function authenticate(request, { allowedEmails, currentDate = new Date() } = {}) {
    const authorization = request.headers.get('authorization');
    if (!authorization || authorization.length > 8192) throw new AIError(401, 'AUTH_REQUIRED', 'Entre na sua conta para usar a análise por IA.');
    const bearer = /^Bearer ([^\s]+)$/iu.exec(authorization);
    if (!bearer) throw invalidSession();
    let payload;
    try {
      const header = decodeProtectedHeader(bearer[1]);
      if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid.trim()) throw invalidSession();
      ({ payload } = await jwtVerify(bearer[1], keys, { algorithms: ['RS256'], issuer: `https://securetoken.google.com/${projectId}`, audience: projectId, requiredClaims: ['exp', 'iat', 'auth_time', 'sub'], currentDate }));
      const now = Math.floor(currentDate.getTime() / 1000);
      if (!Number.isFinite(now) || payload.aud !== projectId || !Number.isInteger(payload.exp) || payload.exp <= now || !Number.isInteger(payload.iat) || payload.iat < 0 || payload.iat > now || !Number.isInteger(payload.auth_time) || payload.auth_time < 0 || payload.auth_time > now || typeof payload.sub !== 'string' || !payload.sub.trim() || payload.sub.length > 128) throw invalidSession();
    } catch {
      throw invalidSession();
    }
    const allowlist = new Set(typeof allowedEmails === 'string' ? allowedEmails.split(',').map((email) => email.trim().toLocaleLowerCase('en-US')).filter(Boolean) : []);
    if (!allowlist.size) throw new AIError(503, 'AI_NOT_CONFIGURED', 'A análise por IA ainda não está disponível.');
    const email = typeof payload.email === 'string' ? payload.email.trim().toLocaleLowerCase('en-US') : '';
    if (!email || payload.email_verified !== true || !allowlist.has(email)) throw new AIError(403, 'AI_ACCESS_DENIED', 'A análise por IA ainda não está liberada para esta conta.');
    return { uid: payload.sub, email };
  };
}

export const verifyAIUser = createAuthVerifier();
