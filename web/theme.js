const toggle = document.getElementById('theme-toggle');
const meta = document.querySelector('meta[name="theme-color"]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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

apply(document.documentElement.dataset.theme);

toggle.addEventListener('click', async () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  if (reducedMotion.matches || typeof Element.prototype.animate !== 'function') {
    apply(next);
    return;
  }
  const sweep = document.createElement('div');
  sweep.className = `theme-swoosh theme-swoosh--to-${next}`;
  sweep.setAttribute('aria-hidden', 'true');
  const curtain = document.createElement('div');
  curtain.className = 'theme-swoosh-curtain';
  const beam = document.createElement('div');
  beam.className = 'theme-swoosh-beam';
  curtain.append(beam);
  sweep.append(curtain);
  document.body.append(sweep);
  toggle.disabled = true;
  let applied = false;
  try {
    // Cover the old palette, switch behind the curtain, then swoosh off-screen.
    await curtain.animate([
      { transform: 'translateX(-120%) skewX(-13deg)' },
      { transform: 'translateX(0) skewX(-13deg)' },
    ], { duration: 365, easing: 'cubic-bezier(.65,0,.28,1)', fill: 'forwards' }).finished;
    apply(next);
    applied = true;
    await curtain.animate([
      { transform: 'translateX(0) skewX(-13deg)' },
      { transform: 'translateX(120%) skewX(-13deg)' },
    ], { duration: 535, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }).finished;
  } catch {
    if (!applied) apply(next);
  } finally {
    sweep.remove();
    toggle.disabled = false;
  }
});
