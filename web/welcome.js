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
        <div class="welcome-brand"><span class="mark" aria-hidden="true">M</span> Mission Control</div>
        <h2 id="welcome-title">See how<br> work happened.</h2>
        <p id="welcome-summary">Follow a workflow across tools, inspect the supporting records, and review the steps that need a second look.</p>
        <div class="welcome-actions">
          <button type="button" class="welcome-primary" data-welcome="demo" autofocus>Open demo <span aria-hidden="true">↗</span></button>
          <button type="button" class="welcome-secondary" data-welcome="import">Import data</button>
        </div>
      </div>
      <div class="welcome-visual" aria-hidden="true">
        <img class="welcome-illos" alt="" referrerpolicy="no-referrer" width="640" height="400">
        <div class="flow-illustration">
          <div class="flow-sources">
            <div><i></i> Outlook</div>
            <div><i></i> Teams</div>
            <div><i></i> Calendar</div>
          </div>
          <div class="flow-link"></div>
          <div class="flow-card">
            <span class="flow-case">Workflow</span>
            <div class="flow-stage"><i></i><span>Observed step</span><span>✓</span></div>
            <div class="flow-stage"><i></i><span>Inferred step</span><span>?</span></div>
            <div class="flow-stage"><i></i><span>Evidence gap</span><span>—</span></div>
          </div>
        </div>
      </div>
    </div>`;
  const illustration = element.querySelector('.welcome-illos');
  illustration.addEventListener('load', () => illustration.classList.add('is-ready'), { once: true });
  illustration.src = 'https://illos.dev/assets/styles/shader/data-pipeline.svg';
  element.querySelector('[data-welcome="demo"]').addEventListener('click', () => {
    element.close();
    handlers.onDemo?.();
  });
  element.querySelector('[data-welcome="import"]').addEventListener('click', () => {
    element.close();
    handlers.onImport?.();
  });
  document.body.append(element);
  return element;
}

export function openWelcome({ onDemo, onImport } = {}) {
  handlers = { onDemo, onImport };
  dialog ??= createWelcome();
  if (!dialog.open) dialog.showModal();
  return dialog;
}
