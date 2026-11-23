// A planner selects one read-only tool. Each tool reads the effective review
// projection, so an excluded record cannot reappear in an assistant answer.
const examples = {
  brief: ['summarize this case', 'walk me through the timeline', 'what happened here', 'give me an overview'],
  review: ['what needs a second look', 'what is missing', 'which links are uncertain', 'find gaps in this case', 'what should I check'],
  coverage: ['compare coverage across cases', 'how many cases in this workflow', 'which stages have least evidence across the whole process', 'how often is each step recorded'],
  triage: ['find a case to review next', 'prioritize cases for review', 'where should the team focus next', 'which cases have the most uncertain matches'],
  handoff: ['prepare a team brief', 'what should we improve before automation', 'where does work change hands', 'what questions should we ask employees about this process', 'what repeats across the team'],
  search: ['why was this record linked', 'show the supporting evidence', 'where is the original source', 'did the interview happen', 'find the message about the supplier'],
};
const stopWords = new Set('a an the what which in of to here this is are i me was did it do does how for has have on my all'.split(' '));
const words = text => (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(term => !stopWords.has(term));
const vocabulary = new Set(Object.values(examples).flat().flatMap(words));
const training = Object.fromEntries(Object.entries(examples).map(([intent, phrases]) => {
  const tokens = phrases.flatMap(words);
  const counts = new Map();
  for (const word of tokens) counts.set(word, (counts.get(word) ?? 0) + 1);
  return [intent, { counts, total: tokens.length }];
}));

export function classify(question) {
  const tokens = words(question).filter(word => vocabulary.has(word));
  if (!tokens.length) return 'search';
  return Object.keys(training).map(intent => {
    const { counts, total } = training[intent];
    const score = tokens.reduce((sum, word) => sum + Math.log(((counts.get(word) ?? 0) + 1) / (total + vocabulary.size)), 0);
    return { intent, score };
  }).sort((a, b) => b.score - a.score)[0].intent;
}

const options = { expectedInputs: [{ type: 'text', languages: ['en'] }], expectedOutputs: [{ type: 'text', languages: ['en'] }] };
export async function plan(question, previous, model, signal) {
  if (model) {
    let session;
    try {
      // Use only a model already present on this device. No implicit download.
      if (await model.availability(options) === 'available') {
        session = await model.create({ ...options, signal });
        const schema = { type: 'string', enum: Object.keys(examples) };
        const raw = await session.prompt(
          'Choose the best tool for the last analyst question. brief = case chronology; review = missing or uncertain evidence in one case; coverage = process-wide counts; triage = prioritize cases for review; handoff = prepare a team brief on repeated source changes and questions before automation; search = a specific source or stage. Return one JSON string.\n' +
          JSON.stringify({ previousQuestion: previous, question }), { responseConstraint: schema, signal });
        const intent = JSON.parse(raw);
        if (Object.hasOwn(examples, intent)) return { intent, mode: 'On-device language model' };
      }
    } catch { /* Unsupported runtime, invalid plan or model timeout. */ }
    finally { session?.destroy(); }
  }
  return { intent: classify(question), mode: 'Local question classifier' };
}

function reference(item, step, evidence) {
  return { caseId: item.id, stepId: step.id, evidenceId: evidence?.id,
    label: evidence ? String(evidence.origin ?? evidence.id) : step.label };
}
function finding(item, step, evidence = step.evidence[0]) {
  const status = step.status;
  const message = evidence ? [evidence.text, evidence.reason].filter(Boolean).join(' ') : 'There’s no linked record here. Someone on the team may know where to look.';
  return { title: step.label, status, message, ref: reference(item, step, evidence) };
}

function prioritize(cases) {
  const entries = cases.map(item => {
    const uncertain = item.steps.flatMap(step => step.evidence.filter(record => record.status === 'inferred' ||
      (!record.status && step.status === 'inferred')).map(record => ({ step, record })));
    const gaps = item.steps.filter(step => !step.evidence.length);
    return { item, uncertain, gaps };
  }).filter(entry => entry.uncertain.length || entry.gaps.length);
  // A person can verify an existing weak match immediately. Missing records
  // frequently require a conversation outside this export.
  entries.sort((a,b) => b.uncertain.length - a.uncertain.length || b.gaps.length - a.gaps.length || a.item.id.localeCompare(b.item.id));
  return entries.slice(0, 3).map(({ item, uncertain, gaps }) => {
    const link = uncertain[0], stage = link?.step ?? gaps[0];
    const message = [uncertain.length + ' inferred evidence ' + (uncertain.length === 1 ? 'link' : 'links'),
      gaps.length + (gaps.length === 1 ? ' stage without evidence.' : ' stages without evidence.')].join(', ');
    return { title: (item.label ?? item.id) + ' · ' + stage.label, status: stage.status,
      message, ref: reference(item, stage, link?.record) };
  });
}

const sourceNames = { teams:'Teams', email:'Outlook email', calendar:'Calendar', screen:'Screen activity' };

export function teamBrief(report) {
  const switches = new Map();
  const stages = new Map();
  for (const item of report.cases) {
    for (const [index, step] of item.steps.entries()) {
      const tally = stages.get(step.id) ?? { label:step.label, missing:0, total:0 };
      tally.total++;
      if (!step.evidence.length) { tally.missing++; tally.example ??= reference(item, step); }
      stages.set(step.id, tally);
      if (!index) continue;
      const previous = item.steps[index - 1];
      const counted = new Set();
      for (const next of step.evidence) {
        const before = previous.evidence.filter(record => record.at <= next.at).sort((a,b) => b.at.localeCompare(a.at))[0];
        if (!before || before.source === next.source) continue;
        const key = JSON.stringify([previous.id, step.id, before.source, next.source]);
        if (counted.has(key)) continue;
        counted.add(key);
        const change = switches.get(key) ?? { from:before.source, to:next.source, start:previous.label,
          end:step.label, count:0, example:reference(item, step, next) };
        change.count++; switches.set(key, change);
      }
    }
  }
  const findings = [];
  const top = [...switches.values()].sort((a,b) => b.count - a.count)[0];
  if (top) {
    const from = sourceNames[top.from] ?? top.from, to = sourceNames[top.to] ?? top.to;
    findings.push({ title:from + ' → ' + to,
      message:'In ' + top.count + ' of ' + report.cases.length + ' cases, “' + top.start + '” in ' + from +
      ' came before “' + top.end + '” in ' + to + '. What, if anything, does someone copy or check between the two?',
      ref:top.example });
  }
  const gap = [...stages.values()].filter(row => row.missing).sort((a,b) => b.missing / b.total - a.missing / a.total)[0];
  if (gap) findings.push({ title:gap.label, message:gap.missing + ' of ' + gap.total +
    ' cases have no linked record for this step. Would you expect one in every case? If so, where would you look?', ref:gap.example });
  return { title:report.process, intro:findings.length ? 'Bring these questions to the people who do the work.' :
    'These cases show no adjacent stages with a change of source and no missing stages. There is no recurring handoff to report from these checks.', findings, canExport:true };
}

export function briefText(result) {
  const lines = [result.title + ' — team brief', '', result.intro, ''];
  for (const entry of result.findings) {
    lines.push(entry.title, entry.message);
    if (entry.ref) lines.push('Example: ' + [entry.ref.caseId, entry.ref.stepId, entry.ref.evidenceId].filter(Boolean).join(' / '));
    lines.push('');
  }
  return lines.join('\n');
}
function relevantRecords(question, item, selectedStep) {
  const equivalents = { booked:'scheduled', booking:'scheduled', receive:'receipt', received:'receipt', delivered:'receipt', delivery:'receipt', ordered:'order', interview:'interview', interviews:'interview' };
  const normalize = token => equivalents[token] ?? token;
  const terms = [...new Set(words(question).map(normalize))];
  const records = item.steps.flatMap(step => (step.evidence.length ? step.evidence : [undefined])
    .map(record => ({ step, record, stageWords: new Set(words(step.label).map(normalize)),
      tokens: new Set(words([step.label, step.id, record?.text, record?.reason, record?.source, record?.id].join(' ')).map(normalize)) })));
  const frequencies = terms.map(term => records.filter(row => row.tokens.has(term)).length);
  const ranked = records.map(row => ({ ...row, score: terms.reduce((sum, term, index) =>
    sum + (row.tokens.has(term) ? (row.stageWords.has(term) ? 3 : 1) * Math.log(1 + records.length / frequencies[index]) : 0), 0) }));
  const hits = ranked.filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (hits.length) return hits.map(row => finding(item, row.step, row.record));
  if (/\b(this|that|selected|it|why|supporting|original)\b/i.test(question) && selectedStep) return [finding(item, selectedStep)];
  return [];
}

export function investigate({ report, currentCase, step }, question, intent) {
  const identifiers = new Set(question.toLowerCase().match(/[\p{L}\p{N}_-]+/gu) ?? []);
  const namedCase = report.cases.find(item => identifiers.has(item.id.toLowerCase()));
  const item = namedCase ?? currentCase;
  if (intent === 'handoff') return teamBrief(report);
  if (intent === 'triage') {
    const findings = prioritize(report.cases);
    return { title: report.process, intro: findings.length ? 'Start with these cases. Cases with more inferred links come first, followed by cases with more gaps.' :
      'Every stage has direct supporting evidence in this workflow.', findings };
  }
  if (intent === 'coverage') {
    const stages = new Map();
    for (const entry of report.cases) for (const stage of entry.steps) {
      const counts = stages.get(stage.id) ?? { label: stage.label, linked: 0, total: 0 };
      counts.total++;
      if (stage.evidence.length) counts.linked++;
      stages.set(stage.id, counts);
    }
    return { title: report.process, intro: 'Evidence coverage across ' + report.cases.length + ' cases.',
      findings: [...stages.values()].map(row => ({ title: row.label, message: row.linked + ' of ' + row.total + ' cases have linked evidence.' })) };
  }
  if (intent === 'brief') return { title: item.label ?? item.id, intro: 'Here’s what the records show, step by step.',
    findings: item.steps.map(stage => finding(item, stage)) };
  if (intent === 'review') {
    const unresolved = item.steps.filter(stage => stage.status !== 'observed' || !stage.evidence.length);
    return { title: item.label ?? item.id, intro: unresolved.length ? 'These stages need a closer look.' : 'Every stage has observed evidence. You can still inspect the source links.',
      findings: unresolved.map(stage => finding(item, stage)) };
  }
  const findings = relevantRecords(question, item, item.id === currentCase.id ? step : null);
  const attendance = /\b(interview|interviews)\b/i.test(question) && /\b(attend(?:ed|ance)?|happen(?:ed)?|held|occur(?:red)?|took place|show up)\b/i.test(question);
  const interview = item.steps.find(stage => stage.id === 'interview_scheduled');
  if (attendance && interview) return { title: item.label ?? item.id, intro: interview.evidence.length
    ? 'Interview attendance is unconfirmed. This case records a scheduled interview; the appointment alone cannot establish who attended.'
    : 'Interview attendance is unconfirmed. This case has no linked interview appointment.', findings: [finding(item, interview)] };
  return { title: item.label ?? item.id, intro: findings.length ? 'The closest matching records in this case are below.' :
    'I couldn’t find a matching record in this case. Try a stage name, a source, or a case summary.', findings };
}
