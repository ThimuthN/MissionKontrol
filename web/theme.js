const toggle = document.getElementById('theme-toggle');
const meta = document.querySelector('meta[name="theme-color"]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let requestedTheme = null;
let transitioning = false;

function apply(theme) {
  const next = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  toggle.querySelector('.theme-label').textContent = `${next === 'light' ? 'Dark' : 'Light'} mode`;
  toggle.setAttribute('aria-label', `Switch to ${next === 'light' ? 'dark' : 'light'} mode`);
  toggle.setAttribute('aria-pressed', String(next === 'dark'));
  meta?.setAttribute('content', next === 'dark' ? '#081421' : '#e8f5f3');
  try { localStorage.setItem('mission-control:theme', next); } catch {}
  document.dispatchEvent(new CustomEvent('mission-theme-changed', { detail: { theme: next } }));
}

async function fallbackSweep(next) {
  const sweep = document.createElement('div');
  sweep.className = `theme-swoosh theme-swoosh--to-${next}`;
  sweep.setAttribute('aria-hidden', 'true');
  const curtain = document.createElement('div');
  curtain.className = 'theme-swoosh-curtain';
  const beam = document.createElement('div');
  beam.className = 'theme-swoosh-beam';
  curtain.append(beam);
  sweep.append(curtain);
  // A modal dialog lives in the browser's top layer. A body-level animation
  // would run *behind* the account form, which made the first-use choice look
  // instantaneous. Put the sweep in the visible surface instead.
  const host = document.querySelector('dialog.access-dialog[open]') ?? document.body;
  if (host !== document.body) sweep.classList.add('theme-swoosh--dialog');
  host.append(sweep);
  try {
    await curtain.animate([
      { transform: 'translateX(-122%) skewX(-18deg)' },
      { transform: 'translateX(0) skewX(-18deg)' },
    ], { duration: 455, easing: 'cubic-bezier(.72,0,.28,1)', fill: 'forwards' }).finished;
    apply(next);
    await curtain.animate([
      { transform: 'translateX(0) skewX(-18deg)' },
      { transform: 'translateX(122%) skewX(-18deg)' },
    ], { duration: 640, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).finished;
  } finally {
    sweep.remove();
  }
}

async function secondSwipe(next) {
  // A separate, brighter pass crossing the *revealed* interface. This is not
  // the exit edge of the first curtain: the two swipes remain distinguishable.
  const host = document.querySelector('dialog.access-dialog[open]') ?? document.body;
  const stage = document.createElement('div');
  stage.className = `theme-echo-stage theme-echo-stage--${next}`;
  stage.setAttribute('aria-hidden', 'true');
  if (host !== document.body) stage.classList.add('theme-echo-stage--dialog');
  const first = document.createElement('i');
  first.className = 'theme-echo-wide';
  const second = document.createElement('i');
  second.className = 'theme-echo-fine';
  stage.append(first, second);
  host.append(stage);
  try {
    const curves = [
      first.animate([
        { transform: 'translateX(0) skewX(-17deg)', opacity: .85 },
        { offset: .55, opacity: .98 },
        { transform: 'translateX(440%) skewX(-17deg)', opacity: 0 },
      ], { duration: 880, easing: 'cubic-bezier(.46,.04,.22,1)', fill: 'both' }).finished,
      second.animate([
        { transform: 'translateX(0) skewX(-17deg)', opacity: .15 },
        { offset: .4, opacity: .96 },
        { transform: 'translateX(620%) skewX(-17deg)', opacity: 0 },
      ], { delay: 165, duration: 880, easing: 'cubic-bezier(.37,0,.18,1)', fill: 'both' }).finished,
    ];
    await Promise.all(curves);
  } finally { stage.remove(); }
}

async function sweepTo(next) {
  if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') { apply(next); return; }
  if (document.querySelector('dialog.access-dialog[open]') || typeof document.startViewTransition !== 'function') {
    await fallbackSweep(next);
    await secondSwipe(next);
    return;
  }

  // Transition between two actual screenshots. The new palette travels across
  // the old one, instead of changing invisibly behind a solid-color curtain.
  const transition = document.startViewTransition(() => apply(next));
  await transition.ready;
  await document.documentElement.animate([
    { clipPath: 'polygon(0 0, 0 0, -27% 100%, 0 100%)', filter: 'drop-shadow(18px 0 12px rgba(92,246,223,.46))' },
    { offset: .58, clipPath: 'polygon(0 0, 70% 0, 43% 100%, 0 100%)', filter: 'drop-shadow(26px 0 28px rgba(92,246,223,.55))' },
    { clipPath: 'polygon(0 0, 130% 0, 105% 100%, 0 100%)', filter: 'drop-shadow(0 0 0 transparent)' },
  ], {
    pseudoElement: '::view-transition-new(root)', duration: 1080,
    easing: 'cubic-bezier(.68,0,.2,1)', fill: 'both',
  }).finished;
  await transition.finished;
  await secondSwipe(next);
}

async function drainRequests() {
  if (transitioning) return;
  transitioning = true;
  toggle.disabled = true;
  try {
    while (requestedTheme && requestedTheme !== document.documentElement.dataset.theme) {
      const next = requestedTheme;
      requestedTheme = null;
      try { await sweepTo(next); } catch { if (document.documentElement.dataset.theme !== next) apply(next); }
    }
  } finally {
    requestedTheme = null;
    transitioning = false;
    toggle.disabled = false;
  }
}

export function requestTheme(theme) {
  requestedTheme = theme === 'dark' ? 'dark' : 'light';
  void drainRequests();
}

apply(document.documentElement.dataset.theme);
document.addEventListener('mission-theme-request', event => requestTheme(event.detail?.theme));
toggle.addEventListener('click', () => requestTheme(
  (requestedTheme ?? document.documentElement.dataset.theme) === 'light' ? 'dark' : 'light'
));
