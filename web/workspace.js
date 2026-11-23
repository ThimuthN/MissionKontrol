import { readWorkspace } from './read-workspace.js';
export { casesCsv } from './csv.js';

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
