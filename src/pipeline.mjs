const stages = [
  { id: 'requested', label: 'Interview requested' },
  { id: 'coordinated', label: 'Availability coordinated' },
  { id: 'booked', label: 'Interview booked' },
];

function classify(event) {
  if (event.source === 'email' && /\binterview request(?:ed)?\b/i.test(event.text)) return 'requested';
  if (event.source === 'teams' && /\b(?:available|availability)\b/i.test(event.text)) return 'coordinated';
  // Calendar events show scheduled time, which alone cannot establish when the invite was sent.
  if (event.source === 'calendar' && /\binterview\b/i.test(event.text)) return 'booked';
  return null;
}

export function fromFixture(rows) {
  return rows.map(row => ({ ...row, at: new Date(row.at).toISOString() }));
}

function assembleInterviews(events, dataset) {
  const cases = new Map();
  const links = [];
  const ordered = [...events].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  for (const event of ordered) {
    const refs = [...new Set(event.text.match(/\bINT-\d{3,}\b/gi)?.map(ref => ref.toUpperCase()) ?? [])];
    const stage = classify(event);
    if (refs.length !== 1 || !stage) continue;
    const [caseId] = refs;
    if (!cases.has(caseId)) cases.set(caseId, []);
    cases.get(caseId).push({ event, stage });
    links.push({ eventId: event.id, caseId, stage, rule: 'Exact interview reference and source-specific stage rule' });
  }
  const workflows = Array.from(cases, ([id, records]) => ({
    id,
    steps: stages.map(stage => {
      const matching = records.filter(record => record.stage === stage.id);
      return {
        ...stage,
        status: matching.length === 0 ? 'missing' : stage.id === 'coordinated' ? 'inferred' : 'observed',
        evidence: matching.map(({ event }) => ({
          id: event.id, source: event.source, at: event.at, timeKind: event.timeKind ?? 'recorded',
          text: event.text, origin: event.origin,
          reason: `Contains ${id} and matches the ${stage.label.toLowerCase()} rule for ${event.source}.`,
        })),
      };
    }),
  }));
  return { version: 1, dataset, process: 'Interview scheduling', cases: workflows, links,
    stats: { normalized: events.length, linked: links.length, unlinked: events.length - links.length } };
}

const procurementStages = [
  { id: 'requested', label: 'Request raised' },
  { id: 'quoted', label: 'Quote proposed' },
  { id: 'approved', label: 'Purchase approved' },
  { id: 'ordered', label: 'Order confirmed' },
  { id: 'received', label: 'Receipt reported' },
];

