# Mission Control

Mission Control reconstructs laptop procurement cases from four weeks of Harbourline Talent activity. It connects Teams requests, quotes and approvals to Outlook order confirmations and Teams receipt reports. Each stage shows why records were linked and where evidence is missing.

## Run the prototype

Use Node.js 22. The project has no package dependencies.

```sh
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The page opens on the redacted assessment snapshot. Select **Take the walkthrough** for a guided investigation or **Import ZIP** to inspect the supplied export in your browser.

1. Follow a complete Teams thread through request, quote and approval.
2. Inspect an Outlook order whose recipient matched an approved request by first name. Check what supported the link and why the app still calls it inferred.
3. See an order with no receipt report. Flag the step and add a note. Review decisions are saved in this browser.

Outside the walkthrough, select a stage to filter cases and use **Evidence gaps** to reverse the filter. **Copy case link** opens the same case and step in the redacted demo. Export the evidence and decisions as JSON or the case summary as CSV.

Order evidence includes a matching ledger for recipient, supplier, model, and approval timing. It highlights a partial recipient match without disclosing the underlying values in the public demo.

## Reproduce the analysis

Pass either the original ZIP or its extracted directory to the same pipeline locally.

```sh
npm run ingest -- "path/to/mission-control-challenge (1).zip"
```

| Output in `private/` | Contents |
| --- | --- |
| `counts.json` | Input file and row counts, duplicate rows and rejected rows |
| `normalized.json` | Common event format with timestamp meaning and original file and line references |
| `rejected.json` | Source locations and reasons for rows that could not be parsed or normalized |
| `links.json` | Event, case, workflow stage and the rule supporting the link |
| `report.json` | The assembled cases, stage statuses, evidence and coverage counts |

See [architecture and data structures](docs/architecture.md) for the matching rules, validation, and how this design can move to production.

## Verify and deploy

```sh
npm test
npm run build
```

Import the repository into Vercel, select Node.js 22, and use the checked-in configuration. The build serves a static site from `dist/` with no runtime secrets. The hosted demo uses the redacted snapshot. Browser imports run on the device, and the original ZIP and private CLI outputs stay out of the deployed site.

The welcome screen uses the free [Data pipeline illustration from Illos](https://illos.dev/library/shader/data-pipeline), with a local fallback if it cannot load. The demo opens without an account. A shared workspace would require authentication, per-workspace access controls, and persisted review history.
