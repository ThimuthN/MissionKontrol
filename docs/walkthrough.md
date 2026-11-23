# Five minutes in Mission Control

This is the shortest path through the parts that matter. Use the [live workspace](https://missionkontrol.vercel.app/) or run `npm run dev` and open the local address. The public sample is redacted; the matching engine and browser ZIP import can work with the supplied original export.

## 0:00 — Enter the workspace

Create a local account, choose Light or Dark, and watch the new appearance sweep across the page. The account gives each reviewer a separate local decision history. It is intentionally not represented as server authorization for private records.

## 0:35 — Start with the question, not the dashboard

The **Next to verify** card points to an unresolved step. Open it. The card reads from the same effective case state as the casebook; as decisions are saved, the queue changes. It does not present an invented confidence score.

## 1:15 — Challenge a suggested connection

In **Laptop procurement**, choose **LP-02 → Order confirmed**. The Outlook confirmation is linked to a Teams request because the vendor, product and earlier approval fit. The recipient matched by first name only. Open the record and its matching checks. Leave it inferred until a reviewer has considered that weakness.

## 2:00 — Stop at an evidence gap

Choose **LP-10 → Receipt reported**. There is no linked receipt report. This is different from proof that the device was not received. **Flag for review**, add a short note, and save. The reviewer and timestamp appear in the form; the decision is available in local exports.

## 2:40 — A booking is not a conversation

Switch to **Recruitment screening** and open **RC-01**. The calendar records show scheduled starts. A separate Teams record can support a report that screening happened; it does not automatically verify a later client interview or offer. Read the status and reason at each checkpoint.

## 3:30 — Ask Mica, then inspect the source

Open the floating **Mica** guide. Try **“What needs a second look?”** or **“Find a case to review next.”** Its answer is composed from local case records and six constrained tools. Choose a cited stage or record to jump back to the evidence. Remove a wrong link with a reason and ask again: the effective case, queue and assistant should reflect the correction.

## 4:30 — Take the trail away

Open **Export → Print current case** for a source-backed review sheet, or export JSON/CSV. The repository also includes [real redacted intermediate output examples](examples/normalized.sample.json), the [raw-to-UI architecture](architecture.md) and the [brief checklist](requirements.md).

### What this demonstrates

The important behavior is not that a case timeline looks complete. It is that the system can explain *why* a record belongs to a stage, distinguish observation from inference, abstain where the trail goes cold, and let a person correct the reconstruction without erasing the underlying record.
