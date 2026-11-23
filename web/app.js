import { openWelcome } from './welcome.js';
import { casesCsv, download, importWorkspace } from './workspace.js';
import { chooseTour, publicDataset, readSelection, selectCases, summarize } from './review-model.js';

const $ = id => document.getElementById(id);
const states = { observed: 'Observed', inferred: 'Inferred link', missing: 'Evidence gap' };
const sources = { email: 'Outlook', teams: 'Teams', calendar: 'Calendar', screen: 'Screen log' };
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Colombo' });
const timestamp = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo',
});
const number = new Intl.NumberFormat('en');

function node(tag, value, className) {
  const el = document.createElement(tag);
  if (value !== undefined && value !== null) el.textContent = value;
  if (className) el.className = className;
  return el;
}

function badge(status) {
  return node('span', states[status], `state ${status}`);
}

function activated(label, className, pressed, handler) {
  const button = node('button', label, className);
  button.type = 'button';
  button.setAttribute('aria-pressed', String(pressed));
  button.onclick = handler;
  return button;
}

function openRecord(record, expanded, isDemo) {
  const details = node('details', undefined, 'record');
  details.open = expanded;
  const summary = node('summary');
  const time = node('time', timestamp.format(new Date(record.at)));
  time.dateTime = record.at;
  summary.append(node('span', sources[record.source] ?? record.source, `source ${record.source}`), time);
  const body = node('div', undefined, 'record-body');
  body.append(node('p', isDemo ? 'Redacted source summary' : 'Source extract', 'record-label'),
    node('p', record.text, 'record-text'), node('p', 'Why it was linked', 'record-label'),
    node('p', record.reason, 'record-reason'));
  if (record.checks?.length) {
    const checks = node('dl', undefined, 'match-ledger');
    for (const check of record.checks) {
      const line = node('div', undefined, check.partial ? 'partial' : '');
      line.append(node('dt', check.label), node('dd', check.result));
      checks.append(line);
    }
    body.append(checks);
  }
  body.append(node('p', `${record.origin} / ${record.timeKind}`, 'record-origin'));
  details.append(summary, body);
  return details;
}

