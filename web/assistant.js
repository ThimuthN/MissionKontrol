import { briefText, investigate, plan } from './assistant-engine.js';
import { download } from './workspace.js';

const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = '/assistant.css';
document.head.append(css);

const drawer = document.createElement('dialog');
drawer.className = 'case-assistant';
drawer.setAttribute('aria-labelledby', 'assistant-heading');
drawer.innerHTML = `
  <header class="assistant-head"><div class="assistant-identity"><img src="/signal-mark.svg" alt="" aria-hidden="true"><div><p class="assistant-kicker">YOUR WORKFLOW GUIDE</p><h2 id="assistant-heading">Mica</h2></div></div>
    <button class="assistant-close" type="button" aria-label="Close assistant">×</button></header>
  <p class="assistant-context"></p>
  <div class="assistant-body"><div class="assistant-starters"><p>Where would you like to start?</p></div>
    <div class="assistant-log" role="log" aria-label="Conversation" aria-live="polite"></div></div>
  <form class="assistant-form"><label for="assistant-question">Your question</label>
    <div><textarea id="assistant-question" rows="2" maxlength="700" placeholder="What’s missing from this case?"></textarea>
    <button type="submit">Ask</button></div>
    <small>Your questions and records stay on this device.</small></form>`;
document.body.append(drawer);
const find = selector => drawer.querySelector(selector);
const log = find('.assistant-log');
const form = find('form');
const input = find('textarea');
const starters = find('.assistant-starters');
let context, previous = '', previousResult, activeRequest, contextKey, projection;

function element(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function display(result) {
  const group = document.createElement('article');
  group.className = 'assistant-answer';
  group.append(element('small', `${result.title} · Workspace insight`), element('p', result.intro));
  for (const finding of result.findings) {
    const section = document.createElement('section');
    section.append(element('strong', finding.title));
    if (finding.status) section.append(element('span', finding.status, 'assistant-state'));
    section.append(element('p', finding.message));
    if (finding.ref) {
      const ref = finding.ref;
      const link = element('button', (ref.evidenceId ? 'Open record · ' : 'Inspect stage · ') + ref.label);
      link.type = 'button';
      link.addEventListener('click', async () => {
        await closeDrawer();
        document.dispatchEvent(new CustomEvent('mission-citation', { detail: ref }));
      });
      section.append(link);
    }
    group.append(section);
  }
  if (result.canExport) {
    const save = element('button', 'Download team brief');
    save.type = 'button';
    save.onclick = () => download('team-brief.txt', briefText(result), 'text/plain;charset=utf-8');
    group.append(save);
  }
  log.append(group);
  group.scrollIntoView({ block: 'start' });
}
for (const title of ['Walk me through this case', 'What needs a second look?', 'Find a case to review next', 'Prepare a team brief']) {
  const button = element('button', title);
  button.type = 'button';
  button.onclick = () => { input.value = title; form.requestSubmit(); };
  starters.append(button);
}
let closing = false;
async function closeDrawer() {
  if (!drawer.open || closing) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { drawer.close(); return; }
  closing = true;
  try {
    await drawer.animate([{ transform: 'translateX(0)', opacity: 1 }, { transform: 'translateX(100%)', opacity: .55 }],
      { duration: 250, easing: 'cubic-bezier(.55,0,.9,.7)' }).finished;
  } catch { /* The dialog may already be closing. */ }
  drawer.close();
  closing = false;
}
find('.assistant-close').onclick = closeDrawer;
drawer.addEventListener('cancel', event => { event.preventDefault(); void closeDrawer(); });
drawer.addEventListener('close', () => activeRequest?.abort());
drawer.addEventListener('click', event => { if (event.target === drawer) {
  const rect = drawer.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) void closeDrawer();
} });
document.addEventListener('mission-assistant', ({ detail }) => {
  const key = JSON.stringify([detail.report.dataset, detail.report.process, detail.currentCase.id, detail.step.id]);
  if (key !== contextKey || projection !== detail.report) {
    activeRequest?.abort();
    previous = ''; previousResult = null; input.value = ''; log.replaceChildren(); starters.hidden = false;
    projection = detail.report; contextKey = key;
  }
  context = detail;
  find('.assistant-context').textContent = [detail.report.process, detail.currentCase.label ?? detail.currentCase.id, detail.step.label].join('  /  ');
  if (!drawer.open) drawer.showModal();
  input.focus();
});
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
});
form.onsubmit = async event => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question || activeRequest || !context) return;
  const controller = new AbortController();
  activeRequest = controller;
  const send = form.querySelector('button');
  send.disabled = true;
  input.value = '';
  starters.hidden = true;
  log.append(element('p', question, 'assistant-question'));
  const pending = element('p', 'Checking the case…', 'assistant-pending');
  log.append(pending);
  try {
    const { intent } = await plan(question, previous, globalThis.LanguageModel,
      AbortSignal.any([controller.signal, AbortSignal.timeout(4500)]));
    if (controller.signal.aborted) return;
    let scope = context;
    // A short follow-up like “why that link?” refers to the last cited stage.
    const last = previousResult?.findings.find(finding => finding.ref)?.ref;
    if (last && /\b(that|those|it)\b/i.test(question)) {
      const item = context.report.cases.find(candidate => candidate.id === last.caseId);
      const stage = item?.steps.find(candidate => candidate.id === last.stepId);
      if (stage) scope = { ...scope, currentCase: item, step: stage };
    }
    const result = investigate(scope, question, intent);
    previous = question; previousResult = result;
    display(result);
  } catch {
    if (!controller.signal.aborted) log.append(element('p', 'I couldn’t look that up. Try a stage name or ask for a case summary.'));
  } finally {
    pending.remove(); activeRequest = null; send.disabled = false;
    if (drawer.open) input.focus();
  }
};
