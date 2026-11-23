const stages = [
  { id: 'screening_scheduled', label: 'Screening scheduled' },
  { id: 'screening_reported', label: 'Screening reported' },
  { id: 'interview_scheduled', label: 'Interview scheduled' },
  { id: 'offer_response', label: 'Offer response recorded' },
];

const screening = /^Screening call\s*[-–—]\s*(.+?)\s*\(([^()]+)\)$/iu;
const interview = /^Interview:\s*(.+?)\s+[-–—]\s+(.+)$/iu;
const reportPattern = /^Spoke to (.+?) for the [^,]+ role(?:[,.!]|$)/iu;
const offer = /^(?:re:\s*)+Offer\s*[-–—]\s*(.+?)\s+with\s+.+$/iu;
const declined = /\b(?:accept(?:ed|ing)? another offer|declin(?:e|ed|ing) the offer)\b/iu;
const accepted = /(?:^|[\r\n.!?])\s*accepted(?:\s*[-–—,.!]|\s*$)|\b(?:happy|delighted) to accept\b|\bi (?:hereby )?accept the offer\b/iu;
const reportWindow = 6 * 60 * 60 * 1000;

function canonical(value) {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en');
}

function mailboxes(event) {
  return new Set((event.origins ?? [event.origin]).map(origin => origin?.split(':')[0]?.split('/').at(-3)).filter(Boolean));
}

function add(records, stage, event, reason, inferred = false, outcome) {
  records.get(stage).push({ event, reason, inferred, outcome });
}

function collectCalendar(events) {
  const cases = new Map();
  for (const event of events) {
    if (event.source !== 'calendar' || event.cancelled === true) continue;
    const subject = event.subject ?? '';
    const scheduledScreening = subject.match(screening);
    const match = scheduledScreening ?? subject.match(interview);
    if (!match) continue;
    const [, candidate, role] = match;
    if (canonical(candidate).split(' ').length < 2) continue;
    const key = JSON.stringify([canonical(candidate), canonical(role)]);
    if (!cases.has(key)) {
      cases.set(key, {
        id: `recruitment/${event.id}`,
        label: candidate,
        role,
        records: new Map(stages.map(stage => [stage.id, []])),
      });
    }
    const stage = scheduledScreening ? 'screening_scheduled' : 'interview_scheduled';
    add(cases.get(key).records, stage, event, 'The calendar title names the candidate and role. It records a scheduled start.');
  }
  return [...cases.values()];
}

function matchName(name, alias) {
  if (name === alias) return 'full';
  const [first, last] = name.split(' ');
  if (alias === first || alias === `${first} ${last[0]}.`) return 'partial';
  return null;
}

function linkScreeningReport(event, cases) {
  if (event.source !== 'teams') return;
  const alias = canonical((event.body || event.text).match(reportPattern)?.[1]);
  const folders = mailboxes(event);
  if (!alias || !folders.size) return;
  const available = cases.flatMap(item => {
    const identity = matchName(canonical(item.label), alias);
    if (!identity) return [];
    const nearby = item.records.get('screening_scheduled').some(record => {
      const elapsed = Date.parse(event.at) - Date.parse(record.event.at);
      const sameMailbox = [...mailboxes(record.event)].some(folder => folders.has(folder));
      return sameMailbox && elapsed >= 0 && elapsed <= reportWindow;
    });
    return nearby ? [{ item, identity }] : [];
  });
  if (available.length !== 1) return;
  const [{ item, identity }] = available;
  const inferred = identity === 'partial';
  const reason = inferred
    ? 'A matching candidate alias, mailbox and nearby prior screening slot point to one case.'
    : 'The full candidate name matched a nearby prior screening slot in the same mailbox.';
  add(item.records, 'screening_reported', event, reason, inferred);
}

function linkOfferResponse(event, cases) {
  if (event.source !== 'email' || !event.actor) return;
  const role = canonical(event.subject?.match(offer)?.[1]);
  if (!role) return;
  const body = event.body || event.text;
  const isDeclined = declined.test(body);
  const isAccepted = accepted.test(body);
  if (isDeclined === isAccepted) return;
  const candidates = cases.filter(item => canonical(item.label) === canonical(event.actor) &&
    canonical(item.role) === role &&
    item.records.get('interview_scheduled').some(record => record.event.at <= event.at));
  if (candidates.length !== 1) return;
  const outcome = isDeclined ? 'declined' : 'accepted';
  add(candidates[0].records, 'offer_response', event,
    'The candidate sent an explicit offer reply for the same role after the scheduled interview start.', false, outcome);
}

export function assembleRecruitment(orderedEvents, dataset) {
  const cases = collectCalendar(orderedEvents);
  if (!cases.length) return null;
  for (const event of orderedEvents) {
    linkScreeningReport(event, cases);
    linkOfferResponse(event, cases);
  }
  const links = [];
  const workflows = cases.map(({ records, ...item }) => ({
    ...item,
    steps: stages.map(stage => {
      const matching = records.get(stage.id);
      return {
        ...stage,
        status: matching.length === 0 ? 'missing' : matching.every(record => record.inferred) ? 'inferred' : 'observed',
        evidence: matching.map(({ event, reason, inferred, outcome }) => {
          links.push({ eventId: event.id, caseId: item.id, stage: stage.id, rule: reason });
          return { id: event.id, source: event.source, at: event.at, timeKind: event.timeKind ?? 'Recorded time',
            text: event.text, origin: event.origin, reason, status: inferred ? 'inferred' : 'observed',
            ...(outcome && { outcome }) };
        }),
      };
    }),
  }));
  const linked = new Set(links.map(link => link.eventId)).size;
  return { version: 1, dataset, process: 'Recruitment screening', cases: workflows, links,
    stats: { normalized: orderedEvents.length, linked, unlinked: orderedEvents.length - linked } };
}
