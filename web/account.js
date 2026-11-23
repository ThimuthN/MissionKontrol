const endpoint = '/api/session';
let mounted = false;
export let currentReviewer;
let accessDialog;
let accessEnabled = false;
const accessSeenKey = 'mission-control:reviewer-welcome';

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

function accessPrompt() {
  if (accessDialog) return accessDialog;
  const dialog = document.createElement('dialog');
  dialog.className = 'access-dialog';
  dialog.setAttribute('aria-labelledby', 'access-title');
  dialog.innerHTML = `
    <div class="access-layout">
      <section class="access-story" aria-label="How Mission Control works">
        <div class="access-brand"><span class="mark" aria-hidden="true"></span>Mission Control</div>
        <p class="access-eyebrow">PROOF BEFORE PROGRESS</p>
        <h2>Good work<br>leaves clues.</h2>
        <p>We piece together the trail across conversations, calendars and records. You decide what the evidence really proves.</p>
        <div class="access-path" aria-hidden="true"><span>Find the work</span><i></i><span>Inspect the record</span><i></i><span>Make the call</span></div>
      </section>
      <section class="access-panel">
        <button type="button" class="access-close" aria-label="Close sign-in dialog">×</button>
        <p class="access-eyebrow">REVIEWER ACCESS</p>
        <h2 id="access-title">Make yourself at home.</h2>
        <p class="access-description">Take a look around first, or sign in to attach your GitHub username to the review decisions you export.</p>
        <a class="access-github" href="/api/session?action=login"><span class="access-github-mark" aria-hidden="true">GH</span> Continue with GitHub</a>
        <button class="access-github-unavailable" type="button" disabled><span class="access-github-mark" aria-hidden="true">GH</span> GitHub sign-in not configured</button>
        <button class="access-guest" type="button">Explore the demo</button>
        <p class="access-note" role="status"></p>
        <p class="access-privacy">The public sample contains redacted records. Imports and review notes stay on this device.</p>
      </section>
    </div>`;
  const close = () => dialog.close();
  dialog.querySelector('.access-guest').addEventListener('click', close);
  dialog.querySelector('.access-close').addEventListener('click', close);
  dialog.addEventListener('close', () => {
    try { sessionStorage.setItem(accessSeenKey, 'yes'); } catch {}
  });
  document.body.append(dialog);
  accessDialog = dialog;
  return dialog;
}

function showAccess() {
  const dialog = accessPrompt();
  dialog.classList.toggle('access-enabled', accessEnabled);
  dialog.querySelector('.access-note').textContent = accessEnabled
    ? 'GitHub identifies the reviewer. It does not upload your workspace or notes.'
    : 'GitHub sign-in is waiting for the project owner to configure OAuth. The demo is ready to explore.';
  if (!dialog.open) dialog.showModal();
}

function maybeWelcome(user) {
  if (user || location.hash) return;
  try { if (sessionStorage.getItem(accessSeenKey) === 'yes') return; } catch {}
  if (!document.getElementById('case-lab')?.hidden) showAccess();
  else document.addEventListener('mission-ready', () => { if (!currentReviewer) showAccess(); }, { once: true });
}

function render(control, user, message = '') {
  currentReviewer = user?.login;
  const status = element('span', 'account-status sr-only');
  status.setAttribute('role', 'status');
  if (!user) {
    const signIn = element('button', 'nav-button account-link', message ? 'Sign-in help' : 'Sign in');
    signIn.type = 'button';
    signIn.addEventListener('click', showAccess);
    status.textContent = message;
    control.replaceChildren(signIn, status);
    return;
  }

  const menu = element('details', 'account-menu');
  const handle = element('summary', 'nav-button account-handle', `@${user.login}`);
  handle.setAttribute('aria-label', `GitHub account: ${user.login}`);
  const body = element('div', 'account-panel');
  const heading = element('strong', '', 'Signed in with GitHub');
  const note = element('p', '', 'Imports and review notes stay on this device.');
  const signOut = element('button', 'secondary', 'Sign out');
  signOut.type = 'button';
  signOut.addEventListener('click', async () => {
    signOut.disabled = true;
    try {
      const response = await fetch(`${endpoint}?action=logout`, { method: 'POST',
        headers: { 'X-Mission-Control-Signout': '1' }, credentials: 'same-origin' });
      if (!response.ok) throw new Error('Sign-out failed');
      render(control, null);
      control.querySelector('button')?.focus();
    } catch {
      signOut.disabled = false;
      status.classList.remove('sr-only');
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
  const result = accountResult();
  const container = element('div', 'account-control');
  actions.append(container);
  let user = null;
  try {
    const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
    if (response.ok) {
      const session = await response.json();
      accessEnabled = session.enabled === true;
      user = accessEnabled ? session.user ?? null : null;
    }
  } catch {
    // Keep guest access available even when the OAuth endpoint is absent.
  }
  render(container, user, result === 'retry' ? 'GitHub sign-in did not finish. You can retry.' : '');
  maybeWelcome(user);
}
