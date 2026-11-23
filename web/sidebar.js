const sidebar = document.getElementById('workspace-sidebar');
const collapse = document.getElementById('sidebar-toggle');
const mobileToggle = document.getElementById('sidebar-mobile-toggle');
const scrim = document.getElementById('sidebar-scrim');
const smallScreen = matchMedia('(max-width: 1120px)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function remember(value) {
  try { localStorage.setItem('mission-control:sidebar', value); } catch { /* Optional preference. */ }
}

function setExpanded(expanded) {
  document.body.dataset.sidebar = expanded ? 'expanded' : 'compact';
  collapse.setAttribute('aria-expanded', String(expanded));
  collapse.setAttribute('aria-label', expanded ? 'Collapse navigation' : 'Expand navigation');
  collapse.title = expanded ? 'Collapse navigation' : 'Expand navigation';
  remember(document.body.dataset.sidebar);
}

function setMobileOpen(open) {
  const active = Boolean(open && smallScreen.matches);
  document.body.classList.toggle('sidebar-mobile-open', active);
  mobileToggle.setAttribute('aria-expanded', String(active));
  mobileToggle.setAttribute('aria-label', active ? 'Close navigation' : 'Open navigation');
  scrim.hidden = !active;
  // A translated-offscreen drawer is still in the keyboard tab order unless
  // its subtree is made inert. Restore it immediately before opening.
  sidebar.inert = smallScreen.matches && !active;
  if (active) sidebar.querySelector('#nav-overview').focus();
}

function focusDestination(selector) {
  const destination = document.querySelector(selector);
  if (!destination) return;
  destination.scrollIntoView({ block: 'start', behavior: reducedMotion.matches ? 'auto' : 'smooth' });
  const heading = destination.querySelector('h1,h2,h3');
  if (heading?.hasAttribute('tabindex')) heading.focus({ preventScroll: true });
}

function markCurrent(id) {
  sidebar.querySelectorAll('.sidebar-link').forEach(button => {
    if (button.id === id) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

const destinations = {
  'nav-overview': () => focusDestination('.scene-frame'),
  'nav-questions': () => document.getElementById('priority-open')?.click(),
  'nav-casebook': () => focusDestination('#case-lab'),
  'nav-example': () => document.getElementById('start-tour')?.click(),
  'nav-mica': () => document.getElementById('agent-launcher')?.click(),
  'nav-dataset': () => document.getElementById('welcome-button')?.click(),
  'nav-import': () => document.getElementById('import-button')?.click(),
  'nav-export': () => {
    const menu = document.getElementById('export-menu');
    if (menu) { menu.open = true; menu.querySelector('summary')?.focus(); }
  },
};

for (const [id, action] of Object.entries(destinations)) {
  document.getElementById(id)?.addEventListener('click', () => {
    setMobileOpen(false);
    if (!['nav-dataset', 'nav-import', 'nav-export'].includes(id)) markCurrent(id);
    action();
  });
}

function sync() {
  const enabled = !document.getElementById('import-button').disabled;
  for (const id of ['nav-casebook', 'nav-questions', 'nav-mica', 'nav-dataset', 'nav-import', 'nav-export'])
    document.getElementById(id).disabled = !enabled;
  const tour = document.getElementById('start-tour');
  document.getElementById('nav-example').disabled = !enabled || tour.hidden || tour.disabled;
  const text = document.getElementById('priority-count').textContent;
  const count = Number.parseInt(text, 10);
  document.getElementById('sidebar-count').textContent = Number.isFinite(count) ? String(count) : '';
}

collapse.addEventListener('click', () => {
  if (smallScreen.matches) setMobileOpen(false);
  else setExpanded(document.body.dataset.sidebar !== 'expanded');
});
mobileToggle.addEventListener('click', () => setMobileOpen(!document.body.classList.contains('sidebar-mobile-open')));
scrim.addEventListener('click', () => { setMobileOpen(false); mobileToggle.focus(); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && document.body.classList.contains('sidebar-mobile-open')) {
    setMobileOpen(false);
    mobileToggle.focus();
  }
});
smallScreen.addEventListener('change', () => setMobileOpen(false));

try { setExpanded(localStorage.getItem('mission-control:sidebar') !== 'compact'); }
catch { setExpanded(true); }
setMobileOpen(false);
sync();
document.addEventListener('mission-ready', sync);
new MutationObserver(sync).observe(document.getElementById('priority-count'), { childList: true, characterData: true, subtree: true });
new MutationObserver(sync).observe(document.getElementById('start-tour'), { attributes: true, attributeFilter: ['hidden', 'disabled'] });
