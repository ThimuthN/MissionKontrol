import { openWelcome } from './welcome.js';
import { casesCsv, download, importWorkspace } from './workspace.js';

const $ = id => document.getElementById(id);
const statusLabels = { observed: 'Observed', inferred: 'Inferred', missing: 'Evidence missing' };
const sourceLabels = { email: 'Outlook', teams: 'Teams', calendar: 'Calendar', screen: 'Screen log' };
const timestamp = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Colombo',
});

function node(tag, value, className) {
  const el = document.createElement(tag);
  if (value) el.textContent = value;
  if (className) el.className = className;
  return el;
}

function mount(report) {
  const storageKey = `mission-control:v1:${report.dataset}:reviews`;
  let reviews = {};
  try { reviews = JSON.parse(localStorage.getItem(storageKey) ?? '{}') ?? {}; } catch { /* A fresh session still works. */ }
  $('process').textContent = report.process;
  $('dataset').textContent = report.dataset === 'public-march2026' ? 'Redacted assessment demo' : 'Local import';
  $('description').textContent = report.dataset === 'public-march2026'
    ? 'Follow a laptop request from its first Teams message through approval, purchase, and receipt.'
    : 'Inspect the evidence behind each step and record what needs review.';
  $('counts').textContent = `${(report.stats.rows ?? report.stats.normalized).toLocaleString()} source rows / ${report.stats.linked.toLocaleString()} linked events / Sri Lanka time`;
  $('desk').hidden = !report.cases.length;
  $('overview').hidden = !report.cases.length;
  $('load-state').hidden = report.cases.length > 0;
  $('load-state').textContent = 'No laptop procurement cases matched this export.';
  $('case-search').value = '';
  $('export-csv').onclick = () => {
    download('mission-control-cases.csv', casesCsv(report, reviews), 'text/csv;charset=utf-8');
    $('export-menu').open = false;
  };
  $('export-json').onclick = () => {
    download('mission-control-evidence.json', JSON.stringify({ report, reviews }, null, 2), 'application/json');
    $('export-menu').open = false;
  };
  if (!report.cases.length) return;

  let activeCase = report.cases[0];
  let activeStep = activeCase.steps[0];
  let stageFilter = '';
  const stepDefinitions = report.cases[0].steps;
  const activeKey = () => `${activeCase.id}/${activeStep.id}`;
  const moveFocus = (container, index) => $(container).querySelectorAll('button')[index]?.focus();

  function render() {
    const term = $('case-search').value.trim().toLowerCase();
    const filtered = report.cases.filter(item =>
      [item.id, item.label, item.requestType, item.product].some(value => value?.toLowerCase().includes(term)) &&
      (!stageFilter || item.steps.some(step => step.id === stageFilter && step.evidence.length)));
    $('overview').replaceChildren(...stepDefinitions.map((step, index) => {
      const button = node('button', null, 'stage-filter');
      const count = report.cases.filter(item => item.steps.some(s => s.id === step.id && s.evidence.length)).length;
      button.append(node('span', step.label), node('strong', `${count}`), node('small', `of ${report.cases.length} cases`));
      button.setAttribute('aria-pressed', String(stageFilter === step.id));
      button.onclick = () => {
        stageFilter = stageFilter === step.id ? '' : step.id;
        if (stageFilter) activeStep = activeCase.steps.find(item => item.id === stageFilter) ?? activeStep;
        render();
        moveFocus('overview', index);
      };
      return button;
    }));
    $('reset-filter').hidden = !stageFilter;
    $('case-count').textContent = `${filtered.length}/${report.cases.length}`;
    if (filtered.length && !filtered.includes(activeCase)) {
      activeCase = filtered[0];
      activeStep = activeCase.steps.find(step => step.id === stageFilter) ?? activeCase.steps[0];
    }
    $('case-title').textContent = activeCase.label ?? activeCase.id;
    $('case-list').replaceChildren(...filtered.map((item, index) => {
      const itemButton = node('button', null, 'case-button');
      itemButton.append(node('strong', item.label ?? item.id),
        node('span', item.requestType ?? `${item.steps.filter(step => step.evidence.length).length} of ${item.steps.length} steps supported`));
      itemButton.setAttribute('aria-pressed', String(item.id === activeCase.id));
      itemButton.onclick = () => {
        activeCase = item;
        activeStep = item.steps[0];
        render();
        moveFocus('case-list', index);
      };
      return itemButton;
    }));
    $('steps').parentElement.hidden = !filtered.length;
    $('records').parentElement.hidden = !filtered.length;
    if (!filtered.length) $('case-list').append(node('p', 'No cases match these filters.', 'empty'));
    $('steps').replaceChildren(...activeCase.steps.map((step, index) => {
      const button = node('button', null, 'step');
      const content = node('span', null, 'step-content');
      const decision = reviews[`${activeCase.id}/${step.id}`]?.decision;
      content.append(node('strong', step.label),
        node('span', statusLabels[step.status], `status ${step.status}`),
        node('small', decision ? `Reviewer: ${decision}` : `${step.evidence.length} supporting records`));
      button.append(node('span', String(index + 1), 'step-index'), content);
      button.setAttribute('aria-pressed', String(step.id === activeStep.id));
      button.onclick = () => {
        activeStep = step;
        render();
        moveFocus('steps', index);
      };
      return button;
    }));
    $('evidence-title').textContent = activeStep.label;
    $('records').replaceChildren(...activeStep.evidence.map(record => {
      const details = node('details', null, 'record');
      const summary = node('summary');
      summary.append(node('strong', sourceLabels[record.source]), node('span', timestamp.format(new Date(record.at))));
      details.append(summary, node('p', record.text), node('p', record.reason, 'reason'),
        node('small', `${record.origin} · ${record.timeKind}`));
      return details;
    }));
    if (!activeStep.evidence.length) $('records').append(node('p', 'No matching source record was found for this step.', 'empty'));
    $('review-note').value = reviews[activeKey()]?.note ?? '';
    $('review-state').textContent = reviews[activeKey()] ? `Decision saved locally: ${reviews[activeKey()].decision}.` : 'Decisions are saved in this browser.';
    $('clear-review').hidden = !reviews[activeKey()];
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
      $('review-state').textContent = 'Browser storage is unavailable. Your decision could not be saved.';
    }
  }
  $('review-form').onsubmit = event => {
    event.preventDefault();
    if (event.submitter?.value) save(event.submitter.value);
  };
  $('clear-review').onclick = () => {
    save(null);
    $('review-note').focus();
  };
  $('case-search').oninput = render;
  $('reset-filter').onclick = () => { stageFilter = ''; render(); $('case-search').focus(); };
  render();
}

async function start() {
  const response = await fetch('/report.json');
  if (!response.ok) throw new Error('Report unavailable');
  const publicReport = await response.json();
  mount(publicReport);
  const input = $('import-file');
  const feedback = $('workspace-status');
  const openPicker = () => input.click();
  const showWelcome = () => openWelcome({
    onDemo() {
      mount(publicReport);
      feedback.hidden = true;
    },
    onImport: openPicker,
  });
  $('welcome-button').onclick = showWelcome;
  $('import-button').onclick = openPicker;
  input.onchange = async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    feedback.hidden = false;
    feedback.textContent = 'Reading the ZIP in this browser…';
    $('import-button').disabled = true;
    try {
      const report = await importWorkspace(file);
      mount(report);
      feedback.textContent = `${file.name} opened locally. ${report.stats.rejected} rows could not be read.`;
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      $('import-button').disabled = false;
    }
  };
  if (!sessionStorage.getItem('mission-control:welcome')) {
    const dialog = showWelcome();
    dialog.addEventListener('close', () => sessionStorage.setItem('mission-control:welcome', 'seen'), { once: true });
  }
}

start().catch(() => {
  $('load-state').textContent = 'The workflow report could not be loaded. Reload to try again.';
});
