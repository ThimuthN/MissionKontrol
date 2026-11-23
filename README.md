# Mission Control

[Open the MissionKontrol demo](https://missionkontrol.vercel.app/)

Mission Control lets Harbourline Talent employees check how a piece of work unfolded across Teams and Outlook. The casebook reconstructs two workflows from the March assessment export.

| Workflow | Cases in the redacted demo | What the records support |
| --- | ---: | --- |
| Laptop procurement | 15 | 13 supplier order confirmations and 9 reports of receipt |
| Recruitment screening | 52 | 52 screening slots, 13 linked reports of screening conversations, 27 interview slots and 9 candidate offer replies |

Across 11,346 input rows, the two workflows link 166 records. Each record carries a source, timestamp meaning, and reason for its link. A booking shows what was scheduled. Attendance needs separate evidence.

## Run the prototype

Use Node.js 22. The project has no package dependencies.

```sh
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). A reviewer-access welcome prompt introduces the app; choose **Explore the demo** to see a case with an inferred link. Use the workflow tabs to change registers, **Import ZIP** to open an export, or the Mission Control mark to return to the dataset chooser.

1. Follow a complete Teams thread through request, quote and approval.
2. Inspect an Outlook order whose recipient matched an approved request by first name. Check what supported the link and why the app still calls it inferred.
3. Open a recruitment case and replay its records in timestamp order. Inspect a calendar slot, then look for a separate report of the conversation.
4. Open **Ask the evidence** and ask “What needs a second look?” Select a cited record to check the answer. “Find a case to review next” ranks cases by inferred links and missing stages across the active workflow.
5. Remove an incorrect link and enter a reason. The timeline, assistant and exports reflect the correction. Restore the link from the excluded records. Review history stays on this device.

After saving a decision, **Next step to check** takes you to an unreviewed inferred link or an evidence gap. Unsubmitted notes stay in the current tab as you move between cases. **Export → Print current case** opens a print sheet with the linked records, source times, matching reasons and saved decisions. Use your browser’s PDF option to share that case.

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

Import the repository into Vercel, select Node.js 22, and use the checked-in configuration. The build serves the interactive client from `dist/` with no runtime secrets. The demo uses the redacted snapshot. Browser imports and assistant analysis run on the device. The original ZIP and private CLI outputs stay out of the deployed site.

The assistant chooses among six read-only tools. It uses a compatible, already-installed browser language model when available and a small local intent classifier otherwise. Answers are assembled from current records and stage states. Ask for a team brief to download recurring handoffs, examples and questions to discuss before automating. Each response names its routing mode. No paid model key is required.

The interface offers persistent **light and dark modes**, with a teal-and-navy scene set apart from the evidence workspace. The floating theme switch reveals the new palette in a circular transition where supported. An ambient canvas animates the network in the workflow overview and responds to a pointer within that scene. Case cards now have equal-height checkpoints, aligned connectors, provenance badges and hover illumination. Buttons, source sheets, menus, assistant answers, and review controls have subtle tactile and entrance transitions. The canvas is capped near 30fps, pauses in background tabs, and stops with **Pause motion** or the operating system's reduced-motion preference. It does not process or transmit records. No remote images, font CDNs, analytics, or animation packages are needed.

The reviewer-access prompt is displayed once per tab and can be reopened with **Sign in**. It gives visitors a genuine account-entry point when OAuth is configured, while retaining an explicit guest demo. A separate dataset-chooser welcome view includes a redacted source record and CSS-built orbital illustration. No account is required to inspect the public sample.

### Optional reviewer sign-in

For the hosted build, register a GitHub OAuth app with the callback `https://YOUR-DOMAIN/api/session`. Set `APP_ORIGIN` to the canonical HTTPS origin, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to the app credentials, and `SESSION_SECRET` to at least 32 random characters in Vercel's server environment. Redeploy after setting these. Until then, **Sign in** opens an honest reviewer-access prompt with the GitHub action visibly unavailable. It does not pretend to authenticate. Once configured, sign-in uses the server-side OAuth code exchange and signed identity cookie. Signed-in review decisions include the GitHub username in local exports. Shared storage and access control for uploaded files are outside this prototype, and the public demo remains available without sign-in.
