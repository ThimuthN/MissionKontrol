import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createLocalProfile, signInLocalProfile } from '../web/account.js';
import { investigate } from '../web/assistant-engine.js';
import { casesCsv } from '../web/csv.js';
import { nextReview, projectReviews, reviewPriorities } from '../web/review-model.js';

const original = JSON.parse(await readFile(new URL('../fixtures/assessment-demo.json', import.meta.url)));

test('a reviewer can sign up, correct an uncertain order, follow up on a gap and export the result', async () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const person = await createLocalProfile('Morgan Lee', 'morgan@example.test', 'correct-horse-2026', storage, 'dark');
  assert.equal(person.appearance, 'dark');
  assert.equal((await signInLocalProfile('morgan@example.test', 'correct-horse-2026', storage)).name, 'Morgan Lee');

  const lp02 = original.cases.find(item => item.id === 'LP-02');
  const order = lp02.steps.find(step => step.id === 'ordered');
  assert.equal(order.status, 'inferred');
  assert.equal(order.evidence[0].checks.find(check => check.label === 'Recipient').partial, true);

  const key = 'LP-02/ordered';
  const reviews = { [key]: {
    corrections: [{ eventId: order.evidence[0].id, action: 'unlink', reason: 'Requester not confirmed',
      reviewer: person.name, at: '2026-11-23T10:00:00.000Z' }],
  } };
  const report = projectReviews(original, reviews);
  const corrected = report.cases.find(item => item.id === 'LP-02').steps.find(step => step.id === 'ordered');
  assert.equal(corrected.status, 'missing');
  assert.equal(corrected.evidence.length, 0);
  assert.equal(corrected.excludedEvidence[0].correction.reason, 'Requester not confirmed');
  assert.equal(report.stats.removedEvidenceLinks, 1);
  if (report.links) assert.ok(!report.links.some(link => link.caseId === 'LP-02' && link.stage === 'ordered' && link.eventId === order.evidence[0].id));

  const lp10 = report.cases.find(item => item.id === 'LP-10');
  const receipt = lp10.steps.find(step => step.id === 'received');
  assert.equal(receipt.status, 'missing');
  reviews['LP-10/received'] = { decision: 'flagged', note: 'Ask the receiving team', reviewer: person.name,
    at: '2026-11-23T10:05:00.000Z' };
  const queue = reviewPriorities(report.cases, reviews);
  assert.ok(!queue.some(({ item, step }) => item.id === 'LP-10' && step.id === 'received'));
  assert.ok(queue.some(({ item, step }) => item.id === 'LP-02' && step.id === 'ordered'));
  assert.ok(nextReview(report.cases, reviews, 'LP-10', 'received'));

  const answer = investigate({ report, currentCase: report.cases.find(item => item.id === 'LP-02'), step: corrected },
    'What needs checking?', 'review');
  assert.ok(answer.findings.some(entry => entry.ref?.stepId === 'ordered'));
  assert.ok(answer.findings.every(entry => !entry.ref?.evidenceId || entry.ref.evidenceId !== order.evidence[0].id));

  const exportText = casesCsv(report, reviews);
  assert.ok(exportText.includes('Ask the receiving team'));
  assert.ok(exportText.includes('Morgan Lee'));
  assert.ok(exportText.includes('missing'));
  storage.setItem('mission-control:reviews:morgan@example.test', JSON.stringify(reviews));
  assert.deepEqual(JSON.parse(storage.getItem('mission-control:reviews:morgan@example.test')), reviews);
});

test('calendar bookings remain distinct from reported conversations in the public journey', () => {
  const recruitment = original.processes[0];
  const rc01 = recruitment.cases.find(item => item.id === 'RC-01');
  assert.equal(rc01.steps.find(step => step.id === 'screening_scheduled').status, 'observed');
  assert.equal(rc01.steps.find(step => step.id === 'screening_reported').status, 'inferred');
  const attendance = investigate({ report: recruitment, currentCase: rc01, step: rc01.steps[0] },
    'Did the interview happen?', 'search');
  assert.match(attendance.intro, /attendance is not confirmed/i);
  assert.equal(rc01.steps.find(step => step.id === 'offer_response').status, 'missing');
});
