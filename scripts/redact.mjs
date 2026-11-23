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
  screening_scheduled: 'An Outlook event records the scheduled start of a screening call.',
  screening_reported: 'A Teams message reports that a recruiter spoke with the candidate.',
  interview_scheduled: 'An Outlook event records the scheduled start of a client interview.',
  offer_response: 'The candidate sent an explicit offer reply by email.',
};
const reasons = {
  requested: 'This message starts a procurement thread.',
  quoted: 'The quote is a reply under the original request.',
  approved: 'The approval is a reply after the quote in the same thread.',
  screening_scheduled: 'The calendar title identifies the candidate and role. Attendance is unverified.',
  interview_scheduled: 'The calendar title identifies the candidate and role. Attendance is unverified.',
  offer_response: 'The full candidate name and role matched an interview with an earlier scheduled start.',
};

function safeReason(step, record) {
  if (step.id === 'ordered') return /first name/i.test(record.reason)
    ? 'Only the first name matched. The vendor, model and earlier approval narrowed the order to one request.'
    : 'The full recipient name, vendor and model matched one request that was approved before the email.';
  if (step.id === 'received') return /coordinator/i.test(record.reason)
    ? 'A coordinator reported receipt in the same request thread.'
    : 'The recipient named in the order reported receipt in a Teams chat after the order.';
  if (step.id === 'screening_reported') return /alias/i.test(record.reason)
    ? 'A candidate alias, mailbox and nearby prior slot narrowed the report to one case.'
    : 'The full candidate name and mailbox matched a nearby prior scheduled screening.';
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
function safeText(step, outcome) {
  if (step.id === 'offer_response' && outcome === 'accepted') return 'The candidate explicitly accepted the offer by email.';
  if (step.id === 'offer_response' && outcome === 'declined') return 'The candidate declined or reported accepting another offer.';
  if (!Object.hasOwn(descriptions, step.id)) throw new Error(`No public evidence template for step ${step.id}`);
  return descriptions[step.id];
}

let recordId = 0;
function redactProcess(source, prefix) {
  const cases = source.cases.map((item, caseIndex) => {
    const alias = `${prefix}-${String(caseIndex + 1).padStart(2, '0')}`;
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
            id: recordAlias, source: record.source, at: at.toISOString(),
            timeKind: record.timeKind === 'Scheduled start' ? 'Scheduled start, rounded to 15 minutes' : 'Time rounded to 15 minutes',
            text: safeText(step, record.outcome), reason: safeReason(step, record), origin: recordAlias,
            status: record.status === 'inferred' ? 'inferred' : 'observed',
            ...(checks.length && { checks }),
          };
        }),
      })),
    };
  });
  return { version: 1, dataset: 'public-march2026', process: source.process, cases,
    stats: { ...source.stats, ...counts } };
}

const publicReport = redactProcess(report, 'LP');
if (report.processes?.length) {
  publicReport.processes = report.processes.map((process, index) => redactProcess(process, index === 0 ? 'RC' : `P${index + 2}`));
}
await writeFile(new URL('../fixtures/assessment-demo.json', import.meta.url), JSON.stringify(publicReport, null, 2) + '\n');
const totalCases = [publicReport, ...(publicReport.processes ?? [])].reduce((sum, process) => sum + process.cases.length, 0);
console.log(`Prepared ${totalCases} redacted cases with ${recordId} evidence records.`);
