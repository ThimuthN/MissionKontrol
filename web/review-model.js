export const publicDataset = 'public-march2026';

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
    if (term && ![item.id, item.label, item.requestType, item.product].some(value => String(value ?? '').toLocaleLowerCase().includes(term))) return false;
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
