import test from 'node:test';
import assert from 'node:assert/strict';
import { assemble, fromFixture } from '../src/pipeline.mjs';
import { parseExport } from '../src/normalize.mjs';
import { projectReviews } from '../web/review-model.js';
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

function candidateEvent(id, source, day, hour, subject, text = subject, other = {}) {
  return {
    id, source, subject, text, body: text, at: `2026-03-${day}T${hour}:00:00Z`,
    origin: `data/owner/${source === 'teams' ? 'teams' : 'outlook'}/${source}.jsonl:1`,
    ...other,
  };
}

test('recruitment separates scheduled events, reported screening, and explicit offer decisions', () => {
  const screen = candidateEvent('s', 'calendar', '10', '10', 'Screening call – Pat Doe (Legal Assistant)', '', { timeKind: 'Scheduled start' });
  const report = candidateEvent('r', 'teams', '10', '11', '', 'Spoke to Pat for the Ingram role, good fit', {
    origin: 'data/manager/teams/messages.jsonl:1',
    origins: ['data/manager/teams/messages.jsonl:1', 'data/owner/teams/messages.jsonl:1'],
  });
  const interview = candidateEvent('i', 'calendar', '12', '12', 'Interview: Pat Doe – Legal Assistant', '', { timeKind: 'Scheduled start' });
  const offer = (id, day, text, other = {}) =>
    candidateEvent(id, 'email', day, '14', 'RE: Offer – Legal Assistant with Harbourline Talent', text, { actor: 'Pat Doe', ...other });
  const input = [
    offer('declined', '13', "I've decided to accept another offer."),
    report, interview, screen,
    offer('early', '11', 'Happy to accept the offer, thank you.'),
    offer('ambiguous', '13', 'I have not accepted.'),
    offer('wrong-name', '13', 'Happy to accept the offer, thank you.', { actor: 'Pat Smith' }),
  ];
  const [process] = assemble(input, 'assessment').processes;
  assert.equal(process.stats.linked, 4);
  assert.equal(process.cases.length, 1);
  assert.deepEqual(process.cases[0].steps.map(step => step.status), ['observed', 'inferred', 'observed', 'observed']);
  assert.equal(process.cases[0].steps[2].evidence[0].timeKind, 'Scheduled start');
  assert.equal(process.cases[0].steps[3].evidence[0].outcome, 'declined');
});

test('recruitment leaves ambiguous aliases and canceled slots unresolved', () => {
  const [process] = assemble([
    candidateEvent('s1', 'calendar', '10', '10', 'Screening call – Pat Doe (Legal Assistant)'),
    candidateEvent('s2', 'calendar', '10', '10', 'Screening call – Pat Smith (Legal Assistant)'),
    candidateEvent('s3', 'calendar', '10', '10', 'Screening call – Pat West (Legal Assistant)', '', { cancelled: true }),
    candidateEvent('r', 'teams', '10', '11', '', 'Spoke to Pat for the Ingram role, good fit'),
  ], 'assessment').processes;
  assert.equal(process.cases.length, 2);
  assert.equal(process.stats.linked, 2);
  assert.ok(process.cases.every(item => item.steps.find(step => step.id === 'screening_reported').status === 'missing'));
});

test('an exported calendar cancellation survives deduplication and excludes the slot', async () => {
  const scheduled = { id: 'p-1', iCalUId: 'appt-1', subject: 'Screening call – Pat Doe (Legal Assistant)',
    start: { dateTime: '2026-03-10T10:00:00', timeZone: 'Asia/Colombo' }, isCancelled: false };
  const { events, counts } = await parseExport([
    ['owner/outlook/calendar.jsonl', JSON.stringify(scheduled)],
    ['attendee/outlook/calendar.jsonl', JSON.stringify({ ...scheduled, id: 'p-2', isCancelled: true })],
    ['owner/outlook/calendar.jsonl', JSON.stringify({
      ...scheduled, id: 'p-3', iCalUId: 'appt-2', subject: 'Screening call – Robin Doe (Legal Assistant)',
    })],
  ]);
  const [recruitment] = assemble(events, 'assessment').processes;
  assert.equal(counts.duplicates, 1);
  assert.equal(events[0].cancelled, true);
  assert.equal(events[0].at, '2026-03-10T04:30:00.000Z');
  assert.deepEqual(recruitment.cases.map(item => item.label), ['Robin Doe']);
});

test('unlinking observed recruitment evidence leaves the remaining inferred evidence marked correctly', () => {
  const [recruitment] = assemble([
    candidateEvent('s1', 'calendar', '10', '10', 'Screening call – Pat Doe (Legal Assistant)'),
    candidateEvent('alias', 'teams', '10', '11', '', 'Spoke to Pat for the Ingram role, good fit'),
    candidateEvent('full', 'teams', '10', '12', '', 'Spoke to Pat Doe for the Ingram role, good fit'),
  ], 'assessment').processes;
  const [item] = recruitment.cases;
  assert.equal(item.steps[1].status, 'observed');
  assert.deepEqual(item.steps[1].evidence.map(record => record.status), ['inferred', 'observed']);
  const corrected = projectReviews(recruitment, {
    [`${item.id}/screening_reported`]: { corrections: [{ eventId: 'full', action: 'unlink' }] },
  });
  assert.equal(corrected.cases[0].steps[1].status, 'inferred');
  assert.deepEqual(corrected.cases[0].steps[1].evidence.map(record => record.id), ['alias']);
});
