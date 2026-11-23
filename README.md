# Mission Control

Mission Control reconstructs laptop procurement cases from four weeks of Harbourline Talent activity. It connects Teams requests, quotes and approvals to Outlook order confirmations and Teams receipt reports. Each stage shows why records were linked and where evidence is missing.

## Run the prototype

Use Node.js 22. The project has no package dependencies.

```sh
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). Choose **Open demo** to use a redacted snapshot derived from the assessment dataset. Choose **Import data** to inspect the supplied ZIP in your browser.

1. Select a procurement case. Compare the request, quote, approval, order and receipt stages.
2. Open an order confirmation to see the matching evidence and rule. Find a case with missing evidence and compare its timeline.
3. Confirm or flag a step and add a note. Review decisions are saved in this browser. Use the export actions to take the evidence and decisions as JSON or the case summary as CSV.

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
