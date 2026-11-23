export const publicDataset = 'public-march2026';

// A workflow question is either an unverified proposed link or a checkpoint
// without a source. Keep confirmed/flagged decisions out of the open queue.
export function reviewPriorities(cases, reviews) {
  const open = cases.flatMap(item => item.steps
    .filter(step => (step.status === 'inferred' || step.status === 'missing') &&
      !reviews[`${item.id}/${step.id}`]?.decision)
    .map(step => ({ item, step })));
  return [...open.filter(entry => entry.step.status === 'inferred'),
    ...open.filter(entry => entry.step.status === 'missing')];
}

export function nextReview(cases, reviews, currentCase, currentStep) {
  const candidates = cases.flatMap(item => item.steps.map(step => ({ item, step })));
  const index = candidates.findIndex(({ item, step }) => item.id === currentCase && step.id === currentStep);
  const after = [...candidates.slice(index + 1), ...candidates.slice(0, Math.max(0, index))];
  const open = after.filter(({ item, step }) => !reviews[`${item.id}/${step.id}`]?.decision);
  return open.find(({ step }) => step.status === 'inferred') ?? open.find(({ step }) => step.status === 'missing');
}

export function workflowOptions(workspace) {
  const { processes = [], ...primary } = workspace;
  const siblings = Array.isArray(processes) ? processes : Object.values(processes ?? {});
  return [primary, ...siblings.filter(item => Array.isArray(item?.cases) && item.process !== primary.process)]
    .map((report, index) => ({
      key: String(report.id ?? report.process),
      primary: index === 0,
      report: { ...report, dataset: workspace.dataset, stats: { ...workspace.stats, ...report.stats } },
    }));
}

export function projectReviews(report, reviews) {
  const removals = new Map();
  const cases = report.cases.map(item => ({
    ...item,
    steps: item.steps.map(step => {
      const key = `${item.id}/${step.id}`;
      const history = reviews[key]?.corrections ?? [];
      const current = new Map(history.map(entry => [entry.eventId, entry]));
      const excludedEvidence = step.evidence.flatMap(record => {
        const correction = current.get(record.id);
        if (correction?.action !== 'unlink') return [];
        return [{ ...record, correction }];
      });
      if (!excludedEvidence.length) return step;
      const removed = new Set(excludedEvidence.map(record => record.id));
      removals.set(key, removed);
      const evidence = step.evidence.filter(record => !removed.has(record.id));
      const inferred = step.status === 'inferred' ||
        evidence.every(record => record.status === 'inferred' || record.checks?.some(check => check.partial));
      return {
        ...step,
        machineStatus: step.status,
        status: evidence.length === 0 ? 'missing' : inferred ? 'inferred' : 'observed',
        evidence,
        excludedEvidence,
      };
    }),
  }));
  if (removals.size === 0) return report;
  const acceptedLinks = report.links?.filter(link => !removals.get(`${link.caseId}/${link.stage}`)?.has(link.eventId));
  const removedEvidenceLinks = [...removals.values()].reduce((count, records) => count + records.size, 0);
  const linked = new Set(cases.flatMap(item => item.steps.flatMap(step => step.evidence.map(record => record.id)))).size;
  return {
    ...report, cases, ...(acceptedLinks && { links: acceptedLinks }),
    stats: { ...report.stats, linked, unlinked: report.stats.normalized - linked, removedEvidenceLinks },
  };
}

export function summarize(report) {
  const definitions = report.cases[0]?.steps ?? [];
  const stages = definitions.map(({ id, label }) => ({
    id, label, supported: report.cases.filter(item => item.steps.some(step => step.id === id && step.evidence.length)).length,
  }));
  const gaps = report.cases.filter(item => item.steps.some(step => step.status === 'missing')).length;
  return { stages, gaps };
}

export function chooseTour(cases) {
  const complete = cases.find(item => item.steps.every(step => step.status === 'observed'));
  const inference = cases.find(item => item.steps.some(step => step.status === 'inferred'));
  const gap = cases.find(item => item.steps.some(step => step.id === 'ordered' && step.evidence.length) &&
    item.steps.some(step => step.id === 'received' && step.status === 'missing'));
  const stops = [];
  if (complete) stops.push({
    caseId: complete.id, stepId: complete.steps[0].id, title: 'Start with the thread',
    text: 'This case has evidence at every stage. Open the request, then follow the quote and approval in the same Teams thread.',
  });
  if (inference) stops.push({
    caseId: inference.id, stepId: inference.steps.find(step => step.status === 'inferred').id,
    title: 'Challenge the match',
    text: 'The order matches one approved request by vendor, model and timing. The recipient match uses only a first name, so the step stays marked as inferred.',
  });
  if (gap) stops.push({
    caseId: gap.id, stepId: 'received', title: 'Stop where the evidence stops',
    text: 'Outlook confirms the order, but the export contains no matching receipt report. Flag the gap for follow-up without changing the source record.',
  });
  return stops;
}

export function selectCases(cases, { query = '', stage = '', gapsOnly = false } = {}) {
  const term = query.trim().toLocaleLowerCase();
  return cases.filter(item => {
    if (term && ![item.id, item.label, item.requestType, item.product, item.role].some(value => String(value ?? '').toLocaleLowerCase().includes(term))) return false;
    if (stage) return item.steps.some(step => step.id === stage && (gapsOnly ? step.status === 'missing' : step.evidence.length > 0));
    return !gapsOnly || item.steps.some(step => step.status === 'missing');
  });
}

export function readSelection(hash, cases) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const item = cases.find(candidate => candidate.id === params.get('case'));
  if (!item) return null;
  return { item, step: item.steps.find(candidate => candidate.id === params.get('step')) ?? item.steps[0] };
}
