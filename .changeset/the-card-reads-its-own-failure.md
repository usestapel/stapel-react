---
"@stapel/moderation-react": patch
---

moderation: the dead-letter card reads its own failure, and stops reading the audit trail for it

Pin → **stapel-moderation v0.7.2** (commit `cd50493`, the commit the tag is cut
from). Contract range `>=0.7 <0.8` is unchanged, and so is every locale bundle:
`docs/errors.json` and `docs/flows.json` are BYTE-IDENTICAL across 0.7.0..0.7.2,
so this pair gains no error code and no flow. `docs/schema.json` moves by
exactly four optional properties on `CaseDetailPresenterDTO` — and those four
close the one upstream ask this pair filed with the 0.7.0 pin.

**What the backend did.** `CaseDetailPresenterDTO` now presents `dlq_at`,
`last_error_class`, `last_error` and `escalated_at`: the same four values the
queue row has carried since 0.7.0, on the card as well. (`manage.py
moderation_rescreen` also dispatches onto the worker instead of screening
inline — nothing here reads that.)

**What that deletes here.** Until now a card opened on a `dlq` case could not
read the failure off its own body, and the queue row is not available when the
card was reached by a deep link — so `useCase` read the `dead_lettered` AUDIT
row for it, and to have that row it forced the events query on for every
dead-lettered case, whether or not anybody had asked for the history. That
fallback is gone: `CaseBag.dlq` is built from the detail DTO
(`src/headless/useCase.ts`), the events query is enabled by `showEvents` alone,
and a dlq card now costs ONE read like every other card. `DlqStamp` keeps its
shape (`at` / `errorClass` / `error`), so no host changes.

The `"dead_lettered"` member of `CaseEventKind` stays in `api/enums.ts` and
stays pinned by `test/contract.test.ts` — the audit row still exists and the
history still renders it; what is gone is reaching into an event payload for a
field the DTO now declares. `CaseDetail.last_error_class` is re-typed to
`ErrorClass | ""` the way the queue row's already was: one field, two
presenters, one closed vocabulary.

The test that would go red if the fallback came back answers the events route
with a full `dead_lettered` trail and asserts the card never asks for it — and
a second test asserts the audit read DOES happen the moment `setShowEvents(true)`
is called, so "no request" cannot be achieved by breaking the history.
