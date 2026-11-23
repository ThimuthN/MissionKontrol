const endpoint = '/api/session';
const accountsKey = 'mission-control:local-accounts:v1';
const activeAccountKey = 'mission-control:active-local-account';
const passwordIterations = 210_000;

let mounted = false;
let accessEnabled = false;
let accessDialog;
let accountControl;
let readyResolver;
let workspaceUnlocked = false;
export let currentReviewer;
export let currentReviewerId;

function element(tag, classes, text) {
  const node = document.createElement(tag);
  if (classes) node.className = classes;
  if (text) node.textContent = text;
  return node;
}

function accountResult() {
  const url = new URL(location.href);
  const state = url.searchParams.get('account');
  if (state === 'connected' || state === 'retry') {
    url.searchParams.delete('account');
    history.replaceState(history.state, '', url);
    return state;
  }
  return null;
}

function profiles(storage = localStorage) {
  try {
    const items = JSON.parse(storage.getItem(accountsKey) ?? '[]');
    return Array.isArray(items) ? items.filter(item => item?.email && item?.salt && item?.digest) : [];
  } catch { return []; }
}

export function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

export async function passwordDigest(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', iterations: passwordIterations,
    salt: Uint8Array.from(atob(salt), char => char.charCodeAt(0)),
  }, key, 256);
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function createLocalProfile(name, email, password, storage = localStorage, appearance = 'light') {
  const existing = profiles(storage);
  if (existing.some(item => item.email === email)) throw new Error('An account with this email already exists. Try signing in.');
  const displayName = name.trim();
  if (!displayName) throw new Error('Add your name to continue.');
  if (password.length < 10) throw new Error('Use a password with at least 10 characters.');
  const salt = randomSalt();
  const profile = { email, name: displayName, salt, digest: await passwordDigest(password, salt),
    appearance: appearance === 'dark' ? 'dark' : 'light', createdAt: new Date().toISOString() };
  storage.setItem(accountsKey, JSON.stringify([...existing, profile]));
  return profile;
}

export async function signInLocalProfile(email, password, storage = localStorage) {
  const profile = profiles(storage).find(item => item.email === email);
  if (!profile || (await passwordDigest(password, profile.salt)) !== profile.digest)
    throw new Error('Email or password did not match an account on this device.');
  return profile;
}

function finishAuthentication(user) {
  currentReviewer = user.kind === 'github' ? user.login : user.name;
  currentReviewerId = user.kind === 'github' ? `github:${user.login}` : `local:${user.email}`;
  render(accountControl, user);
  if (user.kind === 'local' && user.appearance && document.documentElement.dataset.theme !== user.appearance)
    document.dispatchEvent(new CustomEvent('mission-theme-request', { detail: { theme: user.appearance } }));
  if (accessDialog?.open) accessDialog.close();
  if (readyResolver) {
    const resolve = readyResolver;
    readyResolver = null;
    workspaceUnlocked = true;
    resolve();
  } else if (workspaceUnlocked) {
    // Remount the data under the next account's review namespace.
    location.reload();
  }
}