const purchaseRequest = /^Laptop needed for (.+?)\s*\(([^)]+)\),\s*(.+?),\s*needed by\s+(.+?)[.!]?$/i;
const purchaseQuote = /^(.+?)\s+from\s+(.+?)\s*,\s*~?([\d,]+(?:\.\d+)?)\s+([a-z]{3})\s*,?\s*ok\??$/i;
const purchaseApproval = /^(?:ok(?:ay)?\s+approved|approved|go ahead)[\s.!👍]*$/iu;
const vendorReceipt = /^Order confirmation\s*[:#]?\s*#?\s*([a-z\d][a-z\d._/-]*\d[a-z\d._/-]*)$/i;
const channelReceipt = /\bhas the laptop now[.!]?$/i;
const directReceipt = /\b(?:the new laptop is here and working|laptop arrived)\b/i;

function canonical(value) {
  return value?.trim().replace(/\s+/gu, ' ').toLocaleLowerCase('en') ?? '';
}

function vendorMatches(quotedVendor, senderName) {
  const quote = canonical(quotedVendor);
  const actual = canonical(senderName);
  return Boolean(quote && (actual === quote || actual.startsWith(quote + ' ')));
}

function chronology(a, b) {
  return a.at.localeCompare(b.at) || a.id.localeCompare(b.id);
}

function sender(event) {
  const actor = event.actor ?? event.sender ?? event.author;
  return typeof actor === 'string' ? actor : actor?.displayName ?? actor?.name ?? actor?.emailAddress?.name;
}

function body(event) {
  return event.body?.content ?? event.body ?? event.text;
}

function isChannel(event) {
  return event.source === 'teams' && (event.scope === 'channel' || event.origin?.includes('teams_channel/'));
}

function threadKey(event, providerId) {
  return JSON.stringify([event.channelId ?? event.channelName ?? '', String(providerId)]);
}

function addEvidence(records, stage, event, reason, inferred = false, checks) {
  records[stage].push({ event, reason, inferred, checks });
}

function makeCase(event, match) {
  const [, recipient, requestType, organization, neededBy] = match;
  const records = Object.fromEntries(procurementStages.map(stage => [stage.id, []]));
  addEvidence(records, 'requested', event, 'Original Teams channel request and thread root.');
  return {
    id: String(event.providerId ?? event.id),
    label: recipient,
    recipient,
    requestType,
    organization,
    neededBy,
    records,
  };
}

function applyChannelReply(item, event) {
  const message = body(event).trim();
  const quote = message.match(purchaseQuote);
  if (quote) {
    const [, product, vendor, amount, currency] = quote;
    item.latestQuote = { product, vendor };
    addEvidence(item.records, 'quoted', event, 'Quote posted as a reply to this request.');
    item.product = product;
    item.vendor = vendor;
    item.quoteAmount = Number(amount.replaceAll(',', ''));
    item.quoteCurrency = currency.toUpperCase();
    if (item.quoteCurrency === 'AUD') item.quoteAud = item.quoteAmount;
    else delete item.quoteAud;
  } else if (purchaseApproval.test(message) && item.records.quoted.length) {
    addEvidence(item.records, 'approved', event, 'Approval posted after a quote in the same request thread.');
    item.records.approved.at(-1).quote = item.latestQuote;
  } else if (channelReceipt.test(message)) {
    addEvidence(item.records, 'received', event, 'A coordinator reported receipt in the original request thread.');
  }
}

function matchOrder(event, cases) {
  if (event.source !== 'email') return;
  const match = event.subject?.trim().match(vendorReceipt);
  const receipt = body(event);
  const recipient = receipt.match(/Deliver to:[ \t]*([^\r\n]+)/i)?.[1]?.trim();
  const product = receipt.match(/\b\d+\s*[x×]\s*(.+?)(?=\s+Deliver to:)/is)?.[1]?.trim();
  if (!match || !recipient || !product) return;
  const reference = match[1].toUpperCase();
  const senderName = sender(event);
  if (!senderName) return;
  const candidates = cases.filter(item => {
    const approved = item.records.approved.findLast(record => record.event.at <= event.at);
    if (!approved || !vendorMatches(approved.quote.vendor, senderName) ||
      canonical(approved.quote.product) !== canonical(product)) return false;
    const name = canonical(item.label);
    const fullName = canonical(recipient);
    return name === fullName || name === fullName.split(/\s+/u)[0];
  });
  if (candidates.length !== 1) return;
  const [item] = candidates;
  const shortened = canonical(item.label) !== canonical(recipient);
  const reason = shortened
    ? 'The unique request matches the recipient’s first name, vendor, product, and earlier approval.'
    : 'The unique request matches the full recipient name, vendor, product, and earlier approval.';
  addEvidence(item.records, 'ordered', event, reason, shortened, [
    { label: 'Recipient', result: shortened ? 'First name only' : 'Full name matched', partial: shortened },
    { label: 'Supplier', result: 'Matched the approved quote' },
    { label: 'Laptop model', result: 'Matched the approved quote' },
    { label: 'Approval', result: 'Recorded before the email' },
  ]);
  item.recipient = recipient;
  item.orderReference = reference;
}

function matchDirectReceipt(event, cases) {
  if (event.source !== 'teams' || isChannel(event) || !directReceipt.test(body(event))) return;
  const name = canonical(sender(event));
  if (!name) return;
  const candidates = cases.filter(item => canonical(item.recipient) === name &&
    item.records.ordered.some(order => order.event.at <= event.at));
  if (candidates.length !== 1) return;
  addEvidence(candidates[0].records, 'received', event,
    'The recipient named in the order confirmed receipt in a Teams chat.');
}

function assembleProcurement(events, dataset) {
  const ordered = [...events].sort(chronology);
  const threads = new Map();
  for (const event of ordered) {
    if (!isChannel(event)) continue;
    if (event.replyToId == null) {
      const match = body(event).trim().match(purchaseRequest);
      if (match) threads.set(threadKey(event, event.providerId ?? event.id), makeCase(event, match));
    } else {
      const item = threads.get(threadKey(event, event.replyToId));
      if (item) applyChannelReply(item, event);
    }
  }
  const cases = [...threads.values()];
  for (const event of ordered) matchOrder(event, cases);
  for (const event of ordered) matchDirectReceipt(event, cases);
  const links = [];
  const workflows = cases.map(({ records, latestQuote, ...item }) => ({
    ...item,
    steps: procurementStages.map(stage => {
      const matching = records[stage.id].sort((a, b) => chronology(a.event, b.event));
      return {
        ...stage,
        status: matching.length === 0 ? 'missing' : matching.every(record => record.inferred) ? 'inferred' : 'observed',
        evidence: matching.map(({ event, reason, checks }) => {
          links.push({ eventId: event.id, caseId: item.id, stage: stage.id, rule: reason });
          return { id: event.id, source: event.source, at: event.at, timeKind: event.timeKind ?? 'recorded',
            text: event.text, origin: event.origin, reason, ...(checks && { checks }) };
        }),
      };
    }),
  }));
  const linked = new Set(links.map(link => link.eventId)).size;
  return { version: 1, dataset, process: 'Laptop procurement', cases: workflows, links,
    stats: { normalized: events.length, linked, unlinked: events.length - linked } };
}

export function assemble(events, dataset) {
  if (dataset === 'sample' && !events.some(event => isChannel(event) && purchaseRequest.test(body(event).trim()))) {
    return assembleInterviews(events, dataset);
  }
  return assembleProcurement(events, dataset);
}
