import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSessionHandler } from '../api/session.js';

const env = {
  APP_ORIGIN: 'https://casebook.example',
  GITHUB_CLIENT_ID: 'test-client',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  SESSION_SECRET: 'a synthetic signing key only for the test',
};
const origin = env.APP_ORIGIN;
const path = `${origin}/api/session`;

function request(query = '', options = {}) {
  return new Request(path + query, options);
}

function pair(setCookie) {
  return setCookie.split(';')[0];
}

async function start(handler) {
  const result = await handler(request('?action=login'));
  assert.equal(result.status, 303);
  const authorization = new URL(result.headers.get('Location'));
  const state = result.headers.getSetCookie()[0];
  assert.equal(authorization.origin, 'https://github.com');
  assert.equal(authorization.searchParams.get('redirect_uri'), path);
  assert.equal(authorization.searchParams.get('scope'), '');
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.match(state, /^__Host-mc-oauth=/);
  assert.match(state, /Path=\/; Max-Age=600; HttpOnly; Secure; SameSite=Lax/);
  return { authorization, state, nonce: authorization.searchParams.get('state') };
}

test('missing settings or a deployment alias keeps the guest demo independent of GitHub', async () => {
  const disabled = createSessionHandler({ env: {} });
  assert.deepEqual(await (await disabled(request())).json(), { enabled: false });
  assert.equal((await disabled(request('?action=login'))).status, 404);
  const enabled = createSessionHandler({ env });
  assert.deepEqual(await (await enabled(new Request('https://unrelated.example/api/session'))).json(), { enabled: false });
  assert.deepEqual(await (await enabled(request())).json(), { enabled: true, user: null });
});

test('OAuth callback exchanges a matching S256 verifier and emits a signed identity-only cookie', async () => {
  const accessToken = 'test-provider-token';
  const payloads = [];
  let now = Date.UTC(2026, 2, 1);
  const handler = createSessionHandler({ env, clock: () => now, send: async (url, options) => {
    payloads.push({ url, options });
    if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: accessToken });
    return Response.json({ id: 42, login: 'reviewer', email: 'personal@example.test' });
  } });
  const { state, nonce, authorization } = await start(handler);
  const callback = await handler(request(`?code=valid-code&state=${nonce}`, { headers: { Cookie: pair(state) } }));
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('Location'), `${origin}/?account=connected`);
  const [clearState, session] = callback.headers.getSetCookie();
  assert.match(clearState, /Max-Age=0/);
  assert.match(session, /^__Host-mc-session=/);
  assert.match(session, /Path=\/; Max-Age=28800; HttpOnly; Secure; SameSite=Lax/);
  assert.equal(payloads[0].options.body.get('redirect_uri'), path);
  const verifier = payloads[0].options.body.get('code_verifier');
  assert.equal(createHash('sha256').update(verifier).digest('base64url'), authorization.searchParams.get('code_challenge'));
  assert.equal(payloads[1].url, 'https://api.github.com/user');
  assert.equal(payloads[1].options.headers.Authorization, `Bearer ${accessToken}`);
  const signed = pair(session).slice('__Host-mc-session='.length);
  assert.doesNotMatch(Buffer.from(signed.split('.')[0], 'base64url').toString(), /provider-token|personal@example/);
  const check = await handler(request('', { headers: { Cookie: pair(session) } }));
  assert.match(check.headers.get('Cache-Control'), /no-store/);
  assert.deepEqual(await check.json(), { enabled: true, user: { id: 42, login: 'reviewer', provider: 'github' } });
  const bad = await handler(request('', { headers: { Cookie: pair(session) + 'extra' } }));
  assert.deepEqual(await bad.json(), { enabled: true, user: null });
  now += 8 * 60 * 60 * 1000;
  const expired = await handler(request('', { headers: { Cookie: pair(session) } }));
  assert.deepEqual(await expired.json(), { enabled: true, user: null });
});

test('invalid, duplicate or expired OAuth state never reaches the provider', async () => {
  let sent = 0;
  let now = Date.UTC(2026, 2, 1);
  const handler = createSessionHandler({ env, clock: () => now, send: async () => { sent++; } });
  const { state, nonce } = await start(handler);
  for (const [query, headers] of [
    [`?code=one&state=${nonce}`, {}],
    ['?code=one&state=forged', { Cookie: pair(state) }],
    [`?code=one&state=${nonce}&state=duplicate`, { Cookie: pair(state) }],
  ]) {
    const response = await handler(request(query, { headers }));
    assert.equal(response.headers.get('Location'), `${origin}/?account=retry`);
    assert.equal(response.headers.getSetCookie().length, 1);
  }
  now += 10 * 60 * 1000;
  const response = await handler(request(`?code=one&state=${nonce}`, { headers: { Cookie: pair(state) } }));
  assert.equal(response.headers.get('Location'), `${origin}/?account=retry`);
  assert.equal(sent, 0);
});

test('logout requires same-origin POST with the custom header', async () => {
  const handler = createSessionHandler({ env });
  assert.equal((await handler(request('?action=logout'))).status, 405);
  for (const headers of [{ Origin: origin }, { Origin: 'https://foreign.example', 'X-Mission-Control-Signout': '1' }]) {
    const denied = await handler(request('?action=logout', { method: 'POST', headers }));
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.getSetCookie().length, 0);
  }
  const logout = await handler(request('?action=logout', { method: 'POST',
    headers: { Origin: origin, 'X-Mission-Control-Signout': '1' } }));
  assert.equal(logout.status, 204);
  assert.equal(logout.headers.getSetCookie().length, 2);
  assert.ok(logout.headers.getSetCookie().every(value => value.includes('Max-Age=0')));
});