function accessPrompt() {
  if (accessDialog) return accessDialog;
  const dialog = document.createElement('dialog');
  dialog.className = 'access-dialog';
  dialog.setAttribute('aria-labelledby', 'access-title');
  dialog.innerHTML = `
    <div class="access-layout">
      <section class="access-story" aria-label="Mission Control workspace">
        <div class="access-brand"><span class="mark" aria-hidden="true"></span>Mission Control</div>
        <p class="access-eyebrow">KEEP WORK MOVING</p>
        <h2>Follow the<br>handoff.</h2>
        <p>A message in Teams. An approval somewhere else. Piece together what the records show—and leave room for what they don't.</p>
        <div class="access-path" aria-hidden="true"><span>Find a case</span><i></i><span>Check the sources</span><i></i><span>Leave a decision</span></div>
      </section>
      <section class="access-panel">
        <button class="access-theme-toggle" type="button" aria-label="Switch color theme" title="Switch color theme"></button>
        <p class="access-eyebrow">YOUR WORKSPACE</p>
        <h2 id="access-title">Welcome back.</h2>
        <p class="access-description">Sign in to pick up your reviews where you left off.</p>
        <div class="access-modes" role="group" aria-label="Account access">
          <button type="button" class="access-mode" data-access-mode="sign-in" aria-pressed="true">Sign in</button>
          <button type="button" class="access-mode" data-access-mode="sign-up" aria-pressed="false">Create account</button>
        </div>
        <form id="access-form">
          <label class="access-field signup-only">Your name
            <input name="displayName" type="text" autocomplete="name" maxlength="80" placeholder="Alex Morgan">
          </label>
          <label class="access-field">Email address
            <input name="email" type="email" autocomplete="email" placeholder="you@company.com" maxlength="254" required>
          </label>
          <label class="access-field">Password
            <span class="access-password-wrap">
              <input name="password" type="password" autocomplete="current-password" minlength="10" placeholder="At least 10 characters" required>
              <button class="access-show-password" type="button" aria-label="Show password">Show</button>
            </span>
          </label>
          <fieldset class="access-preference signup-only">
            <legend>Choose your look</legend>
            <div class="access-preference-options" role="group" aria-label="Color preference">
              <button type="button" data-appearance="light" aria-pressed="false"><span class="appearance-swatch swatch-light" aria-hidden="true"></span>Light</button>
              <button type="button" data-appearance="dark" aria-pressed="false"><span class="appearance-swatch swatch-dark" aria-hidden="true"></span>Dark</button>
            </div>
            <p>You can change this anytime.</p>
          </fieldset>
          <p class="access-error" role="alert" hidden></p>
          <button class="access-submit" type="submit">Sign in</button>
        </form>
        <div class="access-github-area">
          <p class="access-divider"><span>or</span></p>
          <a class="access-github" href="/api/session?action=login"><span class="access-github-mark" aria-hidden="true">GH</span> Continue with GitHub</a>
        </div>
        <p class="access-privacy">Accounts and review notes stay in this browser. They don't sync between devices or grant shared team access.</p>
      </section>
    </div>`;
  dialog.addEventListener('cancel', event => event.preventDefault());

  const form = dialog.querySelector('#access-form');
  const error = dialog.querySelector('.access-error');
  const submit = dialog.querySelector('.access-submit');
  const password = form.querySelector('[name="password"]');
  const name = form.querySelector('[name="displayName"]');
  const showPassword = dialog.querySelector('.access-show-password');
  dialog.querySelector('.access-theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
    document.dispatchEvent(new CustomEvent('mission-theme-request', { detail: { theme } }));
  });

  function selectMode(mode) {
    const signUp = mode === 'sign-up';
    dialog.dataset.mode = mode;
    dialog.querySelector('#access-title').textContent = signUp ? 'Start your workspace.' : 'Welcome back.';
    dialog.querySelector('.access-description').textContent = signUp
      ? 'Create an account to save your decisions and return to them later.'
      : 'Sign in to pick up your reviews where you left off.';
    submit.textContent = signUp ? 'Create account' : 'Sign in';
    name.required = signUp;
    password.autocomplete = signUp ? 'new-password' : 'current-password';
    dialog.querySelectorAll('[data-access-mode]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.accessMode === mode)));
    error.hidden = true;
    form.reset();
    dialog.dataset.appearance = '';
    dialog.querySelectorAll('[data-appearance]').forEach(button => button.setAttribute('aria-pressed', 'false'));
    password.type = 'password';
    showPassword.textContent = 'Show';
    showPassword.setAttribute('aria-label', 'Show password');
  }
  dialog.querySelectorAll('[data-access-mode]').forEach(button => button.addEventListener('click', () => selectMode(button.dataset.accessMode)));
  function setAppearance(choice, animate = true) {
    dialog.dataset.appearance = choice;
    dialog.querySelectorAll('[data-appearance]').forEach(button =>
      button.setAttribute('aria-pressed', String(button.dataset.appearance === choice)));
    if (animate && document.documentElement.dataset.theme !== choice)
      document.dispatchEvent(new CustomEvent('mission-theme-request', { detail: { theme: choice } }));
  }
  dialog.querySelectorAll('[data-appearance]').forEach(button => button.addEventListener('click', () => setAppearance(button.dataset.appearance)));
  document.addEventListener('mission-theme-changed', event => {
    if (dialog.open && dialog.dataset.mode === 'sign-up') setAppearance(event.detail.theme, false);
  });
  showPassword.addEventListener('click', () => {
    const visible = password.type === 'text';
    password.type = visible ? 'password' : 'text';
    showPassword.textContent = visible ? 'Show' : 'Hide';
    showPassword.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const email = form.querySelector('[name="email"]').value.trim().toLowerCase();
    const passphrase = password.value;
    error.hidden = true;
    submit.disabled = true;
    submit.textContent = 'One moment…';
    try {
      if (!crypto?.subtle) throw new Error('Secure local accounts are not available in this browser.');
      let profile;
      if (dialog.dataset.mode === 'sign-up') {
        if (!dialog.dataset.appearance) throw new Error('Choose a light or dark appearance to continue.');
        profile = await createLocalProfile(name.value, email, passphrase, localStorage, dialog.dataset.appearance);
      } else {
        profile = await signInLocalProfile(email, passphrase);
      }
      sessionStorage.setItem(activeAccountKey, profile.email);
      password.value = '';
      finishAuthentication({ kind: 'local', email: profile.email, name: profile.name, appearance: profile.appearance });
    } catch (problem) {
      error.textContent = problem instanceof Error ? problem.message : 'Could not access this account. Please try again.';
      error.hidden = false;
    } finally {
      submit.disabled = false;
      submit.textContent = dialog.dataset.mode === 'sign-up' ? 'Create account' : 'Sign in';
    }
  });
  document.body.append(dialog);
  accessDialog = dialog;
  dialog.classList.toggle('access-enabled', accessEnabled);
  selectMode(profiles().length ? 'sign-in' : 'sign-up');
  return dialog;
}

