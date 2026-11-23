# Mission Control

[Open Mission Control](https://missionkontrol.vercel.app/)

**Reviewer route:** [Watch the 96-second walkthrough](https://missionkontrol.vercel.app/demo.html) · [Open the workspace](https://missionkontrol.vercel.app/) · [Check requirement coverage](docs/requirements.md) · [Read the system design](docs/architecture.md) · [Open the pipeline outputs](docs/examples/normalized.sample.json).

For a fast evaluation, follow the [five-minute reviewer walkthrough](docs/walkthrough.md).

Mission Control gives operations teams a place to follow a workflow, inspect its supporting records and make documented review decisions. The public Harbourline sample workspace reconstructs two workflows from a redacted March export.

| Workflow | Cases in the sample workspace | What the records support |
| --- | ---: | --- |
| Laptop procurement | 15 | 13 supplier order confirmations and 9 reports of receipt |
| Recruitment screening | 52 | 52 screening slots, 13 linked reports of screening conversations, 27 interview slots and 9 candidate offer replies |

Across 11,346 input rows, the two workflows link 166 records. Each record carries a source, timestamp meaning, and reason for its link. A booking shows what was scheduled. Attendance needs separate evidence.

## Run the prototype

Use Node.js 22. Install the two browser-animation dependencies and start the local server:

```sh
npm ci
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The [short walkthrough](http://127.0.0.1:4173/demo.html) plays without an account and can be paused or scrubbed. For the workspace, create a local account with your name, email, a password of at least 10 characters, and your preferred light or dark appearance. The preference is applied with a two-pass sweep and remembered for that account. Sign in to return to your reviews in the same browser. Use the collapsible sidebar to switch between the overview, review queue and casebook, or to import and export records.

1. Follow a complete Teams thread through request, quote and approval.
2. Inspect an Outlook order whose recipient matched an approved request by first name. Check what supported the link and why the app still calls it inferred.
3. Open a recruitment case and replay its records in timestamp order. Inspect a calendar slot, then look for a separate report of the conversation.
4. Open **Mica**, the floating workflow guide, and ask “What needs a second look?” Select a cited record to check the answer. “Find a case to review next” ranks cases by inferred links and missing stages across the active workflow.
5. Remove an incorrect link and enter a reason. The timeline, assistant and exports reflect the correction. Restore the link from the excluded records. Review history stays on this device.

After saving a decision, **Next step to check** takes you to an unreviewed inferred link or an evidence gap. Unsubmitted notes stay in the current tab as you move between cases. **Export → Print current case** opens a print sheet with the linked records, source times, matching reasons and saved decisions. Use your browser’s PDF option to share that case.

The overview's **Next to verify** card shows the first open source-matching question (inferred links before missing evidence) and takes you straight to that checkpoint. Saving a decision removes it from the open queue, and the review form shows who saved it and when. The queue is computed from the effective report after local link corrections; it is not an AI-generated score.

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

### Openable intermediate output examples

The private analysis outputs contain the underlying fictional employee names and source text and are intentionally not committed. To make the processing contract inspectable without publishing those records, the repository includes a small redacted excerpt of *real pipeline-linked records*, preserving their relationships:

| File | What to inspect |
| --- | --- |
| [`counts.json`](docs/examples/counts.json) | Real input, duplicate and rejection totals from the supplied ZIP |
| [`normalized.sample.json`](docs/examples/normalized.sample.json) | Eight normalized, pseudonymized linked events with source type and timestamp meaning |
| [`links.sample.json`](docs/examples/links.sample.json) | The corresponding event-to-case links and matching rules |
| [`rejected.sample.json`](docs/examples/rejected.sample.json) | Empty because all original rows parsed successfully; see rejection tests for negative cases |
| [`report.sample.json`](docs/examples/report.sample.json) | One procurement case and one recruitment case with redacted evidence and status |

After importing the original ZIP in the CLI, run `node scripts/public-examples.mjs` to regenerate these five files. They are intentionally illustrative excerpts, not a substitute for `private/` or an entire importable report. See the [requirements-to-evidence checklist](docs/requirements.md) for coverage and remaining production boundaries.

## Verify and deploy

```sh
npm ci
npm test
npm run build
```

Import the repository into Vercel, select Node.js 22, and use the checked-in configuration. The build serves the interactive client from `dist/` with no runtime secrets. The demo uses the redacted snapshot. Browser imports and assistant analysis run on the device. The original ZIP and private CLI outputs stay out of the deployed site.

Mica, the side-drawer assistant, chooses among six read-only tools. It uses a compatible, already-installed browser language model when available and a small local intent classifier otherwise. Answers are assembled from current records and stage states. Ask for a team brief to download recurring handoffs, examples and questions to discuss before automating. It cites the current case and source records rather than inventing answers. No paid model key is required.

The interface offers persistent **light and dark modes**, with a deep-petrol, sea-glass and copper palette separating the luminous overview from the practical evidence desk. Creating an account asks for an appearance preference; switching uses two distinct diagonal passes, including when the account dialog is open. Reduced-motion users receive an instant change. The overview blends the original source-trail illustration with a pointer-responsive Light Ripple shader when WebGL is available, and keeps the authored illustration as its fallback. The shader is capped near 30fps, pauses in background tabs and respects **Pause motion** and the operating system's reduced-motion preference. Mica has an original constellation mark and a restrained floating animation. The layout includes a collapsible desktop rail and a small-screen drawer. All artwork, fonts, Three.js and GSAP are served from the project; there are no runtime third-party CDNs, trackers or external model requests.

The [96-second walkthrough](https://missionkontrol.vercel.app/demo.html) is a self-hosted, animated, scrubbable scene sequence with keyboard and reduced-motion controls. It follows an uncertain order link, a reviewer correction, a missing receipt, the difference between a scheduled and reported screening, and a source-cited Mica answer. This is an interactive web film rather than a separately rendered MP4.

The account screen is required to enter the workspace; there is no guest bypass. The account menu supports sign-out, and a new sign-in is required before the workspace can be used again. A separate workspace chooser includes a source-record illustration. The public sample data remains shipped in the client bundle; account gating is a user-experience boundary, not server-side access control for private records.

### Account model and production authentication

The built-in email/password account is **device-local**. A random salt and PBKDF2-SHA-256-derived password digest are stored in browser local storage; raw passwords are not saved or transmitted. The active account uses tab session storage. Review data is namespaced by account, and existing pre-account reviews are assigned to the first account that opens that workflow. This is useful for offline evaluation but **not** a production identity system: accounts do not sync, browser data can be cleared or inspected locally, there is no password recovery, and access to the public sample dataset is not enforced by a server.

For real team deployment, replace local accounts with a managed identity service and server-backed storage, including account recovery, rate limiting, secure sessions and authorization for private data.

The GitHub OAuth path is also supported. Register a GitHub OAuth app with callback `https://YOUR-DOMAIN/api/session`. Set `APP_ORIGIN` to the canonical HTTPS origin, `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to the app credentials, and `SESSION_SECRET` to at least 32 random characters in Vercel's server environment. Redeploy after setting these. GitHub sign-in appears only when correctly configured and uses a server-side OAuth code exchange and signed identity cookie. Review decisions include the current reviewer name in local exports.
