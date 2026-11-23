const storageKey = 'mission-control:pause-motion';

export function pointerDepth(x, y, width, height) {
  const offset = (position, size, max) => size > 0
    ? Math.round(Math.max(-1, Math.min(1, position * 2 / size - 1)) * max) : 0;
  return { x:offset(x, width, 12), y:offset(y, height, 7) };
}

export function mountPaperMotion(button) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const precise = matchMedia('(hover: hover) and (pointer: fine)');
  const light = document.createElement('div');
  light.className = 'paper-daylight';
  light.setAttribute('aria-hidden','true');
  document.body.prepend(light);
  let paused = false, frame = 0, dx = 0, dy = 0, enabled = false;
  try { paused = localStorage.getItem(storageKey) === 'yes'; } catch {}
  function draw() {
    frame = 0;
    light.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    const slip = document.querySelector('.welcome[open] .source-sheet');
    if (slip) slip.style.setProperty('--paper-offset', dx / 4 + 'px');
  }
  function position(x, y) {
    if (dx === x && dy === y) return;
    dx = x; dy = y;
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function hover(event) {
    if (!enabled || event.pointerType === 'touch') return;
    const value = pointerDepth(event.clientX, event.clientY, innerWidth, innerHeight);
    position(value.x, value.y);
  }
  function reset() { position(0, 0); }
  function sync() {
    const stop = paused || reduced.matches;
    enabled = !stop && precise.matches && !document.hidden;
    document.documentElement.classList.toggle('motion-paused', stop);
    button.setAttribute('aria-pressed', String(stop));
    button.textContent = reduced.matches ? 'Reduced motion on' : stop ? 'Resume motion' : 'Pause motion';
    button.disabled = reduced.matches;
    if (enabled) document.addEventListener('pointermove', hover, { passive:true });
    else { document.removeEventListener('pointermove', hover); reset(); }
  }
  button.onclick = () => {
    paused = !paused;
    try { localStorage.setItem(storageKey, paused ? 'yes' : 'no'); } catch {}
    sync();
  };
  reduced.addEventListener('change', sync);
  precise.addEventListener('change', sync);
  document.addEventListener('visibilitychange', sync);
  document.documentElement.addEventListener('pointerleave', reset);
  window.addEventListener('blur', reset);
  sync();
}
