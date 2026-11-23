function csvCell(input) {
  let value = String(input ?? '');
  // Spreadsheet applications interpret these prefixes as formulas. Force data.
  if (/^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)) value = "'" + value;
  return '"' + value.replaceAll('"', '""') + '"';
}

export function casesCsv(report, reviews) {
  const rows = [['Workflow', 'Case', 'Request type', 'Role', 'Stage', 'Evidence status', 'Evidence count', 'Reviewer decision', 'Note', 'Reviewer', 'Reviewed at']];
  for (const item of report.cases) for (const step of item.steps) {
    const review = reviews[`${item.id}/${step.id}`];
    rows.push([report.process, item.label ?? item.id, item.requestType, item.role, step.label, step.status,
      step.evidence.length, review?.decision, review?.note, review?.reviewer, review?.at]);
  }
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
