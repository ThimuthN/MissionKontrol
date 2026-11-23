import { showActivity } from './activity.js';
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });
const names = { calendar: 'Calendar', email: 'Outlook', teams: 'Teams', screen: 'Screen activity' };
let previous, stop;

export function chronological(item) {
  return item.steps.flatMap(step => step.evidence.map(record => ({ step, record })))
    .sort((a, b) => Date.parse(a.record.at) - Date.parse(b.record.at) || a.record.id.localeCompare(b.record.id));
}

export function renderReplay(report, item) {
  showActivity(report);
  const holder = document.getElementById('case-replay');
  if (!holder || !item) { stop?.(); previous = null; return; }
  const timeline = chronological(item);
  const key = JSON.stringify([report.dataset, report.process, item.id, timeline.map(({ step, record }) => [step.id, record.id, step.status])]);
  if (key === previous && holder.childElementCount) return;
  stop?.(); previous = key;
  holder.replaceChildren();
  if (!timeline.length) return;
  const book = document.createElement('details');
  book.className = 'replay-book';
  book.innerHTML = `<summary><span aria-hidden="true">▷</span> Replay the case <small></small></summary>
    <div class="replay-face"><div class="replay-readout"><b></b><time></time></div><p></p>
    <div class="replay-controls"><button type="button" data-action="play">Play</button><label>Record
    <input type="range" min="0" step="1" aria-label="Choose record in replay"></label><output></output></div>
    <button type="button" data-action="open">Inspect this record ↗</button></div>`;
  holder.append(book);
  book.querySelector('small').textContent = timeline.length + (timeline.length === 1 ? ' record' : ' records');
  const range = book.querySelector('input');
  range.max = String(timeline.length - 1); range.value = '0';
  const play = book.querySelector('[data-action="play"]');
  const paragraph = book.querySelector('p');
  let timer;
  stop = () => { clearInterval(timer); timer = null; play.textContent = 'Play'; play.setAttribute('aria-pressed', 'false'); };
  function draw() {
    const { step, record } = timeline[Number(range.value)];
    book.querySelector('b').textContent = [names[record.source] ?? record.source, step.label].join(' / ');
    const time = book.querySelector('time');
    time.dateTime = record.at;
    time.textContent = date.format(new Date(record.at)) + ' SLST';
    paragraph.textContent = record.text;
    book.querySelector('output').textContent = (Number(range.value) + 1) + ' / ' + timeline.length;
    range.setAttribute('aria-valuetext', (Number(range.value) + 1) + ' of ' + timeline.length + ', ' + step.label);
  }
  range.oninput = () => { stop(); draw(); };
  play.disabled = range.disabled = timeline.length < 2;
  play.onclick = () => {
    if (timer) { stop(); return; }
    if (range.value === range.max) range.value = '0';
    draw(); play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    timer = setInterval(() => {
      if (document.hidden || !book.open || !book.isConnected) { stop(); return; }
      range.stepUp(); draw();
      if (range.value === range.max) stop();
    }, 2400);
  };
  book.ontoggle = () => { if (!book.open) stop(); };
  book.querySelector('[data-action="open"]').onclick = () => {
    stop();
    const { step, record } = timeline[Number(range.value)];
    document.dispatchEvent(new CustomEvent('mission-citation', { detail: { caseId: item.id, stepId: step.id, evidenceId: record.id } }));
  };
  stop(); draw();
}
