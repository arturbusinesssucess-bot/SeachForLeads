import test from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { createAuthVerifier } from './ai-auth.mjs';
import { AIError } from './ai-core.mjs';

const currentDate = new Date('2026-11-17T15:00:00Z');
const now = Math.floor(currentDate.getTime() / 1000);
const { privateKey, publicKey } = await generateKeyPair('RS256');
const publicJWK = { ...await exportJWK(publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
const keys = createLocalJWKSet({ keys: [publicJWK] });
const verify = createAuthVerifier({ keys });
const claims = { iss: 'https://securetoken.google.com/seachforleads', aud: 'seachforleads', sub: 'owner-uid', iat: now - 60, exp: now + 3000, auth_time: now - 120, email: 'artur.business.sucess@gmail.com', email_verified: true };
const token = (payload = {}, header = {}) => new SignJWT({ ...claims, ...payload }).setProtectedHeader({ alg: 'RS256', kid: 'test-key', ...header }).sign(privateKey);
const request = (value) => new Request('https://searchforleads.vercel.app/api/ai', { headers: value ? { Authorization: value } : {} });
const options = { currentDate, allowedEmails: ' Artur.Business.Sucess@gmail.com , second@example.com ' };
const error = (status, code) => (value) => value instanceof AIError && value.status === status && (!code || value.code === code);

test('verifies signed Firebase tokens and normalizes an explicit server allowlist', async () => {
  assert.deepEqual(await verify(request(`Bearer ${await token()}`), options), { uid: 'owner-uid', email: 'artur.business.sucess@gmail.com' });
  assert.deepEqual(await verify(request(`bearer ${await token({ email: 'SECOND@example.com' })}`), options), { uid: 'owner-uid', email: 'second@example.com' });
});

test('requires a well-formed bearer token', async () => {
  for (const value of [undefined, 'Basic abc', 'Bearer', 'Bearer a b', 'Bearer invalid', `Bearer ${'x'.repeat(8193)}`]) await assert.rejects(verify(request(value), options), error(401));
});

test('rejects tokens with missing or unknown key ids', async () => {
  for (const kid of [undefined, '', 'unknown-key']) await assert.rejects(verify(request(`Bearer ${await token({}, { kid })}`), options), error(401));
});

test('does not accept unsigned tokens or alternate signing algorithms', async () => {
  const encoded = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encoded({ alg: 'none', kid: 'test-key' })}.${encoded(claims)}.`;
  await assert.rejects(verify(request(`Bearer ${unsigned}`), options), error(401));
  const hmac = await new SignJWT(claims).setProtectedHeader({ alg: 'HS256', kid: 'test-key' }).sign(new TextEncoder().encode('test-only-not-real-credential'));
  await assert.rejects(verify(request(`Bearer ${hmac}`), options), error(401));
});

test('rejects tokens from another project or with a mismatched issuer', async () => {
  for (const payload of [{ aud: 'another-project' }, { aud: ['seachforleads'] }, { iss: 'https://securetoken.google.com/another-project' }]) await assert.rejects(verify(request(`Bearer ${await token(payload)}`), options), error(401));
});

test('verifies the signature rather than trusting decoded claims', async () => {
  const parts = (await token()).split('.');
  parts[1] = Buffer.from(JSON.stringify({ ...claims, sub: 'forged-user' })).toString('base64url');
  await assert.rejects(verify(request(`Bearer ${parts.join('.')}`), options), error(401));
});

test('rejects expired, missing, noninteger and future temporal claims', async () => {
  for (const payload of [{ exp: now }, { exp: now - 1 }, { exp: undefined }, { exp: now + 0.5 }, { iat: now + 1 }, { iat: now - 0.5 }, { iat: undefined }, { iat: -1 }, { auth_time: now + 1 }, { auth_time: now - 0.5 }, { auth_time: undefined }, { auth_time: -1 }]) await assert.rejects(verify(request(`Bearer ${await token(payload)}`), options), error(401));
});

test('requires a nonempty Firebase UID of at most 128 characters', async () => {
  for (const sub of [undefined, '', '  ', 'x'.repeat(129), 123]) await assert.rejects(verify(request(`Bearer ${await token({ sub })}`), options), error(401));
});

test('requires a verified email and membership in the server allowlist', async () => {
  for (const email_verified of [undefined, false, 'true', 1]) await assert.rejects(verify(request(`Bearer ${await token({ email_verified })}`), options), error(403));
  for (const email of [undefined, '', 'stranger@example.com']) await assert.rejects(verify(request(`Bearer ${await token({ email })}`), options), error(403));
});

test('fails closed if the owner allowlist is missing or empty', async () => {
  for (const allowedEmails of [undefined, '', ' ,  , ']) await assert.rejects(verify(request(`Bearer ${await token()}`), { currentDate, allowedEmails }), error(503, 'AI_NOT_CONFIGURED'));
  await assert.rejects(verify(request(), { currentDate }), error(401));
});

test('does not expose the original token or verification details on failure', async () => {
  const raw = await token({ aud: 'private-project-marker' });
  await assert.rejects(verify(request(`Bearer ${raw}`), options), (value) => error(401)(value) && !value.message.includes(raw) && !value.message.includes('private-project-marker'));
});
