// Presentation-only motion. Evidence, choices, and navigation never depend on it.
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const precise = matchMedia('(hover: hover) and (pointer: fine)');
const stage = document.createElement('div');
stage.className = 'ambient-stage';
stage.setAttribute('aria-hidden', 'true');
const canvas = document.createElement('canvas');
stage.append(canvas);
const scene = document.querySelector('.scene-frame');
scene?.prepend(stage);
// The assistant mounts its stylesheet dynamically; keep our shared design layer last.
const designLayer = document.querySelector('link[href="/experience.css"]');
if (designLayer) document.head.append(designLayer);
const refinementLayer = document.querySelector('link[href="/refinement.css"]');
if (refinementLayer) document.head.append(refinementLayer);

const ctx = canvas.getContext('2d', { alpha: true });
const nodes = Array.from({ length: 26 }, (_, i) => ({
  x: ((i * 73 + 17) % 103) / 103,
  y: ((i * 37 + 29) % 89) / 89,
  radius: i % 7 === 0 ? 2.6 : 1.2,
  phase: i * 2.39996,
  speed: 0.32 + (i % 5) * 0.07,
}));
let width = 0;
let height = 0;
let animation = 0;
let last = 0;
let tick = 0;
let pointerX = .73;
let pointerY = .32;
let targetX = .73;
let targetY = .32;
let pointerInside = false;

function allowed() {
  return !!ctx && !reduce.matches && !document.hidden &&
    !document.documentElement.classList.contains('motion-paused');
}

function sizeCanvas() {
  const bounds = stage.getBoundingClientRect();
  width = Math.round(bounds.width);
  height = Math.round(bounds.height);
  const ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(width * ratio));
  canvas.height = Math.max(1, Math.round(height * ratio));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx?.setTransform(ratio, 0, 0, ratio, 0, 0);
}

function draw(time) {
  if (!allowed()) { animation = 0; ctx?.clearRect(0, 0, width, height); return; }
  animation = requestAnimationFrame(draw);
  if (time - last < 32) return; // cap decorative canvas near 30fps
  last = time;
  tick = time * .001;
  pointerX += (targetX - pointerX) * .04;
  pointerY += (targetY - pointerY) * .04;
  ctx.clearRect(0, 0, width, height);
  if (width < 1 || height < 1) return;

  const points = nodes.map((item, i) => {
    const driftX = Math.sin(tick * item.speed + item.phase) * 12;
    const driftY = Math.cos(tick * item.speed * .78 + item.phase) * 10;
    const baseX = item.x * width;
    const baseY = item.y * height;
    const distanceToPointer = Math.hypot(baseX - pointerX * width, baseY - pointerY * height);
    const attraction = pointerInside ? Math.max(0, 1 - distanceToPointer / 290) : 0;
    return {
      x: baseX + driftX + (pointerX * width - baseX) * .105 * attraction,
      y: baseY + driftY + (pointerY * height - baseY) * .105 * attraction,
      radius: item.radius,
    };
  });
  const maxDistance = Math.min(250, width * .21);
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    for (let j = i + 1; j < points.length; j++) {
      const b = points[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > maxDistance) continue;
      const intensity = (1 - distance / maxDistance) * .17;
      ctx.strokeStyle = `rgba(87, 217, 206, ${intensity})`;
      ctx.lineWidth = .8;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 14, b.x, b.y);
      ctx.stroke();
    }
  }
  points.forEach((point, i) => {
    const glow = i % 7 === 0;
    if (glow) {
      const halo = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 24);
      halo.addColorStop(0, 'rgba(83,222,210,.27)');
      halo.addColorStop(1, 'rgba(83,222,210,0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 24, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = glow ? 'rgba(166,255,239,.78)' : 'rgba(131,224,222,.49)';
    ctx.beginPath();
    ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
    ctx.fill();
  });
  if (pointerInside) {
    const x = pointerX * width, y = pointerY * height;
    const nearby = points.map(point => ({ point, distance: Math.hypot(point.x - x, point.y - y) }))
      .filter(item => item.distance < 220).sort((a, b) => a.distance - b.distance).slice(0, 6);
    for (const { point, distance } of nearby) {
      const beam = ctx.createLinearGradient(x, y, point.x, point.y);
      beam.addColorStop(0, `rgba(129,255,236,${(1 - distance / 220) * .43})`);
      beam.addColorStop(1, 'rgba(129,255,236,.03)');
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(point.x, point.y);
      ctx.strokeStyle = beam; ctx.lineWidth = 1.1; ctx.stroke();
    }
  }
}

function synchronize() {
  if (allowed()) {
    if (!animation) animation = requestAnimationFrame(draw);
  } else {
    cancelAnimationFrame(animation);
    animation = 0;
    ctx?.clearRect(0, 0, width, height);
  }
}

window.addEventListener('resize', () => { sizeCanvas(); synchronize(); }, { passive: true });
document.addEventListener('visibilitychange', synchronize);
reduce.addEventListener('change', synchronize);
new MutationObserver(synchronize).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
scene?.addEventListener('pointerleave', () => { pointerInside = false; targetX = .73; targetY = .32; });
scene?.addEventListener('pointermove', event => {
  if (!precise.matches || event.pointerType === 'touch') return;
  const rect = scene.getBoundingClientRect();
  targetX = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
  targetY = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
  pointerInside = true;
  scene.style.setProperty('--scene-x', `${Math.round(targetX * 100)}%`);
  scene.style.setProperty('--scene-y', `${Math.round(targetY * 100)}%`);
}, { passive: true });
sizeCanvas();
synchronize();

// Every interactive surface has a small, reversible response. Never move focus.
const touchable = 'button, .process-choice, .record, .record summary, .coverage summary, .replay-book summary, .export summary, .account-handle, a.jump-evidence';
document.addEventListener('pointermove', event => {
  if (!precise.matches || reduce.matches) return;
  const target = event.target.closest?.(touchable);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--light-x', `${Math.round((event.clientX - rect.left) * 100 / rect.width)}%`);
  target.style.setProperty('--light-y', `${Math.round((event.clientY - rect.top) * 100 / rect.height)}%`);
}, { passive: true });

document.addEventListener('click', event => {
  if (reduce.matches || document.documentElement.classList.contains('motion-paused')) return;
  const target = event.target.closest?.(touchable);
  if (!target || target.matches(':disabled')) return;
  target.animate([
    { filter: 'brightness(1)', transform: 'scale(1)' },
    { filter: 'brightness(1.06)', transform: 'scale(.985)', offset: .45 },
    { filter: 'brightness(1)', transform: 'scale(1)' },
  ], { duration: 210, easing: 'cubic-bezier(.22,.82,.35,1)' });
});

// Selection updates retain context, while new case and evidence content enters softly.
for (const id of ['case-title', 'evidence-title']) {
  const title = document.getElementById(id);
  if (!title) continue;
  let previous = title.textContent;
  new MutationObserver(() => {
    if (previous === title.textContent) return;
    previous = title.textContent;
    if (!allowed()) return;
    const surface = title.closest('.panel');
    surface?.animate([
      { opacity: .67, transform: 'translateY(7px)' },
      { opacity: 1, transform: 'translateY(0)' },
    ], { duration: 330, easing: 'cubic-bezier(.2,.82,.25,1)' });
  }).observe(title, { childList: true, characterData: true, subtree: true });
}
