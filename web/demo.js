// A source-grounded, seekable walkthrough. Speech is a device-local enhancement:
// captions and every explanation remain available when audio is unavailable.
const tl = gsap.timeline({ paused: true });
const enter = (selector, at, dy = 36, duration = .72) =>
  tl.fromTo(selector, { opacity: 0, y: dy },
    { opacity: 1, y: 0, duration, ease: 'power4.out', immediateRender: false }, at);
const grow = (selector, at, duration = .9, axis = 'X') =>
  tl.fromTo(selector, { [`scale${axis}`]: 0 },
    { [`scale${axis}`]: 1, duration, ease: 'power2.inOut', transformOrigin: axis === 'X' ? 'left center' : 'center top', immediateRender: false }, at);

// The screen reveals an item as the explanation reaches it. Titles then hold.
enter('#s0-email', .45, 38, 1.05);
grow('#s0-scan', 2.1, .9);
enter('#s0-warning', 3.2, 28, .6);
tl.fromTo('.s1-flow .flow-step:not(.inferred)', { opacity: 0, y: 30 },
  { opacity: 1, y: 0, duration: .7, stagger: .21, ease: 'power4.out', immediateRender: false }, 12.7);
grow('#s1-line', 13.4, 2.2);
enter('#s1-uncertain', 16, 68, .85);
tl.fromTo('.s2-ledger .ledger-row:not(.partial)', { opacity: 0, x: 28 },
  { opacity: 1, x: 0, duration: .52, stagger: .28, ease: 'power3.out', immediateRender: false }, 24.25);
enter('#s2-partial', 27.1, 44, .8);
enter('#s3-case', 36.6, 40, .9);
tl.fromTo('.review-button', { backgroundColor: '#0a817e' },
  { backgroundColor: '#0c5b5b', duration: .3, ease: 'power2.out', immediateRender: false }, 40.4);
enter('#s3-note', 40.7, 25, .7);
enter('#s3-result', 43, 18, .75);
enter('.s4-line .gap-step:not(.missing)', 49.2, 38, .85);
grow('#s4-connector', 51, .9, 'Y');
enter('#s4-missing', 52, 55, .9);
enter('#s5-booking', 60.8, 48, .86);
enter('#s5-report', 65, 55, .95);
enter('#s6-agent', 72.9, 45, .9);
enter('#s6-answer', 75, 30, .9);
enter('#s6-export', 79.2, 25, .75);
tl.fromTo('#s7-mark', { opacity: 0, scale: .72, rotation: -16 },
  { opacity: 1, scale: 1, rotation: 0, duration: .95, ease: 'power4.out', immediateRender: false }, 85.1);
enter('#s7-copy', 86, 36, 1);
enter('#s7-url', 89, 24, .65);
// The signal-coloured seam covers a cut as the source system changes.
for (const seam of [12, 36, 60, 84]) {
  tl.fromTo('#film-transition', { x: 0 },
    { x: 4700, duration: 1.06, ease: 'power2.inOut', immediateRender: false }, seam - .55);
}
tl.to({}, { duration: 96 }, 0);
window.__timelines ??= {};
window.__timelines.main = tl;

const root = document.getElementById('root');
const scenes = [...root.querySelectorAll('.scene')];
const progress = document.getElementById('demo-progress');
const play = document.getElementById('demo-play');
const clock = document.getElementById('demo-time');
const narrationButton = document.getElementById('demo-narration');
const captionsButton = document.getElementById('demo-captions');
const chaptersButton = document.getElementById('demo-chapters');
const chaptersClose = document.getElementById('demo-chapters-close');
const chapterDrawer = document.getElementById('demo-chapter-drawer');
const chapterButtons = [...chapterDrawer.querySelectorAll('[data-chapter]')];
const caption = document.getElementById('demo-caption');
const audioNotice = document.getElementById('demo-audio-notice');
const mobilePortrait = matchMedia('(max-width:700px) and (orientation:portrait)');
const chapterSource = document.getElementById('mobile-story-source');
const chapterCount = document.getElementById('mobile-story-count');
const chapterTitle = document.getElementById('mobile-story-title');
const chapterDescription = document.getElementById('mobile-story-description');
const mobileStory = document.getElementById('mobile-story');
const formatTime = time => Math.floor(time / 60) + ':' + String(Math.floor(time % 60)).padStart(2, '0');

