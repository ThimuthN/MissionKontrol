import { workflowOptions } from './review-model.js';

const sourceNames = { email: 'Outlook', teams: 'Teams', calendar: 'Calendar', screen: 'Screen log' };
const date = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Colombo' });
let dialog;
let handlers;

function createWelcome() {
  const element = document.createElement('dialog');
  element.className = 'welcome';
  element.setAttribute('aria-labelledby', 'welcome-title');
  element.setAttribute('aria-describedby', 'welcome-summary');
  element.innerHTML = `
    <div class="welcome-layout">
      <div class="welcome-content">
        <div class="welcome-brand"><span class="mark" aria-hidden="true"></span>Mission Control <span class="welcome-kicker">/ WORKSPACES</span></div>
        <p class="welcome-eyebrow">GET STARTED</p>
        <h2 id="welcome-title">Choose a<br><em>workspace.</em></h2>
        <p id="welcome-summary"></p>
        <div class="welcome-actions">
          <button type="button" class="primary" data-welcome="demo" autofocus>Open sample data</button>
          <button type="button" class="secondary" data-welcome="import">Import ZIP</button>
          <button type="button" class="quiet" data-welcome="close">Close</button>
        </div>
      </div>
      <div class="welcome-visual">
        <div class="welcome-orbit" aria-hidden="true"><i></i><i></i><i></i></div>
        <figure class="source-sheet">
          <figcaption><span class="welcome-record-label"></span><time></time></figcaption>
          <blockquote></blockquote>
          <p class="welcome-visual-note"></p>
        </figure>
      </div>
    </div>`;
  for (const [action, callback] of [['demo', 'onDemo'], ['import', 'onImport'], ['close', 'onClose']]) {
    element.querySelector(`[data-welcome="${action}"]`).addEventListener('click', () => {
      element.close();
      handlers[callback]?.();
    });
  }
  document.body.append(element);
  return element;
}

function fillDemo(report) {
  const workflows = report ? workflowOptions(report) : [];
  const names = workflows.map(item => item.report.process.toLowerCase());
  dialog.querySelector('#welcome-summary').textContent = names.length
    ? `Harbourline sample data includes ${new Intl.ListFormat('en', { style: 'long', type: 'conjunction' }).format(names)}. You can also import a ZIP from your device.`
    : 'Open the sample data, or import a ZIP from your device.';
  const item = workflows[0]?.report.cases.find(candidate => candidate.steps[0]?.evidence[0]);
  const evidence = item?.steps[0]?.evidence[0];
  dialog.querySelector('.welcome-visual').hidden = !evidence;
  if (!evidence) return;
  dialog.querySelector('.welcome-record-label').textContent = `${item.label ?? item.id} · ${sourceNames[evidence.source] ?? evidence.source}`;
  const time = dialog.querySelector('time');
  time.dateTime = evidence.at;
  time.textContent = date.format(new Date(evidence.at));
  dialog.querySelector('blockquote').textContent = evidence.text;
  dialog.querySelector('.welcome-visual-note').textContent = `Source summary · ${evidence.reason}`;
}

export function openWelcome(options = {}) {
  handlers = options;
  dialog ??= createWelcome();
  fillDemo(options.report);
  if (!dialog.open) dialog.showModal();
  return dialog;
}
