import { openWelcome } from './welcome.js';
import { casesCsv, download, importWorkspace } from './workspace.js';
import { chooseTour, projectReviews, publicDataset, readSelection, selectCases, summarize, workflowOptions } from './review-model.js';
import { renderReplay } from './replay.js';
import { currentReviewer, mountAccount } from './account.js';
import './assistant.js';

const $ = id => document.getElementById(id);
const states = { observed: 'Observed', inferred: 'Inferred link', missing: 'Evidence gap' };
const sources = { email: 'Outlook', teams: 'Teams', calendar: 'Calendar', screen: 'Screen log' };
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Colombo' });
const timestamp = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo',
});
const number = new Intl.NumberFormat('en');
let citationHandler = null;

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

function openRecord(record, expanded, isDemo, onCorrection) {
  const removed = record.correction?.action === 'unlink';
  const details = node('details', undefined, removed ? 'record removed-record' : 'record');
  details.dataset.evidenceId = record.id;
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
  if (removed) {
    const restore = node('button', 'Restore link', 'quiet link-action');
    restore.type = 'button';
    restore.onclick = () => onCorrection(record, 'restore');
    body.append(node('p', `Reason for removal: ${record.correction.reason}`, 'removed-reason'), restore);
  } else {
    const edit = node('button', 'Remove link', 'quiet link-action');
    edit.type = 'button';
    const correction = node('form', undefined, 'correction-form');
    correction.hidden = true;
    const note = node('textarea');
    note.rows = 2;
    note.maxLength = 500;
    note.required = true;
    note.setAttribute('aria-label', 'Why remove this link?');
    note.placeholder = 'Why remove this link?';
    note.oninput = () => note.setCustomValidity('');
    const cancel = node('button', 'Cancel', 'quiet');
    cancel.type = 'button';
    cancel.onclick = () => {
      correction.hidden = true;
      edit.hidden = false;
      edit.focus();
    };
    const submit = node('button', 'Remove link', 'secondary');
    submit.type = 'submit';
    const actions = node('div', undefined, 'actions');
    actions.append(submit, cancel);
    correction.append(node('p', 'The original record and matching reason will stay in the review history.'), note, actions);
    correction.onsubmit = event => {
      event.preventDefault();
      const reason = note.value.trim();
      if (!reason) {
        note.setCustomValidity('Enter a reason for removing the link.');
        note.reportValidity();
        return;
      }
      onCorrection(record, 'unlink', reason);
    };
    edit.onclick = () => {
      correction.hidden = false;
      edit.hidden = true;
      note.focus();
    };
    body.append(edit, correction);
  }
  details.append(summary, body);
  return details;
}