// Two sentences per chapter; narration explains the implications instead of
// reading the interface headings. It is intentionally under 12 s per chapter.
const script = [
  [
    'A supplier confirms a laptop order. But the delivery name matches only by first name.',
    'Does this email belong to the request?'
  ],
  [
    'Mission Control brings the request, quote and approval together, then connects the Outlook order.',
    'That last connection is a suggestion, not a fact.'
  ],
  [
    'The supplier, laptop model and timing all line up. The recipient does not.',
    'Reviewers see every matching reason before deciding whether to trust the link.'
  ],
  [
    'When a reviewer spots a mistake, they can remove the link and explain why.',
    'The original source stays in the review history.'
  ],
  [
    'Another case has no receipt report. That is an evidence gap.',
    'It does not prove the laptop was never delivered. That distinction matters.'
  ],
  [
    'Recruitment has the same challenge. A calendar entry tells us a screening was planned.',
    'A separate message may support a report that it happened.'
  ],
  [
    'Mica answers questions using the reviewed records and links straight back to the evidence.',
    'Corrections also carry through to the case export and review queue.'
  ],
  [
    'The goal is not a perfect-looking timeline.',
    'It is a record people can trust, challenge and improve. That is Mission Control.'
  ]
];

let activeChapter = -1;
let lastCaption = '';
let captionsEnabled = true;
let narrationEnabled = false;
let spokenChapter = -1;
const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
if (!canSpeak) {
  narrationButton.disabled = true;
  narrationButton.title = 'Narration is unavailable in this browser; captions remain available.';
}

function closeChapters(focusButton = false) {
  chapterDrawer.hidden = true;
  chaptersButton.setAttribute('aria-expanded', 'false');
  if (focusButton) chaptersButton.focus();
}

function preferredVoice() {
  const voices = window.speechSynthesis.getVoices().filter(voice => /^en\b/i.test(voice.lang));
  return voices.find(voice => /natural|premium|neural/i.test(voice.name)) ??
    voices.find(voice => /google uk english|samantha|daniel|george/i.test(voice.name)) ?? voices[0];
}

function speakChapter(index) {
  if (!canSpeak || !narrationEnabled || tl.paused() || index < 0) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(script[index].join(' '));
  utterance.lang = 'en-GB';
  utterance.rate = 1.04;
  utterance.pitch = .98;
  const voice = preferredVoice();
  if (voice) utterance.voice = voice;
  utterance.onerror = event => {
    if (event.error === 'interrupted' || event.error === 'canceled') return;
    narrationEnabled = false;
    narrationButton.setAttribute('aria-pressed', 'false');
    narrationButton.setAttribute('aria-label', 'Turn narration on');
    // If narration fails, restore the text rather than leaving a silent film.
    captionsEnabled = true;
    captionsButton.setAttribute('aria-pressed', 'true');
    captionsButton.setAttribute('aria-label', 'Hide captions');
    caption.hidden = false;
    mobileStory.classList.remove('captions-off');
    audioNotice.hidden = false;
    window.setTimeout(() => { audioNotice.hidden = true; }, 6000);
  };
  window.speechSynthesis.speak(utterance);
  spokenChapter = index;
}

function updateCaption(chapter, time) {
  const text = script[chapter][time - Number(scenes[chapter].dataset.start) >= 6 ? 1 : 0];
  if (text !== lastCaption) { caption.textContent = text; lastCaption = text; }
  caption.hidden = !captionsEnabled;
}

