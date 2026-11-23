import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, fromFixture } from '../src/pipeline.mjs';
import fixture from '../fixtures/interviews.json' with { type: 'json' };

test('a calendar window and ambiguous match do not establish a booked interview', () => {
  const ambiguous = { id: 'ambiguous', source: 'calendar', at: fixture[0].at,
    text: 'Interview INT-104 or INT-108', origin: 'Sample / ambiguous' };
  const report = assemble(fromFixture([...fixture, ambiguous]), 'sample');
  const missing = report.cases.find(item => item.id === 'INT-108').steps.find(step => step.id === 'booked');
  assert.equal(missing.status, 'missing');
  assert.deepEqual(missing.evidence, []);
  assert.equal(report.stats.unlinked, 2);
  assert.ok(report.cases.flatMap(item => item.steps).flatMap(step => step.evidence).every(record => record.origin));
});

test('evidence is chronological after timezone normalization', () => {
  const report = assemble(fromFixture([...fixture].reverse()), 'sample');
  const coordinated = report.cases.find(item => item.id === 'INT-104').steps.find(step => step.id === 'coordinated');
  assert.deepEqual(coordinated.evidence.map(record => record.at), [
    '2026-03-09T05:02:00.000Z', '2026-03-09T05:35:00.000Z',
  ]);
});

function channel(id, day, text, replyToId = null, channelName = 'IT requests') {
  return { id, providerId: id, source: 'teams', scope: 'channel', channelName, replyToId,
    at: `2026-03-${day}T10:00:00Z`, text, origin: `teams_channel/messages.jsonl:${id}` };
}

function order(id, day, recipient) {
  const subject = `Order confirmation LA-${id}`;
  const body = `1 x Vivobook 15\nDeliver to: ${recipient}\n\nLapworks Trading`;
  return { id: `email-${id}`, source: 'email', actor: 'Lapworks Trading',
    at: `2026-03-${day}T10:00:00Z`, origin: `ravi/outlook/messages.jsonl:${id}`,
    subject, body, text: `${subject} · ${body}` };
}

const quote = 'Vivobook 15 from Lapworks, ~836 AUD, ok?';
const request = name => `Laptop needed for ${name} (new starter), Ingram, needed by Wed 11 Mar`;
const journey = (id, name) => [
  channel(id, '10', request(name)),
  channel(`${id}-quote`, '11', quote, id),
  channel(`${id}-approve`, '12', 'Go ahead 👍', id),
];

test('same product orders link by unique recipient, and unsupported approvals stay unlinked', () => {
  const report = assemble([
    ...journey('a', 'Chiara Ekwueme'),
    ...journey('b', 'Vida'),
    channel('c', '10', request('Otto')),
    channel('c-quote', '11', quote, 'c'),
    channel('cross-channel', '12', 'Approved', 'c', 'Other'),
    order('1', '13', 'Vida Faraday'), order('2', '13', 'Chiara Ekwueme'),
    order('3', '13', 'Otto Varga'), order('4', '11', 'Chiara Ekwueme'),
  ].reverse(), 'assessment');
  const [chiara, vida, otto] = report.cases;
  assert.equal(chiara.orderReference, 'LA-2');
  assert.equal(vida.orderReference, 'LA-1');
  assert.equal(vida.steps.find(step => step.id === 'ordered').status, 'inferred');
  assert.equal(otto.steps.find(step => step.id === 'approved').status, 'missing');
  assert.equal(otto.steps.find(step => step.id === 'ordered').status, 'missing');
  assert.equal(report.stats.unlinked, 3);
});

test('two same-name compatible requests leave an order unresolved', () => {
  const report = assemble([
    ...journey('a', 'Leif'),
    ...journey('b', 'Leif'),
    order('1', '13', 'Leif Underhill'),
  ], 'assessment');
  assert.equal(report.stats.unlinked, 1);
  assert.ok(report.cases.every(item => item.steps.find(step => step.id === 'ordered').status === 'missing'));
});

test('an unseen vendor, order reference and currency work from the source records', () => {
  const subject = 'Order confirmation: #HT.7705';
  const body = '1 × Roadbook 14\nDeliver to: Pat Doe\n\nHarborTech Limited';
  const confirmed = { id: 'order', source: 'email', at: '2026-03-13T11:00:00Z',
    text: subject + ' · ' + body, subject, body, actor: 'HarborTech Limited', origin: 'email:1' };
  const report = assemble([
    channel('a', '10', request('Pat Doe')),
    channel('quote', '11', 'Roadbook 14 from HarborTech, ~1,089 GBP, ok?', 'a'),
    channel('approve', '12', 'Approved', 'a'),
    { ...confirmed, id: 'wrong-vendor', actor: 'Another HarborTech Limited' },
    confirmed,
  ], 'assessment');
  assert.equal(report.cases[0].orderReference, 'HT.7705');
  assert.equal(report.cases[0].quoteAmount, 1089);
  assert.equal(report.cases[0].quoteCurrency, 'GBP');
  assert.deepEqual(report.cases[0].steps.find(step => step.id === 'ordered').evidence.map(event => event.id), ['order']);
  assert.equal(report.stats.unlinked, 1);
});

test('receipt evidence distinguishes the recipient from the coordinator', () => {
  const ack = { id: 'ack', source: 'teams', at: '2026-03-14T11:00:00Z',
    text: 'Laptop arrived, thank you!', actor: 'Vida Faraday', origin: 'ravi/teams/messages.jsonl:9' };
  const report = assemble([
    ...journey('a', 'Vida'),
    order('1', '13', 'Vida Faraday'),
    channel('handover', '14', 'Vida has the laptop now', 'a'),
    ack,
    { ...ack, id: 'wrong-person', actor: 'Vida Holloway' },
  ], 'assessment');
  const evidence = report.cases[0].steps.find(step => step.id === 'received').evidence;
  assert.deepEqual(evidence.map(event => event.id), ['handover', 'ack']);
  assert.match(evidence[0].reason, /coordinator/);
  assert.match(evidence[1].reason, /recipient/);
  assert.equal(report.stats.unlinked, 1);
});
