import { readWorkspace } from './read-workspace.js';

export async function importWorkspace(file) {
  if (typeof Worker !== 'function') return readWorkspace(file);
  let worker;
  try { worker = new Worker(new URL('./import-worker.js', import.meta.url), { type:'module' }); }
  catch { return readWorkspace(file); }
  try {
    return await new Promise((resolve, reject) => {
      worker.onmessage = ({ data }) => data.error ? reject(new Error(data.error)) : resolve(data.report);
      worker.onmessageerror = () => reject(new Error('Couldn’t open the imported report. Try the ZIP again.'));
      worker.onerror = event => {
        event.preventDefault();
        // A browser can expose Worker while blocking module workers.
        worker.terminate();
        resolve(readWorkspace(file));
      };
      worker.postMessage(file);
    });
  } finally { worker.terminate(); }
}

export function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(input) {
  let text = String(input ?? '');
  if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

export function casesCsv(report, reviews) {
  const rows = [['Workflow', 'Case', 'Request type', 'Role', 'Stage', 'Evidence status', 'Evidence count', 'Reviewer decision', 'Note', 'Reviewer', 'Reviewed at']];
  for (const item of report.cases) for (const step of item.steps) {
    const review = reviews[`${item.id}/${step.id}`];
    rows.push([report.process, item.label ?? item.id, item.requestType, item.role, step.label, step.status,
      step.evidence.length, review?.decision, review?.note, review?.reviewer, review?.at]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