function mount(workspace, { useLink = false, processKey, focusProcess = false } = {}) {
  const isDemo = workspace.dataset === publicDataset;
  const options = workflowOptions(workspace);
  const fromProcessLink = isDemo && useLink ? new URLSearchParams(location.hash.slice(1)).get('process') : null;
  const active = options.find(item => item.key === (processKey ?? fromProcessLink)) ?? options[0];
  const machineReport = active.report;
  const storageKey = active.primary
    ? `mission-control:v1:${machineReport.dataset}:reviews`
    : `mission-control:v1:${machineReport.dataset}:process:${encodeURIComponent(active.key)}:reviews`;
  const processSwitch = $('process-switch');
  processSwitch.hidden = options.length < 2;
  processSwitch.replaceChildren(...options.map(item => {
    const button = activated(item.report.process, 'process-choice', item === active, () => {
      if (item !== active) mount(workspace, { processKey: item.key, focusProcess: true });
    });
    const count = node('small', number.format(item.report.cases.length));
    count.setAttribute('aria-hidden', 'true');
    button.append(count);
    return button;
  }));
  if (focusProcess) processSwitch.querySelector('[aria-pressed="true"]')?.focus();
  let reviews = {};
  try { reviews = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {}; } catch {}
  let report = projectReviews(machineReport, reviews);
  let stops = active.primary ? chooseTour(report.cases) : [];
  const fromLink = isDemo && useLink ? readSelection(location.hash, report.cases) : null;
  let activeCase = fromLink?.item ?? report.cases[0];
  let activeStep = fromLink?.step ?? activeCase?.steps[0];
  let stage = '';
  let gapsOnly = false;
  let tourIndex = -1;

  $('process').textContent = report.process;
  $('dataset').textContent = isDemo ? 'Redacted assessment demo' : 'On-device import';
  $('description').textContent = machineReport.description ?? (isDemo
    ? active.primary
      ? 'Follow a laptop request from the first Teams message to the last record of delivery.'
      : 'Check which calls were booked, which conversations were reported, and which candidates replied.'
    : 'Choose a case to see its source records and check the links.');
  $('period').textContent = isDemo ? 'Harbourline Talent / March 2026' : 'Your workspace';
  $('period').hidden = false;
  $('case-lab').hidden = !activeCase;
  $('load-state').hidden = Boolean(activeCase);
  $('load-state').textContent = 'No cases matched this workflow in the export.';
  $('counts').textContent = `${number.format(report.stats.rows ?? report.stats.normalized)} source rows / ${number.format(report.stats.linked)} linked records / Sri Lanka time`;
  $('copy-link').hidden = !isDemo || !activeCase;
  $('open-assistant').disabled = !activeCase;
  $('open-assistant').onclick = () => {
    if (!activeCase || !activeStep) return;
    $('open-assistant').dispatchEvent(new CustomEvent('mission-assistant', {
      bubbles: true, detail: { report, currentCase: activeCase, step: activeStep },
    }));
  };
  document.removeEventListener('mission-citation', citationHandler);
  citationHandler = null;
  $('start-tour').hidden = stops.length === 0;
  $('start-tour').disabled = false;
  $('case-search').value = '';
  $('tour').hidden = true;
  $('trace-controls').hidden = !activeCase;
  $('desk').classList.remove('tour-active');
  $('correction-status').textContent = '';
  for (const [id, filename, format, serialize] of [
    ['export-csv', 'mission-control-cases.csv', 'text/csv;charset=utf-8', () => casesCsv(report, reviews)],
    ['export-json', 'mission-control-evidence.json', 'application/json', () => JSON.stringify({ report, machineReport, reviews }, null, 2)],
  ]) {
    $(id).disabled = false;
    $(id).onclick = () => {
      download(filename, serialize(), format);
      $('export-menu').open = false;
      $('export-menu').querySelector('summary').focus();
    };
  }
  if (!activeCase) { renderReplay(report, null); return; }

  const activeKey = () => `${activeCase.id}/${activeStep.id}`;
  const focusButton = (container, index) => $(container).querySelectorAll('button')[index]?.focus();

  function showCase(item, stepId = stage) {
    activeCase = item;
    activeStep = item.steps.find(candidate => candidate.id === stepId) ??
      (gapsOnly ? item.steps.find(candidate => candidate.status === 'missing') : undefined) ?? item.steps[0];
  }

  function showInk(index) {
    const trace = $('ink-trace');
    const ticks = [...trace.children];
    trace.style.setProperty('--trace-progress', `${index < 0 ? 0 : index / Math.max(1, ticks.length - 1) * 100}%`);
    ticks.forEach((tick, position) => tick.classList.toggle('trace-active', position <= index));
  }

  function resetInk() {
    showInk(activeCase.steps.indexOf(activeStep));
  }

  function render() {
    const { stages, gaps } = summarize(report);
    $('insight').textContent = `${number.format(gaps)} of ${number.format(report.cases.length)} cases have an evidence gap.`;
    const removed = report.stats.removedEvidenceLinks ?? 0;
    const summary = [`${number.format(report.stats.rows ?? report.stats.normalized)} source rows`,
      `${number.format(report.stats.linked)} linked records`, 'Sri Lanka time'];
    if (removed) summary.splice(2, 0, `${number.format(removed)} ${removed === 1 ? 'link' : 'links'} removed in review`);
    $('counts').textContent = summary.join(' / ');
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
    $('open-assistant').disabled = !hasCases;
    $('desk').classList.toggle('no-cases', !hasCases);
    if (!hasCases) {
      $('case-list').append(node('p', 'No cases match these filters.', 'empty'));
      $('trace-controls').hidden = true;
      return;
    }
    $('trace-controls').hidden = false;
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
    renderReplay(report, activeCase);
    const trace = $('ink-trace');
    if (trace.children.length !== activeCase.steps.length) {
      trace.replaceChildren(...activeCase.steps.map(() => node('i')));
    }
    resetInk();
    $('steps').replaceChildren(...activeCase.steps.map((step, index) => {
      const li = node('li', undefined, `timeline-item ${step.status}`);
      const button = activated(undefined, 'step', step === activeStep, () => {
        activeStep = step;
        render();
        focusButton('steps', index);
      });
      button.onpointerenter = () => showInk(index);
      button.onpointerleave = resetInk;
      button.onfocus = () => showInk(index);
      button.onblur = resetInk;
      const primary = node('span', undefined, 'step-primary');
      primary.append(node('strong', step.label), badge(step.status));
      const decision = reviews[`${activeCase.id}/${step.id}`]?.decision;
      const record = step.evidence[0];
      const label = record
        ? [...new Set(step.evidence.map(item => sources[item.source] ?? item.source))].join(' + ')
        : step.excludedEvidence?.length ? 'Link removed in review' : 'No supporting record';
      const glyph = node('span', step.status === 'missing' ? '–' : step.status === 'inferred' ? '◈'
        : step.id === 'approved' || step.id === 'decision' ? '✓' : '•', 'step-index');
      glyph.setAttribute('aria-hidden', 'true');
      button.append(glyph, primary,
        node('small', decision ? `Reviewer: ${decision}` : label, 'step-meta'));
      li.append(button);
      return li;
    }));
    $('evidence-title').textContent = activeStep.label;
    $('evidence-context').replaceChildren(badge(activeStep.status), node('span', `${activeStep.evidence.length} ${activeStep.evidence.length === 1 ? 'record' : 'records'}`));
    $('records').replaceChildren(...activeStep.evidence.map((record, index) => openRecord(record, index === 0, isDemo, correct)));
    if (!activeStep.evidence.length) {
      const message = activeStep.excludedEvidence?.length
        ? 'All supporting links for this step were removed during review.'
        : 'No matching record was found in the export. Flag this step if the team should follow up.';
      $('records').append(node('p', message, 'empty evidence-gap'));
    }
    if (activeStep.excludedEvidence?.length) {
      const history = node('div', undefined, 'evidence-history');
      history.append(node('p', `Original status: ${states[activeStep.machineStatus]}`, 'history-caption'),
        ...activeStep.excludedEvidence.map(record => openRecord(record, true, isDemo, correct)));
      $('records').append(history);
    }
    const review = reviews[activeKey()];
    $('review-note').value = review?.note ?? '';
    $('review-state').textContent = review?.decision ? `Saved locally as ${review.decision}.` : 'Your review stays in this browser.';
    $('clear-review').hidden = !review?.decision;
    $('review-form').querySelector('[value="confirmed"]').disabled = activeStep.status === 'missing';
  }

  function save(decision) {
    const key = activeKey();
    const corrections = reviews[key]?.corrections ?? [];
    const updated = { ...reviews };
    if (decision) updated[key] = { decision, note: $('review-note').value.trim(), reviewer: currentReviewer, at: new Date().toISOString(), corrections };
    else if (corrections.length) updated[key] = { corrections };
    else delete updated[key];
    return persist(updated);
  }

  function persist(updated) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
      reviews = updated;
      return true;
    } catch {
      $('correction-status').textContent = 'Could not save this change. Browser storage is unavailable.';
      return false;
    }
  }

  function correct(record, action, reason) {
    const key = activeKey();
    const { decision, note, reviewer, at, corrections = [] } = reviews[key] ?? {};
    const previousReview = decision ? { decision, note, reviewer, at } : undefined;
    const update = { eventId: record.id, action, reason, reviewer: currentReviewer, at: new Date().toISOString(), previousReview };
    if (!persist({ ...reviews, [key]: { corrections: [...corrections, update] } })) return;
    report = projectReviews(machineReport, reviews);
    showCase(report.cases.find(item => item.id === activeCase.id), activeStep.id);
    if (!selectCases([activeCase], { stage, gapsOnly }).length) {
      stage = '';
      gapsOnly = false;
    }
    moveTour(-1);
    stops = active.primary ? chooseTour(report.cases) : [];
    $('start-tour').hidden = stops.length === 0;
    render();
    $('evidence-title').focus({ preventScroll: true });
    $('correction-status').textContent = action === 'unlink' ? 'Link removed from this step.' : 'Link restored to this step.';
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
    if (event.submitter?.value && save(event.submitter.value)) render();
  };
  $('clear-review').onclick = () => { if (save(null)) render(); $('review-note').focus(); };
  $('case-search').oninput = render;
  $('gaps-only').onclick = () => { gapsOnly = !gapsOnly; render(); };
  $('reset-filter').onclick = () => { clearFilters(); render(); $('case-search').focus(); };
  $('copy-link').onclick = async () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({ process: active.key, case: activeCase.id, step: activeStep.id }).toString();
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
  citationHandler = event => {
    const { caseId, stepId, evidenceId } = event.detail ?? {};
    const item = report.cases.find(candidate => candidate.id === caseId);
    if (!item || !item.steps.some(candidate => candidate.id === stepId)) return;
    clearFilters();
    moveTour(-1);
    showCase(item, stepId);
    render();
    const record = Array.from($('records').querySelectorAll('[data-evidence-id]'))
      .find(candidate => candidate.dataset.evidenceId === evidenceId);
    if (record) {
      record.open = true;
      record.querySelector('summary').focus();
    } else $('evidence-title').focus();
  };
  document.addEventListener('mission-citation', citationHandler);
  render();
  if (fromLink) $('case-lab').scrollIntoView({ block: 'start' });
}

async function start() {
  void mountAccount();
  const response = await fetch('/report.json');
  if (!response.ok) throw new Error('Report unavailable');
  const report = await response.json();
  mount(report, { useLink: true });
  const input = $('import-file');
  const feedback = $('workspace-status');
  const openPicker = () => input.click();
  const traceToggle = $('trace-toggle');
  function setMotion(paused) {
    document.documentElement.classList.toggle('motion-paused', paused);
    traceToggle.setAttribute('aria-pressed', String(paused));
    traceToggle.textContent = paused ? 'Resume motion' : 'Pause motion';
  }
  traceToggle.onclick = () => setMotion(traceToggle.getAttribute('aria-pressed') !== 'true');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) setMotion(true);
  $('import-button').disabled = false;
  $('import-button').onclick = openPicker;
  const showWelcome = () => openWelcome({
    report,
    onDemo() {
      mount(report);
      feedback.hidden = true;
    },
    onImport: openPicker,
  });
  $('welcome-button').onclick = showWelcome;
  try {
    if (!location.hash && !sessionStorage.getItem('mission-control:entry')) {
      sessionStorage.setItem('mission-control:entry', 'seen');
      showWelcome();
    }
  } catch { /* The casebook is available when session storage is blocked. */ }
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
