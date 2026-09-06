---
"@stapel/moderation-react": minor
---

moderation: a screening failure gets its own tab, its own number and its own person

Pin → **stapel-moderation v0.7.0** (commit `646ea44`, the commit the tag is cut
from). Contract range `>=0.6 <0.7` → **`>=0.7 <0.8`**.

**What the backend did.** A screening that BROKE used to be written down as a
`policy_default / needs_review` verdict and queued for a person. On a client
stand on 2026-09-06 that produced 567 machine `needs_review` verdicts of which
not one was a judgement, 122 queued cases no moderator could act on, and twelve
days of green dashboards over a 78% screening failure rate. 0.7.0 gives the
failure its own state — `CaseState.DLQ`, carrying `dlq_at` /
`last_error_class` / `last_error` and **no verdict at all** — and its own
counters, `stats.queue_total` beside `stats.dlq_total`.

**The trap this pair was walking into.** `GET cases` without a `state` now
returns dead letters beside the human queue, and this console sent no `state`
at all. On the day 0.7.0 landed, the moderator's list would have grown an
outage's worth of rows that cannot be decided, wearing the same clothes as
work — the exact defect the backend release exists to end, re-created one layer
up. `useModerationQueue` now fills `state=queued` in **inside
`asCaseFilters`**, so no host, no `initial` and no "clear all" can reach the
mixture; `DEFAULT_QUEUE_STATE` is exported for a host building its own filter
bar. The state control drops its "Any" option (that IS the mixture) and never
offers `dlq` (that is the other tab), so it always names a state.

**The park, as a screen.** New `<DlqQueue>` (from `./default/admin`, and
mounted as `<ModerationQueue>`'s second tab — label the literal **DLQ** in
every locale, "screening failures, not decisions" under it):

- rows grouped by `last_error_class` with the class as a chip and the server's
  own message one click away — the stand was running **two** unrelated faults
  at once and one "screening unavailable" counter sent people to repair the
  wrong one. Groups biggest-first, rows oldest-first inside a group, because
  "since when" is what an engineer opens this on;
- a **«Пересканировать»** per row and a **«Пересканировать все»** that is that
  same call once per row, sequentially, with a live `{done} of {total}` and a
  count of what stayed behind. There is no bulk route on the wire and this does
  not invent one; a button that said "done" after firing twenty requests it
  never watched would be the same lie in a smaller place;
- a rescanned row hops to `queued` **where it stands** rather than vanishing —
  a row that disappears under the finger cannot be told from one that failed to
  send — and the next refetch removes it. A refusal puts it back.

**The headline is two numbers and never their sum.** The console header prints
`queue_total` (work a MODERATOR owes) and `dlq_total` (work an ENGINEER owes)
and no longer prints `open_total`, which adds them. Reading that sum as "the
queue" is precisely how a broken seam disguised itself as a busy one. The
`statsOpen` key is gone; `statsQueue` and `statsDlq` replace it.

**The case card** badges a dead letter and shows what broke. `CaseDetailPresenter`
does not carry the dlq stamps (only the queue row does), and a card reached by a
deep link has no row to read them off — so `useCase` reads the `dead_lettered`
AUDIT row, which is true whichever door the reader came through, and exposes it
as `CaseBag.dlq`. Filed upstream as an ask: present the four stamps on the
detail DTO too.

**Two drifts the vocabulary gate could not see.** `test/contract.test.ts`
re-reads the sibling's `models.py` — from `../..`, which is this repo's root,
one level short of where the siblings live. The read always missed, the source
fell back to `""`, and every case silently degraded to "the mirror is
non-empty". With the path corrected the gate immediately reddened on two
members that had been missing for releases: `CaseEventKind.rescreened` /
`escalated` (0.6.x) and `CaseOrigin.draft` (0.5.0, the case a refused draft
opens). Both are mirrored now, with copy in all three locales.

New exports: `useModerationDlq`, `groupByErrorClass`, `DlqGroup`,
`DlqRescanProgress`, `ModerationDlqBag`, `DEFAULT_QUEUE_STATE`, `DlqQueue`,
`DlqQueueProps`, `ModerationQueueTab`, `ERROR_CLASSES`, `ErrorClass`,
`HUMAN_QUEUE_STATES`, `CaseBag.dlq`, `CaseFilters.errorClass`,
`ModerationQueueProps.initialTab`. `SYSTEM_REASON_CODES` gains `subject_gone`
and `screening_failed` (0.7.0) plus `media_unavailable`, which predates them and
had no copy at all — a raw key on the glass.

Measured with dependencies held constant: `dist/index` 14.57 KB (limit 14 →
16), `dist/default/admin` 17.85 KB (18 → 20), `i18n/ru` 11.97 KB (12 → 13),
`i18n/es` 9.95 KB (10 → 11). `dist/default` is untouched at 12.1 KB — the
storefront bundle carries none of this.