function sync() {
  const t = Math.min(95.999, tl.time());
  let chapter = 0;
  for (const [index, scene] of scenes.entries()) {
    const start = Number(scene.dataset.start);
    const visible = t >= start && t < start + Number(scene.dataset.duration);
    scene.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) chapter = index;
  }
  if (activeChapter !== chapter) {
    const scene = scenes[chapter];
    const heading = scene.querySelector('.display,.mega');
    chapterSource.textContent = scene.querySelector('.section-label')?.textContent ?? 'Mission Control';
    chapterCount.textContent = String(chapter + 1).padStart(2, '0') + ' / ' + String(scenes.length).padStart(2, '0');
    chapterTitle.textContent = heading?.innerText.replace(/\s+/g, ' ').trim() ?? '';
    chapterDescription.textContent = script[chapter].join(' ');
    chapterButtons.forEach((button, index) => {
      if (index === chapter) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    activeChapter = chapter;
    if (narrationEnabled && !tl.paused()) speakChapter(chapter);
  }
  updateCaption(chapter, t);
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
  if (tl.progress() >= 1) { spokenChapter = -1; tl.restart(); }
  else if (tl.paused()) {
    tl.play();
    if (narrationEnabled && canSpeak) {
      if (spokenChapter === activeChapter && window.speechSynthesis.paused) window.speechSynthesis.resume();
      else speakChapter(activeChapter);
    }
  } else {
    tl.pause();
    if (canSpeak && narrationEnabled) window.speechSynthesis.pause();
  }
  sync();
});
progress.addEventListener('input', () => {
  tl.pause().time(Number(progress.value));
  spokenChapter = -1;
  if (canSpeak && narrationEnabled) window.speechSynthesis.cancel();
  sync();
});
narrationButton.addEventListener('click', () => {
  if (!canSpeak) return;
  narrationEnabled = !narrationEnabled;
  narrationButton.setAttribute('aria-pressed', String(narrationEnabled));
  narrationButton.setAttribute('aria-label', narrationEnabled ? 'Turn narration off' : 'Turn narration on');
  if (narrationEnabled) {
    audioNotice.hidden = true;
    spokenChapter = -1;
    tl.pause().time(Number(scenes[activeChapter].dataset.start));
    sync();
    tl.play();
    speakChapter(activeChapter);
  } else {
    window.speechSynthesis.cancel();
    spokenChapter = -1;
  }
  sync();
});
captionsButton.addEventListener('click', () => {
  captionsEnabled = !captionsEnabled;
  captionsButton.setAttribute('aria-pressed', String(captionsEnabled));
  captionsButton.setAttribute('aria-label', captionsEnabled ? 'Hide captions' : 'Show captions');
  caption.hidden = !captionsEnabled;
  mobileStory.classList.toggle('captions-off', !captionsEnabled);
});
chaptersButton.addEventListener('click', () => {
  chapterDrawer.hidden = !chapterDrawer.hidden;
  chaptersButton.setAttribute('aria-expanded', String(!chapterDrawer.hidden));
  if (!chapterDrawer.hidden) chapterButtons[activeChapter].focus();
});
chaptersClose.addEventListener('click', () => closeChapters(true));
for (const [index, button] of chapterButtons.entries()) {
  button.addEventListener('click', () => {
    spokenChapter = -1;
    if (canSpeak && narrationEnabled) window.speechSynthesis.cancel();
    tl.pause().time(Number(scenes[index].dataset.start));
    sync();
    tl.play();
    if (narrationEnabled) speakChapter(index);
    closeChapters(true);
  });
}
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !chapterDrawer.hidden) { closeChapters(true); return; }
  if (event.target.closest('button,a,input')) return;
  if (event.code === 'Space') { event.preventDefault(); play.click(); }
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault();
    tl.pause().time(Math.max(0, Math.min(96, tl.time() + (event.key === 'ArrowRight' ? 5 : -5))));
    spokenChapter = -1;
    if (canSpeak && narrationEnabled) window.speechSynthesis.cancel();
    sync();
  }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && !tl.paused()) {
    tl.pause();
    if (canSpeak && narrationEnabled) window.speechSynthesis.pause();
    sync();
  }
});
window.addEventListener('pagehide', () => { if (canSpeak) window.speechSynthesis.cancel(); });
tl.eventCallback('onUpdate', sync);
tl.eventCallback('onComplete', () => {
  if (canSpeak && narrationEnabled) window.speechSynthesis.cancel();
  sync();
});
fit(); tl.seek(0); sync();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) tl.play();