function mount(report, { useLink = false } = {}) {
  const isDemo = report.dataset === publicDataset;
  const storageKey = `mission-control:v1:${report.dataset}:reviews`;
  const { stages, gaps } = summarize(report);
  const stops = chooseTour(report.cases);
  let reviews = {};
  try { reviews = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {}; } catch {}
  const fromLink = isDemo && useLink ? readSelection(location.hash, report.cases) : null;
  let activeCase = fromLink?.item ?? report.cases[0];
  let activeStep = fromLink?.step ?? activeCase?.steps[0];
  let stage = '';
  let gapsOnly = false;
  let tourIndex = -1;

  $('process').textContent = report.process;
  $('dataset').textContent = isDemo ? 'Redacted assessment demo' : 'On-device import';
  $('description').textContent = isDemo
    ? 'Trace requests through Teams and Outlook. See what the records can tell you.'
    : 'Inspect how cases were reconstructed from the export on this device.';
  $('period').textContent = isDemo ? 'Harbourline Talent / March 2026' : 'Your workspace';
  $('period').hidden = false;
  $('case-lab').hidden = !activeCase;
  $('load-state').hidden = Boolean(activeCase);
  $('load-state').textContent = 'No laptop procurement cases matched this export.';
  $('counts').textContent = `${number.format(report.stats.rows ?? report.stats.normalized)} source rows / ${number.format(report.stats.linked)} linked records / Sri Lanka time`;
  $('copy-link').hidden = !isDemo || !activeCase;
  $('start-tour').hidden = stops.length === 0;
  $('start-tour').disabled = false;
  $('case-search').value = '';
  $('tour').hidden = true;
  $('insight').textContent = `${number.format(gaps)} of ${number.format(report.cases.length)} cases have an evidence gap.`;
  for (const [id, filename, format, serialize] of [
    ['export-csv', 'mission-control-cases.csv', 'text/csv;charset=utf-8', () => casesCsv(report, reviews)],
    ['export-json', 'mission-control-evidence.json', 'application/json', () => JSON.stringify({ report, reviews }, null, 2)],
  ]) {
    $(id).disabled = false;
    $(id).onclick = () => {
      download(filename, serialize(), format);
      $('export-menu').open = false;
      $('export-menu').querySelector('summary').focus();
    };
  }
  if (!activeCase) return;

  const activeKey = () => `${activeCase.id}/${activeStep.id}`;
  const focusButton = (container, index) => $(container).querySelectorAll('button')[index]?.focus();

  function showCase(item, stepId = stage) {
    activeCase = item;
    activeStep = item.steps.find(candidate => candidate.id === stepId) ??
      (gapsOnly ? item.steps.find(candidate => candidate.status === 'missing') : undefined) ?? item.steps[0];
  }

  function render() {
    const filtered = selectCases(report.cases, { query: $('case-search').value, stage, gapsOnly });
    if (filtered.length && !filtered.includes(activeCase)) showCase(filtered[0]);
    $('overview').replaceChildren(...stages.map((item, index) => {
      const count = gapsOnly ? report.cases.length - item.supported : item.supported;
      const button = activated(undefined, 'stage-filter', stage === item.id, () => {
        stage = stage === item.id ? '' : item.id;
        if (stage) showCase(activeCase, stage);
        render();
        focusButton('overview', index);
      });
      const tally = node('span', undefined, 'stage-tally');
      tally.append(node('strong', number.format(count)), node('span', `/ ${number.format(report.cases.length)}`));
      const meter = node('span', undefined, 'stage-meter');
      meter.setAttribute('aria-hidden', 'true');
      meter.style.setProperty('--coverage', `${count / report.cases.length * 100}%`);
      button.append(node('span', item.label, 'stage-label'), tally, meter);
      button.setAttribute('aria-label', `${item.label}, ${count} of ${report.cases.length} cases ${gapsOnly ? 'missing evidence' : 'with evidence'}`);
      return button;
    }));
    $('gaps-only').setAttribute('aria-pressed', String(gapsOnly));
    $('overview').dataset.mode = gapsOnly ? 'gaps' : 'observed';
    $('reset-filter').hidden = !stage && !gapsOnly && !$('case-search').value;
    $('case-count').textContent = `${filtered.length} / ${report.cases.length}`;
    $('case-list').replaceChildren(...filtered.map((item, index) => {
      const button = activated(undefined, 'case-button', item === activeCase, () => {
        showCase(item);
        render();
        focusButton('case-list', index);
      });
      const header = node('span', undefined, 'case-label');
      const missing = item.steps.filter(step => step.status === 'missing').length;
      header.append(node('strong', item.label ?? item.id), node('span', missing ? `${missing} ${missing === 1 ? 'gap' : 'gaps'}` : 'Full trail', `case-tag ${missing ? 'gap' : ''}`));
      button.append(header, node('span', item.requestType, 'case-type'));
      return button;
    }));
    const hasCases = filtered.length > 0;
    $('steps').parentElement.hidden = !hasCases;
    $('records').parentElement.hidden = !hasCases;
    $('copy-link').hidden = !isDemo || !hasCases;
    $('desk').classList.toggle('no-cases', !hasCases);
    if (!hasCases) {
      $('case-list').append(node('p', 'No cases match these filters.', 'empty'));
      return;
    }
    const first = activeCase.steps[0].evidence[0];
    const current = filtered.indexOf(activeCase);
    $('case-position').textContent = `${current + 1} / ${filtered.length}`;
    for (const [buttonId, offset] of [['previous-case', -1], ['next-case', 1]]) {
      const target = filtered[current + offset];
      const button = $(buttonId);
      button.disabled = !target;
      button.onclick = () => {
        if (!target) return;
        showCase(target, activeStep.id);
        render();
        if (button.disabled) $('case-title').focus({ preventScroll: true });
      };
    }
    $('case-title').textContent = activeCase.label ?? activeCase.id;
    $('case-context').textContent = [activeCase.requestType, first ? `Opened ${date.format(new Date(first.at))}` : undefined].filter(Boolean).join(' / ');
    $('steps').replaceChildren(...activeCase.steps.map((step, index) => {
      const li = node('li', undefined, `timeline-item ${step.status}`);
      const button = activated(undefined, 'step', step === activeStep, () => {
        activeStep = step;
        render();
        focusButton('steps', index);
      });
      const primary = node('span', undefined, 'step-primary');
      primary.append(node('strong', step.label), badge(step.status));
      const decision = reviews[`${activeCase.id}/${step.id}`]?.decision;
      const record = step.evidence[0];
      const label = record
        ? [...new Set(step.evidence.map(item => sources[item.source] ?? item.source))].join(' + ')
        : 'No supporting record';
      button.append(node('span', String(index + 1).padStart(2, '0'), 'step-index'), primary,
        node('small', decision ? `Reviewer: ${decision}` : label, 'step-meta'));
      li.append(button);
      return li;
    }));
    $('evidence-title').textContent = activeStep.label;
    $('evidence-context').replaceChildren(badge(activeStep.status), node('span', `${activeStep.evidence.length} ${activeStep.evidence.length === 1 ? 'record' : 'records'}`));
    $('records').replaceChildren(...activeStep.evidence.map((record, index) => openRecord(record, index === 0, isDemo)));
    if (!activeStep.evidence.length) {
      $('records').append(node('p', 'There’s no matching record for this stage in the export. Flag it if the team should follow up.', 'empty evidence-gap'));
    }
    const review = reviews[activeKey()];
    $('review-note').value = review?.note ?? '';
    $('review-state').textContent = review ? `Saved locally as ${review.decision}.` : 'Your review stays in this browser.';
    $('clear-review').hidden = !review;
    $('review-form').querySelector('[value="confirmed"]').disabled = activeStep.status === 'missing';
  }

  function save(decision) {
    const updated = { ...reviews };
    if (decision) updated[activeKey()] = { decision, note: $('review-note').value.trim() };
    else delete updated[activeKey()];
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      reviews = updated;
      render();
    } catch {
      $('review-state').textContent = 'Could not save your decision. Browser storage is unavailable.';
    }
  }

  function clearFilters() {
    stage = '';
    gapsOnly = false;
    $('case-search').value = '';
  }

  function moveTour(index) {
    const stop = stops[index];
    tourIndex = stop ? index : -1;
    $('tour').hidden = !stop;
    $('desk').classList.toggle('tour-active', Boolean(stop));
    if (!stop) return;
    clearFilters();
    showCase(report.cases.find(item => item.id === stop.caseId), stop.stepId);
    $('tour-count').textContent = `Walkthrough ${index + 1} of ${stops.length}`;
    $('tour-title').textContent = stop.title;
    $('tour-text').textContent = stop.text;
    $('tour-next').firstChild.nodeValue = index === stops.length - 1 ? 'Finish ' : 'Next ';
    render();
  }
  $('start-tour').onclick = () => {
    moveTour(0);
    $('tour-next').focus({ preventScroll: true });
    $('case-lab').scrollIntoView({ block: 'start' });
  };
  $('tour-next').onclick = () => {
    moveTour(tourIndex + 1);
    if (tourIndex < 0) $('case-title').focus({ preventScroll: true });
  };
  $('tour-close').onclick = () => { moveTour(-1); $('case-title').focus({ preventScroll: true }); };
  $('review-form').onsubmit = event => {
    event.preventDefault();
    if (event.submitter?.value) save(event.submitter.value);
  };
  $('clear-review').onclick = () => { save(null); $('review-note').focus(); };
  $('case-search').oninput = render;
  $('gaps-only').onclick = () => { gapsOnly = !gapsOnly; render(); };
  $('reset-filter').onclick = () => { clearFilters(); render(); $('case-search').focus(); };
  $('copy-link').onclick = async () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ case: activeCase.id, step: activeStep.id }).toString();
    try {
      await navigator.clipboard.writeText(url.toString());
      $('copy-status').textContent = 'Case link copied.';
      $('copy-link').textContent = 'Link copied';
      setTimeout(() => { $('copy-link').textContent = 'Copy case link'; }, 1800);
    } catch {
      history.replaceState(null, '', url);
      $('copy-status').textContent = 'Case link shown in your address bar.';
      $('copy-link').textContent = 'Link in address bar';
    }
  };
  render();
  if (fromLink) $('case-lab').scrollIntoView({ block: 'start' });
}

async function start() {
  const response = await fetch('/report.json');
  if (!response.ok) throw new Error('Report unavailable');
  const report = await response.json();
  mount(report, { useLink: true });
  const input = $('import-file');
  const feedback = $('workspace-status');
  const openPicker = () => input.click();
  $('import-button').disabled = false;
  $('import-button').onclick = openPicker;
  $('welcome-button').onclick = () => openWelcome({
    onDemo() {
      mount(report);
      feedback.hidden = true;
    },
    onImport: openPicker,
  });
  input.onchange = async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    feedback.hidden = false;
    feedback.textContent = 'Reading the ZIP on this device.';
    $('import-button').disabled = true;
    try {
      const imported = await importWorkspace(file);
      mount(imported);
      feedback.textContent = `${file.name} opened on this device. ${imported.stats.rejected} rows could not be read.`;
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      $('import-button').disabled = false;
    }
  };
}

start().catch(() => {
  $('load-state').hidden = false;
  $('load-state').textContent = 'The workflow report could not be loaded. Reload to try again.';
});
