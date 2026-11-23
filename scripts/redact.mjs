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
};

function safeReason(step, record) {
  if (step.id === 'ordered') return /first name/i.test(record.reason)
    ? 'Only the first name matched. The vendor, model and earlier approval narrowed the order to one request.'
    : 'The full recipient name, vendor and model matched one request that was approved before the email.';
  if (step.id === 'received') return /coordinator/i.test(record.reason)
    ? 'A coordinator reported receipt in the same request thread.'
    : 'The recipient named in the order reported receipt in a Teams chat after the order.';
  return reasons[step.id];
}

const publicCheckResults = {
  Recipient: ['First name only', 'Full name matched'],
  Supplier: ['Matched the approved quote'],
  'Laptop model': ['Matched the approved quote'],
  Approval: ['Recorded before the email'],
};

function safeChecks(checks = []) {
  return checks.filter(check => Object.hasOwn(publicCheckResults, check.label) && publicCheckResults[check.label].includes(check.result))
    .map(({ label, result, partial }) => ({ label, result, ...(partial === true && { partial: true }) }));
}
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
        const checks = safeChecks(record.checks);
        return {
          id: recordAlias, source: record.source, at: at.toISOString(), timeKind: 'Time rounded to 15 minutes',
          text: descriptions[step.id], reason: safeReason(step, record), origin: recordAlias,
          ...(checks.length && { checks }),
        };
      }),
    })),
  };
});
const publicReport = { version: 1, dataset: 'public-march2026', process: report.process, cases,
  stats: { ...report.stats, ...counts } };
await writeFile(new URL('../fixtures/assessment-demo.json', import.meta.url), JSON.stringify(publicReport, null, 2) + '\n');
console.log(`Prepared ${cases.length} redacted cases with ${recordId} evidence records.`);
