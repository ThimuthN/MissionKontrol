import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const stateCookie = '__Host-mc-oauth';
const sessionCookie = '__Host-mc-session';
const stateSeconds = 10 * 60;
const sessionSeconds = 8 * 60 * 60;
const authorizeUrl = 'https://github.com/login/oauth/authorize';
const tokenUrl = 'https://github.com/login/oauth/access_token';
const profileUrl = 'https://api.github.com/user';
const commonHeaders = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff' };

function configuration(env) {
  const { APP_ORIGIN, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET } = env;
  if (!APP_ORIGIN || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET || SESSION_SECRET?.length < 32 || !SESSION_SECRET) return null;
  try {
    const site = new URL(APP_ORIGIN);
    if (site.protocol !== 'https:' || site.href !== `${site.origin}/`) return null;
    return {
      origin: site.origin,
      callback: `${site.origin}/api/session`,
      clientId: GITHUB_CLIENT_ID,
      clientSecret: GITHUB_CLIENT_SECRET,
      secret: SESSION_SECRET,
    };
  } catch {
    return null;
  }
}

function json(body, status = 200, additionalHeaders = {}) {
  return Response.json(body, { status, headers: { ...commonHeaders, ...additionalHeaders } });
}

function redirect(target, cookies) {
  const headers = new Headers({ ...commonHeaders, Location: String(target) });
  for (const value of cookies) headers.append('Set-Cookie', value);
  return new Response(null, { status: 303, headers });
}

function cookie(name, value, seconds) {
  return `${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(request, name) {
  const candidates = (request.headers.get('cookie') ?? '').split(';').map(item => item.trim())
    .filter(item => item.startsWith(`${name}=`));
  return candidates.length === 1 ? candidates[0].slice(name.length + 1) : '';
}

function signature(secret, purpose, encoded) {
  return createHmac('sha256', secret).update(`${purpose}:${encoded}`).digest('base64url');
}

function sign(secret, purpose, payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encoded}.${signature(secret, purpose, encoded)}`;
}

function equal(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verify(secret, purpose, value, now) {
  if (value.length > 2048 || !/^[\w-]+\.[\w-]+$/.test(value)) return null;
  const [encoded, mac] = value.split('.');
  if (!equal(mac, signature(secret, purpose, encoded))) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return Number.isSafeInteger(payload?.expires) && payload.expires > now ? payload : null;
  } catch {
    return null;
  }
}

function githubProfile(profile) {
  if (!Number.isSafeInteger(profile?.id) || profile.id < 1 || typeof profile.login !== 'string' ||
    !/^[a-z\d][a-z\d-]{0,38}$/iu.test(profile.login)) return null;
  return { id: profile.id, login: profile.login, provider: 'github' };
}

async function identify(config, code, verifier, send) {
  const response = await send(tokenUrl, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId, client_secret: config.clientSecret, code,
      code_verifier: verifier, redirect_uri: config.callback,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const token = (await response.json()).access_token;
  if (typeof token !== 'string' || !token || token.length > 1024 || /\s/u.test(token)) return null;
  const user = await send(profileUrl, {
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`,
      'User-Agent': 'Mission-Control' },
    redirect: 'error',
    signal: AbortSignal.timeout(8000),
  });
  return user.ok ? githubProfile(await user.json()) : null;
}

function beginLogin(config, now) {
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  const authorize = new URL(authorizeUrl);
  authorize.search = new URLSearchParams({
    client_id: config.clientId, redirect_uri: config.callback, scope: '',
    state: nonce, code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
  }).toString();
  const state = sign(config.secret, 'oauth', { nonce, verifier, expires: now + stateSeconds * 1000 });
  return redirect(authorize, [cookie(stateCookie, state, stateSeconds)]);
}

async function finishLogin(config, url, request, send, now) {
  const clearState = cookie(stateCookie, '', 0);
  const state = verify(config.secret, 'oauth', readCookie(request, stateCookie), now);
  const nonce = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || !nonce || !equal(nonce, state.nonce) || !code || code.length > 1024 ||
    url.searchParams.has('error') || url.searchParams.getAll('state').length !== 1 ||
    url.searchParams.getAll('code').length !== 1) {
    return redirect(`${config.origin}/?account=retry`, [clearState]);
  }
  try {
    const profile = await identify(config, code, state.verifier, send);
    if (profile) {
      const session = sign(config.secret, 'session', { profile, expires: now + sessionSeconds * 1000 });
      return redirect(`${config.origin}/?account=connected`, [clearState, cookie(sessionCookie, session, sessionSeconds)]);
    }
  } catch {
    // The user sees a retry option without provider errors or tokens.
  }
  return redirect(`${config.origin}/?account=retry`, [clearState]);
}

export function createSessionHandler({ env = process.env, send = fetch, clock = Date.now } = {}) {
  return async request => {
    const url = new URL(request.url);
    const config = configuration(env);
    const action = url.searchParams.get('action');
    if (request.method === 'GET' && !action && !url.searchParams.has('code') &&
      !url.searchParams.has('state') && !url.searchParams.has('error')) {
      if (!config || url.origin !== config.origin) return json({ enabled: false });
      const session = verify(config.secret, 'session', readCookie(request, sessionCookie), clock());
      return json({ enabled: true, user: githubProfile(session?.profile) });
    }
    if (!config || url.origin !== config.origin) return json({ error: 'Sign-in is unavailable here.' }, 404);
    if (request.method === 'GET' && action === 'login') return beginLogin(config, clock());
    if (request.method === 'GET' && !action) return finishLogin(config, url, request, send, clock());
    if (request.method === 'POST' && action === 'logout') {
      if (request.headers.get('Origin') !== config.origin || request.headers.get('X-Mission-Control-Signout') !== '1') {
        return json({ error: 'Sign-out must start on this site.' }, 403);
      }
      const headers = new Headers(commonHeaders);
      headers.append('Set-Cookie', cookie(sessionCookie, '', 0));
      headers.append('Set-Cookie', cookie(stateCookie, '', 0));
      return new Response(null, { status: 204, headers });
    }
    return json({ error: 'Unsupported session request.' }, 405, { Allow: 'GET, POST' });
  };
}

export default { fetch: createSessionHandler() };
