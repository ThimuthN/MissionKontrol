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
        <div class="welcome-brand"><span class="mark" aria-hidden="true"></span>Mission Control</div>
        <h2 id="welcome-title">Choose a dataset</h2>
        <p id="welcome-summary">Open the redacted assessment demo or inspect an export on this device.</p>
        <div class="welcome-actions">
          <button type="button" class="primary" data-welcome="demo" autofocus>Open demo <span class="arrow" aria-hidden="true"></span></button>
          <button type="button" class="secondary" data-welcome="import">Import ZIP</button>
          <button type="button" class="quiet" data-welcome="close">Cancel</button>
        </div>
      </div>
      <div class="welcome-visual" aria-hidden="true">
        <img class="welcome-illos" alt="" referrerpolicy="no-referrer" width="640" height="400">
        <div class="flow-illustration">
          <div class="flow-sources"><div>Outlook</div><div>Teams</div><div>ZIP</div></div>
          <div class="flow-link"></div>
          <div class="flow-card">
            <span class="flow-case">Workflow</span>
            <div class="flow-stage"><i></i><span>Observed step</span></div>
            <div class="flow-stage"><i></i><span>Inferred link</span></div>
            <div class="flow-stage"><i></i><span>Evidence gap</span></div>
          </div>
        </div>
      </div>
    </div>`;
  const illustration = element.querySelector('.welcome-illos');
  illustration.addEventListener('load', () => illustration.classList.add('is-ready'), { once: true });
  illustration.src = 'https://illos.dev/assets/styles/shader/data-pipeline.svg';
  for (const [action, callback] of [['demo', 'onDemo'], ['import', 'onImport'], ['close', 'onClose']]) {
    element.querySelector(`[data-welcome="${action}"]`).addEventListener('click', () => {
      element.close();
      handlers[callback]?.();
    });
  }
  document.body.append(element);
  return element;
}

export function openWelcome(options = {}) {
  handlers = options;
  dialog ??= createWelcome();
  if (!dialog.open) dialog.showModal();
  return dialog;
}
