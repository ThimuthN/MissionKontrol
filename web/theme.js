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
}

apply(document.documentElement.dataset.theme);

toggle.addEventListener('click', async () => {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  if (reducedMotion.matches || typeof document.startViewTransition !== 'function') {
    apply(next);
    return;
  }
  const rect = toggle.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const distance = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  toggle.disabled = true;
  try {
    const transition = document.startViewTransition(() => apply(next));
    await transition.ready;
    await document.documentElement.animate({
      clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${distance}px at ${x}px ${y}px)`],
    }, {
      duration: 580, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)',
    }).finished;
  } catch {
    apply(next);
  } finally {
    toggle.disabled = false;
  }
});
