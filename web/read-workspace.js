import { parseExport } from './src/normalize.mjs';
import { assemble } from './src/pipeline.mjs';
import { extractExport } from './src/zip.mjs';

export async function readWorkspace(file) {
  if (file.size > 30 * 1024 * 1024) throw new Error('Choose a ZIP under 30 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const dataset = Array.from(digest.slice(0, 12), value => value.toString(16).padStart(2, '0')).join('');
  const { events, counts, rejected } = await parseExport(extractExport(bytes));
  const report = assemble(events, dataset);
  return { ...report, stats: { ...report.stats, ...counts }, rejected };
}
