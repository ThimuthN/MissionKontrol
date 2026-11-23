import { readFile, writeFile } from 'node:fs/promises';

const input = new URL('../private/report.json', import.meta.url);
const counts = JSON.parse(await readFile(new URL('../private/counts.json', import.meta.url), 'utf8'));
const report = JSON.parse(await readFile(input, 'utf8'));
const descriptions = {
  requested: 'The procurement channel records a laptop request and a required-by date.',
  quoted: 'A supplier and price were proposed in the request thread.',
  approved: 'The quote received approval in the request thread.',
  ordered: 'A supplier email records an order and names the delivery recipient.',
  received: 'A Teams message reports that the laptop was received.',
};
const reasons = {
  requested: 'This message starts a procurement thread.',
  quoted: 'The quote is a reply under the original request.',
  approved: 'The approval is a reply after the quote in the same thread.',
  ordered: 'The recipient, quoted model, vendor and earlier approval point to one request.',
  received: 'The message was linked by the original thread or a matching recipient after the order.',
};
let recordId = 0;
const cases = report.cases.map((item, caseIndex) => {
  const alias = `LP-${String(caseIndex + 1).padStart(2, '0')}`;
  return {
    id: alias, label: alias,
    requestType: ['new starter', 'replacement'].includes(item.requestType) ? item.requestType : undefined,
    steps: item.steps.map(step => ({
      id: step.id, label: step.label, status: step.status,
      evidence: step.evidence.map(record => {
        const recordAlias = `Source record ${String(++recordId).padStart(2, '0')}`;
        const at = new Date(record.at);
        at.setUTCMinutes(Math.floor(at.getUTCMinutes() / 15) * 15, 0, 0);
        return {
          id: recordAlias, source: record.source, at: at.toISOString(), timeKind: 'Time rounded to 15 minutes',
          text: descriptions[step.id], reason: reasons[step.id], origin: recordAlias,
        };
      }),
    })),
  };
});
const publicReport = { version: 1, dataset: 'public-march2026', process: report.process, cases,
  stats: { ...report.stats, ...counts } };
await writeFile(new URL('../fixtures/assessment-demo.json', import.meta.url), JSON.stringify(publicReport, null, 2) + '\n');
console.log(`Prepared ${cases.length} redacted cases with ${recordId} evidence records.`);
