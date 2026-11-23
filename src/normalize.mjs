const sources = new Map([
  ['outlook/messages.jsonl', 'email'],
  ['outlook/calendar.jsonl', 'calendar'],
  ['teams/messages.jsonl', 'teams'],
  ['teams_channel/messages.jsonl', 'teams'],
  ['screens/screen_log.jsonl', 'screen'],
]);

function parseDate(value) {
  const raw = typeof value === 'string' ? value : value?.dateTime;
  if (typeof raw !== 'string') return null;
  const offsets = { UTC: 'Z', 'Sri Lanka Standard Time': '+05:30', 'India Standard Time': '+05:30', 'Asia/Colombo': '+05:30' };
  const offset = offsets[value?.timeZone];
  const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : offset ? raw + offset : '';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const entities = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const clean = value => typeof value === 'string'
  ? value.replace(/<[^>]*>/g, ' ').replace(/&([a-z]+);/gi, (entity, name) => entities[name] ?? entity)
    .replace(/\s+/g, ' ').trim() : '';

function normalize(row, source, relative, line) {
  if (!row || Array.isArray(row) || typeof row !== 'object') return null;
  const calendarRecord = source === 'calendar';
  const at = parseDate(calendarRecord ? row.start :
    row.sentDateTime ?? row.createdDateTime ?? row.receivedDateTime ?? row.timestamp ?? row.capturedAt ?? row.captured_at);
  if (!at) return null;
  const subject = clean(row.subject);
  const rawBody = row.body?.content ?? row.bodyPreview;
  const body = typeof rawBody === 'string' ? rawBody.replace(/<\/?(?:p|br|div|li)\b[^>]*>/gi, '\n')
    .split(/\r?\n/).map(clean).filter(Boolean).join('\n') : '';
  const text = [...new Set([subject, clean(rawBody), clean(row.windowTitle ?? row.window_title)].filter(Boolean))].join(' · ');
  if (!text) return null;
  const mailbox = relative.split('/').at(-3) ?? '';
  const scope = row.channelIdentity?.channelId ?? row.chatId ?? mailbox;
  const providerId = String(row.id ?? '');
  const dedup = (source === 'email' && row.internetMessageId) ||
    (source === 'calendar' && row.iCalUId && `${row.iCalUId}/${at}`) ||
    (source === 'teams' && providerId && `${scope}/${providerId}`);
  const origin = `${relative}:${line}`;
  const id = `${source}/${dedup || origin}`;
  return { id, source, at, text, body, subject, origin, scope, providerId, replyToId: row.replyToId,
    channelName: row.channelIdentity?._channelName,
    actor: row.from?.user?.displayName ?? row.sender?.emailAddress?.name ?? row.from?.emailAddress?.name,
    ...(calendarRecord && { cancelled: row.isCancelled === true }),
    timeKind: calendarRecord ? 'Scheduled start' : 'Recorded time' };
}

export async function parseExport(entries) {
  const events = new Map();
  const rejected = [];
  let files = 0;
  let rows = 0;
  let duplicates = 0;
  for await (const [relative, content] of entries) {
    if (relative.includes('__MACOSX/')) continue;
    const source = sources.get(relative.split('/').slice(-2).join('/'));
    if (!source) continue;
    files += 1;
    const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      if (!lines[index].trim()) continue;
      rows += 1;
      const origin = `${relative}:${index + 1}`;
      let row;
      try { row = JSON.parse(lines[index]); }
      catch { rejected.push({ origin, reason: 'Invalid JSON' }); continue; }
      const event = normalize(row, source, relative, index + 1);
      if (!event) { rejected.push({ origin, reason: 'Missing supported timestamp or text' }); continue; }
      const existing = events.get(event.id);
      if (existing) {
        duplicates += 1;
        existing.origins.push(origin);
        if (event.cancelled) existing.cancelled = true;
      } else {
        events.set(event.id, { ...event, origins: [origin] });
      }
    }
  }
  if (!files) throw new Error('No supported export files. Choose a Mission Control export ZIP or its extracted data folder.');
  return { events: [...events.values()], rejected, counts: { files, rows, duplicates, rejected: rejected.length } };
}
