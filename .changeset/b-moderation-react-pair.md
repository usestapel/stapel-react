---
"@stapel/moderation-react": minor
---

The moderation pair's contract layer: the typed operation surface, the
vocabularies, the refusal dialect and the trilingual copy.

- **All eighteen operations** of stapel-moderation 0.3.0, with the trailing
  slash the URL conf makes load-bearing (user routes carry one, console routes
  do not — `APPEND_SLASH` only rescues a GET, and only by dropping the body).
  Every path string is pinned by `test/contract.test.ts`.
- **`content` is typed from the contract.** Backend 0.3.0 made it a declared
  `ContentDTO` field of the case card, so the hand-written
  `CaseDetail & { content }` this pair was specced to carry never had to exist.
- **The vocabularies** (`src/api/enums.ts`) are hand-mirrored from `models.py`
  because DRF types every one of them as a bare `string`, and a test re-reads
  the sibling's source so the mirror cannot drift silently.
- **Refusals are read by code, never by status** (`src/model/refusals.ts`):
  four different 403s mean four different sentences, and `case_claimed` vs
  `case_resolved` share a status while meaning "wait" and "nothing left to do".
  Backend 0.3.0's three newly reachable codes are named: a decided appeal is
  `409 moderation_appeal_resolved` (not the old `400 invalid_outcome`),
  `moderation_reason_not_applicable` is a stale form rather than client
  nonsense, and `moderation_not_claimant` is somebody else's lease.
- **Flow machines** for report, appeal and triage, including the lease rule
  the server enforces silently (`leaseStatus`), and the keyset cursor derived
  from the page (`nextBefore`) — core's client cannot expose the response
  header that carries it.
- **271 keys in en, ru and es**, plus the generated 70-code backend error
  catalogue in all three.

The default skin ships only the scaffold panel so far; the screens named in
the build spec (ReportButton/ReportSheet, AppealPanel, ModerationQueue and the
console) are the next wave — see `SCRATCH/wave-b/HANDOFF-moderation-react.md`.
