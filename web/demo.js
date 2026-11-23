// A source-grounded, self-hosted walkthrough. Kept separate from the document
// so that the production Content Security Policy permits the player to run.
const tl = gsap.timeline({ paused: true });
const enter = (selector, at, dy = 36, duration = .72) =>
  tl.fromTo(selector, { opacity: 0, y: dy },
    { opacity: 1, y: 0, duration, ease: 'power4.out', immediateRender: false }, at);
const grow = (selector, at, duration = .9) =>
  tl.fromTo(selector, { scaleX: 0 },
    { scaleX: 1, duration, ease: 'power2.inOut', transformOrigin: 'left center', immediateRender: false }, at);

enter('#s0-warning', 3.2, 28, .6); grow('#s0-scan', 2.1, .9);
grow('#s1-line', 13.4, 2.2); enter('#s1-uncertain', 16, 75, .85);
enter('#s2-partial', 27.1, 44, .8);
enter('#s3-note', 39, 35, .7); enter('#s3-result', 43, 18, .75);
enter('#s4-missing', 52, 75, .95); grow('#s4-connector', 51, .9);
enter('#s5-report', 65, 65, .95);
enter('#s6-answer', 75, 30, .9); enter('#s6-export', 79.2, 25, .75);
tl.fromTo('#s7-mark', { opacity: 0, scale: .72, rotation: -16 },
  { opacity: 1, scale: 1, rotation: 0, duration: .95, ease: 'power4.out', immediateRender: false }, 85.1);
enter('#s7-copy', 86, 36, 1); enter('#s7-url', 89, 24, .65);
tl.to({}, { duration: 96 }, 0);
window.__timelines ??= {};
window.__timelines.main = tl;

const root = document.getElementById('root');
const scenes = [...root.querySelectorAll('.scene')];
const progress = document.getElementById('demo-progress');
const play = document.getElementById('demo-play');
const clock = document.getElementById('demo-time');
const formatTime = time => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');
const mobilePortrait = matchMedia('(max-width:700px) and (orientation:portrait)');
const chapterSource = document.getElementById('mobile-story-source');
const chapterCount = document.getElementById('mobile-story-count');
const chapterTitle = document.getElementById('mobile-story-title');
const chapterDescription = document.getElementById('mobile-story-description');
let lastChapter = -1;

function sync() {
  const t = Math.min(95.999, tl.time());
  let chapter = 0;
  for (const [index, scene] of scenes.entries()) {
    const start = Number(scene.dataset.start);
    const visible = t >= start && t < start + Number(scene.dataset.duration);
    scene.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) chapter = index;
  }
  if (lastChapter !== chapter) {
    const scene = scenes[chapter];
    const heading = scene.querySelector('.display,.mega');
    chapterSource.textContent = scene.querySelector('.section-label')?.textContent ?? 'Mission Control';
    chapterCount.textContent = String(chapter + 1).padStart(2, '0') + ' / ' + String(scenes.length).padStart(2, '0');
    chapterTitle.textContent = heading?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    chapterDescription.textContent = scene.querySelector('.copy,.s7-copy p')?.textContent ?? '';
    lastChapter = chapter;
  }
  progress.value = String(t);
  clock.textContent = formatTime(tl.time()) + ' / 1:36';
  play.textContent = tl.progress() >= 1 ? 'Replay' : tl.paused() ? 'Play' : 'Pause';
}

function fit() {
  if (mobilePortrait.matches) {
    root.style.transform = 'translate(0px, 54px) scale(' + innerWidth / 1920 + ')';
    root.setAttribute('aria-hidden', 'true');
    return;
  }
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  root.style.transform = 'translate(' + Math.max(0, (innerWidth - 1920 * scale) / 2) + 'px,' +
    Math.max(0, (innerHeight - 1080 * scale) / 2) + 'px) scale(' + scale + ')';
  root.removeAttribute('aria-hidden');
}
window.addEventListener('resize', fit, { passive: true });
play.addEventListener('click', () => {
  if (tl.progress() >= 1) tl.restart();
  else if (tl.paused()) tl.play();
  else tl.pause();
  sync();
});
progress.addEventListener('input', () => { tl.pause().time(Number(progress.value)); sync(); });
document.addEventListener('keydown', event => {
  if (event.target.closest('button,a,input')) return;
  if (event.code === 'Space') { event.preventDefault(); play.click(); }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    tl.pause().time(Math.max(0, Math.min(96, tl.time() + (event.key === 'ArrowRight' ? 5 : -5))));
    sync();
  }
});
tl.eventCallback('onUpdate', sync);
tl.eventCallback('onComplete', sync);
fit(); tl.seek(0); sync();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) tl.play();