function showAccess(message = '') {
  const dialog = accessPrompt();
  dialog.classList.toggle('access-enabled', accessEnabled);
  dialog.querySelector(profiles().length ? '[data-access-mode="sign-in"]' : '[data-access-mode="sign-up"]').click();
  dialog.querySelector('.access-error').textContent = message;
  dialog.querySelector('.access-error').hidden = !message;
  if (!dialog.open) dialog.showModal();
}

function render(control, user) {
  if (!user) {
    const signIn = element('button', 'nav-button account-link', 'Sign in');
    signIn.type = 'button';
    signIn.addEventListener('click', () => showAccess());
    control.replaceChildren(signIn);
    return;
  }
  const menu = element('details', 'account-menu');
  const visibleName = user.kind === 'github' ? `@${user.login}` : user.name;
  const handle = element('summary', 'nav-button account-handle', visibleName);
  handle.setAttribute('aria-label', `Account menu for ${visibleName}`);
  const body = element('div', 'account-panel');
  const heading = element('strong', '', user.kind === 'github' ? 'Connected with GitHub' : 'Your local account');
  const note = element('p', '', user.kind === 'github' ? 'Your review notes stay on this device.' : user.email);
  const signOut = element('button', 'secondary', 'Sign out');
  signOut.type = 'button';
  const status = element('span', 'account-status');
  status.setAttribute('role', 'status');
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    try {
      if (user.kind === 'github') {
        const response = await fetch(`${endpoint}?action=logout`, {
          method: 'POST', headers: { 'X-Mission-Control-Signout': '1' }, credentials: 'same-origin',
        });
        if (!response.ok) throw new Error('Sign-out failed');
      } else sessionStorage.removeItem(activeAccountKey);
      currentReviewer = undefined;
      currentReviewerId = undefined;
      render(control, null);
      showAccess();
    } catch {
      signOut.disabled = false;
      status.textContent = 'Could not sign out. Try again.';
    }
  });
  body.append(heading, note, signOut, status);
  menu.append(handle, body);
  menu.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !menu.open) return;
    event.stopPropagation();
    menu.open = false;
    handle.focus();
  });
  control.replaceChildren(menu);
}

export async function mountAccount() {
  const actions = document.querySelector('.top-actions');
  if (!actions || mounted) return;
  mounted = true;
  accountControl = element('div', 'account-control');
  actions.append(accountControl);
  const result = accountResult();
  let user;
  try {
    const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
    if (response.ok) {
      const session = await response.json();
      accessEnabled = session.enabled === true;
      if (accessEnabled && session.user?.login) user = { kind: 'github', login: session.user.login };
    }
  } catch { /* The local account path works when the OAuth endpoint is absent. */ }
  if (!user) {
    try {
      const email = sessionStorage.getItem(activeAccountKey);
      const profile = profiles().find(item => item.email === email);
      if (profile) user = { kind: 'local', email: profile.email, name: profile.name, appearance: profile.appearance };
    } catch { /* Storage may be unavailable; the form will report the problem. */ }
  }
  if (user) {
    currentReviewer = user.kind === 'github' ? user.login : user.name;
    currentReviewerId = user.kind === 'github' ? `github:${user.login}` : `local:${user.email}`;
    render(accountControl, user);
    if (user.kind === 'local' && user.appearance && document.documentElement.dataset.theme !== user.appearance)
      document.dispatchEvent(new CustomEvent('mission-theme-request', { detail: { theme: user.appearance } }));
    workspaceUnlocked = true;
    return;
  }
  render(accountControl, null);
  const ready = new Promise(resolve => { readyResolver = resolve; });
  showAccess(result === 'retry' ? 'GitHub sign-in did not finish. You can use an account on this device.' : '');
  await ready;
}

if (typeof document !== 'undefined') {
  document.addEventListener('mission-theme-changed', event => {
    try {
      const email = sessionStorage.getItem(activeAccountKey);
      if (!email) return;
      const stored = profiles();
      const profile = stored.find(item => item.email === email);
      if (!profile) return;
      profile.appearance = event.detail.theme;
      localStorage.setItem(accountsKey, JSON.stringify(stored));
    } catch { /* Appearance remains in the general browser preference. */ }
  });
}
