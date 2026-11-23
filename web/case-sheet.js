const localTime = new Intl.DateTimeFormat('en-GB', { dateStyle:'medium', timeStyle:'short', timeZone:'Asia/Colombo' });
const sources = { teams:'Teams', email:'Outlook email', calendar:'Outlook calendar', screen:'Screen activity' };

export function printCase(report, item, reviews, isDemo) {
  const page = document.createElement('article');
  page.className = 'case-printout';
  function line(parent, tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    parent.append(element);
    return element;
  }
  line(page, 'small', 'Mission Control / ' + (isDemo ? 'Redacted assessment demo' : 'Imported workspace'));
  line(page, 'h1', report.process);
  line(page, 'p', [item.label ?? item.id, item.role ?? item.requestType, 'Sri Lanka time'].filter(Boolean).join(' · '));
  for (const step of item.steps) {
    const section = document.createElement('section');
    line(section, 'h2', step.label + ' · ' + step.status);
    if (!step.evidence.length) line(section, 'p', 'No supporting record is linked to this step.');
    for (const record of step.evidence) {
      const entry = document.createElement('div');
      line(entry, 'strong', (sources[record.source] ?? record.source) + ' · ' + localTime.format(new Date(record.at)));
      line(entry, 'blockquote', record.text);
      line(entry, 'p', record.reason);
      line(entry, 'small', record.origin + ' · ' + record.timeKind);
      section.append(entry);
    }
    const review = reviews[item.id + '/' + step.id];
    if (review?.decision) line(section, 'p', ['Reviewer decision', review.decision, review.note].filter(Boolean).join(' · '));
    for (const record of step.excludedEvidence ?? []) line(section, 'small', 'Link removed · ' + record.origin + ' · ' + record.correction.reason);
    page.append(section);
  }
  document.querySelector('.case-printout')?.remove();
  document.body.append(page);
  window.addEventListener('afterprint', () => page.remove(), { once:true });
  window.print();
}
