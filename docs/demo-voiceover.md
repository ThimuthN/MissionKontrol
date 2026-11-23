# Voiceover production brief

The [96-second interactive walkthrough](https://missionkontrol.vercel.app/demo.html) contains eight 12-second chapters. The film already supplies timed, selectable captions and optional on-device narration. This script is the source for a future recorded voice track or rendered MP4.

## Direction

- **Voice:** clear, warm, steady, natural English; the delivery is closer to a thoughtful product specialist than a launch-event announcer.
- **Pacing:** conversational, around 2.1–2.3 words per second. Give important distinctions a pause: *suggestion, not a fact*; *gap, not proof*.
- **Music:** optional, restrained electronic/ambient bed. It should stay behind the words and lift only during the scene changes and final mark. Avoid an inspirational corporate soundtrack.
- **Sound design:** soft paper/source transition, one quiet confirmation as an evidence check lands, and a subtle muted click for the reviewer correction. No sounds that suggest a decision was automatically approved.
- **Accuracy:** all references in the narration correspond to the redacted source cases. A calendar booking is not claimed to prove attendance; an absent receipt is not a failed delivery.
- **Output:** eight individually editable voice clips or one 96-second master, with enough tail on the final line. A rendered recording would replace the device's speech synthesis, not be played on top of it.

## Script and edit cues

| Time | Chapter | Narration |
| --- | --- | --- |
| 0:00–0:12 | One loose end | A supplier confirms a laptop order. But the delivery name matches only by first name. Does this email belong to the request? |
| 0:12–0:24 | Following the trail | Mission Control brings the request, quote and approval together, then connects the Outlook order. That last connection is a suggestion, not a fact. |
| 0:24–0:36 | Why the link is inferred | The supplier, laptop model and timing all line up. The recipient does not. Reviewers see every matching reason before deciding whether to trust the link. |
| 0:36–0:48 | Reviewer correction | When a reviewer spots a mistake, they can remove the link and explain why. The original source stays in the review history. |
| 0:48–1:00 | Missing evidence | Another case has no receipt report. That is an evidence gap. It does not prove the laptop was never delivered. That distinction matters. |
| 1:00–1:12 | Booked versus attended | Recruitment has the same challenge. A calendar entry tells us a screening was planned. A separate message may support a report that it happened. |
| 1:12–1:24 | Ask Mica | Mica answers questions using the reviewed records and links straight back to the evidence. Corrections also carry through to the case export and review queue. |
| 1:24–1:36 | Closing thought | The goal is not a perfect-looking timeline. It is a record people can trust, challenge and improve. That is Mission Control. |

The browser script stores each chapter as two phrases in `web/demo.js`; captions switch midway through the scene. The same cues are also supplied as a reusable [WebVTT file](../web/demo-captions.vtt), downloadable from the player's chapter drawer. Use those phrase boundaries when adjusting a final recorded track, and check the mix against the actual visual timing before replacing the interactive voice option.
