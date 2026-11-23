# What the take-home asks for, and where to find it

This checklist is based on the supplied **Mission Control Take-Home Assessment** and **Mission-Control-Challenge** brief, not an invented product brief. The product name and visual presentation are original to this submission. The exercise describes a four-week fictional Harbourline People-team export (2–29 March 2026) with Outlook, Teams and screen-log traces and asks for a clickable reconstruction of company workflows, with evidence and reviewer correction.

| Brief requirement | Evidence in this repository | Scope / limitation |
| --- | --- | --- |
| Read the supplied fragmented exports | `src/zip.mjs`, `src/exports.mjs`, `src/normalize.mjs`, CLI and browser ZIP import | Recognizes the supplied Outlook, Teams and screen-log formats; does not claim to generalize to every exporter |
| Reconstruct meaningful workflows | `src/pipeline.mjs`, `src/recruitment.mjs`, procurement and recruitment tabs | 15 procurement and 52 recruitment cases are supported; sparse activity is not forced into cases |
| Show the actual traces behind a step | Case stage strip, source sheet, chronological replay and source references | Public site uses redacted prose and rounded times; imported local records show their own details |
| Mark direct observation versus inference | Observed / inferred / missing legend, step interpretation, order-matching checks | A reported action is not independent proof that it occurred |
| Let employees confirm or correct a link | Review decision, note, unlink, restore and review history in `web/review-model.js` | Reviewer history persists locally per account, not as a shared server audit log |
| Avoid treating a booked event as attendance | Explicit scheduled-start semantics, separate screening reports, unit tests | The app abstains when actual attendance evidence is absent |
| Clickable, explorable prototype | Case register, search, filters, workflow switch, stage navigation, replay, export, print, Mica side agent | Data is a sample plus optional local ZIP import, not a live Microsoft 365 sync |
| Architecture and raw-to-UI explanation | [`architecture.md`](architecture.md), matching rules, system flow, data contracts | Includes proposed production direction but no production ingestion infrastructure |
| Schemas / data structures | [`architecture.md`](architecture.md#file-shapes), typed fields documented per layer, JSON examples | JavaScript data contracts, not an API schema registry |
| Intermediate outputs as files reviewers can open | [`examples/counts.json`](examples/counts.json), [`normalized.sample.json`](examples/normalized.sample.json), [`links.sample.json`](examples/links.sample.json), [`rejected.sample.json`](examples/rejected.sample.json), [`report.sample.json`](examples/report.sample.json) | Small redacted excerpts; full source-derived outputs are created by `npm run ingest` in ignored `private/` |
| Short README, public project and demonstration | [`README.md`](../README.md), tests, [96-second interactive walkthrough](https://missionkontrol.vercel.app/demo.html), live workspace | The walkthrough is a self-hosted playable web film, not an MP4 export |

## What we deliberately did not infer

The evidence does not prove a meeting happened just because Outlook contains an appointment. Nor does a reported laptop receipt establish a physical delivery timestamp. Ambiguous recipients, aliases and competing plausible case matches stay inferred or unlinked. This abstention is part of the product behavior, not missing animation.

## Distinctive product decisions beyond the minimum

- **Mica:** a floating source-grounded guide that routes questions through six read-only tools, cites records and reflects local corrections. It can suggest the next case but cannot silently change evidence.
- **Reviewer continuity:** an overview queue that prioritizes unverified links before gaps, “next step to check,” reviewer and timestamp attribution, reasons for exclusions, and a case print sheet suitable for discussing the trail.
- **Human-first semantics:** compact source status key, step-specific interpretation, and plain-language workflow copy in place of assignment terminology.
- **Own visual language:** original signal icon, animated network scene, staged diagonal appearance transition chosen on signup, light and dark modes, restrained interactive surfaces, and a reduced-motion escape hatch.
- **Guided evaluation:** an openable 96-second walkthrough of the two most important uncertainty distinctions, a collapsible navigation rail, and a small-screen navigation drawer.

## Production boundary

This is a complete **assessment prototype**, not a ready-to-handle-private-employee-data SaaS. The email/password flow is browser-local and cannot verify users across devices. A production release would require managed identity and recovery, organization authorization, encrypted server-side event storage, retention rules, collaborative edit history, incremental Microsoft 365 ingestion and observability. None of those are implied by the visual polish.
