const dayMs = 86400000;
const localDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo', year:'numeric', month:'2-digit', day:'2-digit' });
const shortDate = new Intl.DateTimeFormat('en-GB', { timeZone:'UTC', month:'short', day:'numeric' });
const sources = { email:'Outlook', calendar:'Calendar', teams:'Teams', screen:'Screen log' };
let previousReport;

export function activityBuckets(report) {
  const unique = new Map();
  for (const item of report.cases) for (const step of item.steps) for (const record of step.evidence) unique.set(record.id, record);
  const dated = [...unique.values()].map(record => ({ source:record.source, day:Date.parse(localDay.format(new Date(record.at)) + 'T00:00:00Z') })).filter(record => Number.isFinite(record.day));
  if (!dated.length) return [];
  let start = dated[0].day, end = start;
  for (const record of dated) { start = Math.min(start, record.day); end = Math.max(end, record.day); }
  const span = Math.round((end - start) / dayMs) + 1;
  const width = Math.ceil(span / 56);
  const buckets = Array.from({length:Math.ceil(span / width)}, (_, index) => ({
    start:start + index * width * dayMs, end:Math.min(end, start + ((index + 1) * width - 1) * dayMs), count:0, sources:{},
  }));
  for (const record of dated) {
    const bucket = buckets[Math.floor((record.day - start) / (dayMs * width))];
    bucket.count++; bucket.sources[record.source] = (bucket.sources[record.source] ?? 0) + 1;
  }
  return buckets;
}

export function showActivity(report) {
  if (previousReport === report) return;
  previousReport = report;
  let frame = document.querySelector('.activity-imprint');
  if (!frame) {
    frame = document.createElement('figure');
    frame.className = 'activity-imprint';
    frame.innerHTML = '<figcaption>Evidence by date <output></output></figcaption><div class="imprint-track"><div class="imprint-bars" aria-hidden="true"></div><input type="range" aria-label="Explore daily evidence counts" min="0" step="1"></div>';
    document.querySelector('.intro').insertAdjacentElement('afterend', frame);
  }
  const buckets = activityBuckets(report);
  frame.hidden = !buckets.length;
  if (!buckets.length) return;
  const bars = frame.querySelector('.imprint-bars');
  const range = frame.querySelector('input');
  const output = frame.querySelector('output');
  const maximum = Math.max(...buckets.map(bucket => bucket.count));
  bars.replaceChildren(...buckets.map(bucket => {
    const bar = document.createElement('i');
    bar.style.height = Math.max(5, bucket.count / maximum * 100) + '%';
    bar.classList.toggle('imprint-empty', !bucket.count);
    return bar;
  }));
  range.max = String(buckets.length - 1);
  function select(index) {
    const bucket = buckets[index];
    const label = shortDate.format(bucket.start) + (bucket.end !== bucket.start ? '–' + shortDate.format(bucket.end) : '');
    const tally = Object.entries(bucket.sources).map(([source,count]) => count + ' ' + (sources[source] ?? source)).join(', ');
    output.textContent = label + ' · ' + (tally || 'No linked records');
    range.setAttribute('aria-valuetext', output.textContent);
    bars.querySelector('.imprint-selected')?.classList.remove('imprint-selected');
    bars.children[index].classList.add('imprint-selected');
  }
  range.value = String(buckets.findIndex(bucket => bucket.count === maximum));
  range.oninput = () => select(Number(range.value));
  range.onpointermove = event => {
    if (event.pointerType !== 'mouse') return;
    const rect = range.getBoundingClientRect();
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor((event.clientX - rect.left) / rect.width * buckets.length)));
    range.value = String(index); select(index);
  };
  select(Number(range.value));
}
