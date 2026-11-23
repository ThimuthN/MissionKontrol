// Make small, openable, identity-free examples of intermediate pipeline files.
// Run after `npm run ingest -- <original ZIP>`; never publish private/ itself.
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const source = name => new URL(`../private/${name}.json`, import.meta.url);
const destination = name => new URL(`../docs/examples/${name}.json`, import.meta.url);
const read = async url => JSON.parse(await readFile(url, 'utf8'));
const [counts, original, normalized, links, publicReport] = await Promise.all([
  read(source('counts')), read(source('report')), read(source('normalized')),
  read(source('links')), read(new URL('../fixtures/assessment-demo.json', import.meta.url)),
]);

const originalProcesses = [original, ...(original.processes ?? [])];
const publicProcesses = [publicReport, ...(publicReport.processes ?? [])];
const selections = [[0, 1], [1, 0]]; // LP-02 illustrates an inferred order; RC-01 illustrates a calendar slot.
const eventAliases = new Map();
const caseAliases = new Map();
const exposedEvents = [];
const excerpts = [];

for (const [processIndex, caseIndex] of selections) {
  const privateProcess = originalProcesses[processIndex];
  const safeProcess = publicProcesses[processIndex];
  if (!privateProcess || !safeProcess?.cases[caseIndex]) throw new Error('Report shape changed; review sample selection.');
  const originalCase = privateProcess.cases[caseIndex];
  const safeCase = safeProcess.cases[caseIndex];
  caseAliases.set(`${privateProcess.process}:${originalCase.id}`, safeCase.id);

  for (const [stepIndex, step] of originalCase.steps.entries()) {
    const safeStep = safeCase.steps[stepIndex];
    for (const [evidenceIndex, record] of step.evidence.entries()) {
      const safeEvidence = safeStep.evidence[evidenceIndex];
      if (!safeEvidence) throw new Error('Redacted report and original report are out of sync.');
      eventAliases.set(record.id, safeEvidence.id);
      const originalEvent = normalized.find(item => item.id === record.id);
      if (!originalEvent) throw new Error(`No normalized source for ${record.id}`);
      exposedEvents.push({
        id: safeEvidence.id, source: originalEvent.source, at: safeEvidence.at,
        timeKind: safeEvidence.timeKind, text: safeEvidence.text,
        origin: safeEvidence.origin, origins: [safeEvidence.origin],
      });
    }
  }
  excerpts.push({
    version: safeProcess.version, dataset: safeProcess.dataset,
    process: safeProcess.process, cases: [safeCase],
    // Counts refer to the full process, not this tiny excerpt.
    stats: safeProcess.stats,
  });
}

const publicLinks = links.filter(link => eventAliases.has(link.eventId))
  .map(link => ({
    process: link.process, eventId: eventAliases.get(link.eventId),
    caseId: caseAliases.get(`${link.process}:${link.caseId}`),
    stage: link.stage, rule: link.rule,
  }));
if (publicLinks.some(link => !link.caseId)) throw new Error('Sample has an unrecognized case link.');

await mkdir(new URL('../docs/examples/', import.meta.url), { recursive: true });
const outputs = {
  counts,
  'normalized.sample': exposedEvents,
  'rejected.sample': [],
  'links.sample': publicLinks,
  'report.sample': { ...excerpts[0], processes: excerpts.slice(1) },
};
await Promise.all(Object.entries(outputs).map(([name, data]) =>
  writeFile(destination(name), `${JSON.stringify(data, null, 2)}\n`)));
console.log(`Wrote ${exposedEvents.length} redacted source examples and ${publicLinks.length} link examples.`);
