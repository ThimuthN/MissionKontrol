import { parseExport } from './src/normalize.mjs';
import { assemble } from './src/pipeline.mjs';
import { extractExport } from './src/zip.mjs';

export async function importWorkspace(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose a ZIP under 30 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const dataset = Array.from(digest.slice(0, 12), value => value.toString(16).padStart(2, '0')).join('');
  const { events, counts, rejected } = await parseExport(extractExport(bytes));
  const report = assemble(events, dataset);
  return { ...report, stats: { ...report.stats, ...counts }, rejected };
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
  const rows = [['Case', 'Request type', 'Stage', 'Evidence status', 'Evidence count', 'Reviewer decision', 'Note']];
  for (const item of report.cases) for (const step of item.steps) {
    const review = reviews[`${item.id}/${step.id}`];
    rows.push([item.label ?? item.id, item.requestType, step.label, step.status, step.evidence.length, review?.decision, review?.note]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
