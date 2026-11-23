const endpoint = '/api/session';
let mounted = false;
export let currentReviewer;

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

function render(control, user, message = '') {
  currentReviewer = user?.login;
  const status = element('span', 'account-status sr-only');
  status.setAttribute('role', 'status');
  if (!user) {
    const signIn = element('a', 'nav-button account-link', message ? 'Retry GitHub sign-in' : 'Sign in with GitHub');
    signIn.href = `${endpoint}?action=login`;
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
      control.querySelector('a').focus();
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
  try {
    const response = await fetch(endpoint, { cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) return;
    const session = await response.json();
    if (session.enabled !== true) return;
    const container = element('div', 'account-control');
    const notice = result === 'retry' ? 'GitHub sign-in did not finish. You can retry.' : '';
    render(container, session.user ?? null, notice);
    actions.append(container);
  } catch {
    // The account control is optional on static or offline builds.
  }
}
