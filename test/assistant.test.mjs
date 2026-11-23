import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { briefText, classify, investigate, plan } from '../web/assistant-engine.js';
import { activityBuckets } from '../web/activity.js';
import { chronological } from '../web/replay.js';
import { projectReviews } from '../web/review-model.js';

const root = JSON.parse(await readFile(new URL('../fixtures/assessment-demo.json', import.meta.url), 'utf8'));
const recruitment = root.processes[0];
const currentCase = recruitment.cases[0];
const scope = { report: recruitment, currentCase, step: currentCase.steps[0] };

test('assistant routes review, coverage and source questions to distinct tools', () => {
  for (const [query, expected] of [['Walk me through this case', 'brief'], ['What needs a second look?', 'review'],
    ['Compare coverage across cases', 'coverage'], ['Did the interview happen?', 'search']]) assert.equal(classify(query), expected);
  const answer = investigate(scope, 'Did the interview happen?', 'search');
  assert.match(answer.findings[0].message, /scheduled/i);
  assert.match(answer.findings[0].message, /unverified/i);
  const cited = answer.findings[0].ref;
  assert.ok(currentCase.steps.find(step => step.id === cited.stepId).evidence.some(record => record.id === cited.evidenceId));
});

test('an unlinked record disappears from replay, case summary and source lookup', () => {
  const step = scope.step;
  const eventId = step.evidence[0].id;
  const projected = projectReviews(recruitment, { [currentCase.id + '/' + step.id]: { corrections: [{ eventId, action: 'unlink' }] } });
  const item = projected.cases[0];
  assert.ok(!chronological(item).some(row => row.record.id === eventId));
  const updated = { report: projected, currentCase: item, step: item.steps[0] };
  for (const intent of ['brief', 'review', 'search']) {
    const answer = investigate(updated, 'show the original', intent);
    assert.ok(!answer.findings.some(finding => finding.ref?.evidenceId === eventId));
  }
  assert.equal(investigate(updated, 'case summary', 'brief').findings[0].status, 'missing');
});

test('a browser model may select a registered tool only and each created session is released', async () => {
  let result = '"coverage"', closed = 0;
  const mock = { availability: async () => 'available', create: async () => ({ prompt: async () => result, destroy: () => closed++ }) };
  assert.equal((await plan('how often?', '', mock)).mode, 'On-device language model');
  result = '"delete"';
  assert.equal((await plan('what is missing?', '', mock)).intent, 'review');
  assert.equal(closed, 2);
  assert.equal((await plan('case summary', '', undefined)).mode, 'Local question classifier');
});

test('a named case resolves across the active process and coverage reads the full projection', () => {
  const item = recruitment.cases.at(-1);
  const answer = investigate(scope, 'Summarize ' + item.id, 'brief');
  assert.equal(answer.title, item.label);
  const coverage = investigate(scope, 'compare cases', 'coverage');
  assert.equal(coverage.findings.length, currentCase.steps.length);
  assert.match(coverage.intro, new RegExp(recruitment.cases.length + ' cases'));
});

test('triage gives a reviewer a navigable list ranked by inferred links and evidence gaps', () => {
  assert.equal(classify('Find a case to review next'), 'triage');
  const answer = investigate(scope, 'where next', 'triage');
  assert.equal(answer.findings.length, 3);
  for (const item of answer.findings) {
    const record = recruitment.cases.find(entry => entry.id === item.ref.caseId)
      .steps.find(entry => entry.id === item.ref.stepId).evidence.find(entry => entry.id === item.ref.evidenceId);
    assert.equal(record.status, 'inferred');
  }
});

test('team brief and date strip count linked records across the effective workflow', () => {
  assert.equal(classify('Prepare a team brief'), 'handoff');
  const result = investigate({ report:root, currentCase:root.cases[0], step:root.cases[0].steps[0] }, 'handoffs', 'handoff');
  assert.match(briefText(result), /13 of 15 cases/);
  assert.match(briefText(result), /6 of 15 cases/);
  assert.ok(result.findings.every(item => root.cases.some(entry => entry.id === item.ref.caseId)));
  assert.equal(activityBuckets(root).reduce((count, bucket) => count + bucket.count, 0), root.stats.linked);
});
