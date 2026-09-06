# @stapel/moderation-react

## 0.2.1

### Patch Changes

- 9029bce: moderation: the dead-letter card reads its own failure, and stops reading the audit trail for it

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

## 0.2.0

### Minor Changes

- bd6d04f: moderation: a screening failure gets its own tab, its own number and its own person

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

## 0.1.3

### Patch Changes

- c5460df: moderation: the declared backend contract says `>=0.6 <0.7`, because that is what the storefront it is installed on runs

  The pin had been held at v0.3.0 because 0.5.0 is `feat(moderation)!` — marked
  breaking by its own author — and a breaking wire change deserves the wave that
  exercises the appeal flow end to end rather than a regen ridden in on someone
  else's train. That is the right instinct and the wrong conclusion here, and the
  hold note itself says why: a hold records a decision, not a fact, and the claim
  inside it has to be checked eventually.

  Checked: `git diff v0.3.0..v0.6.3 -- docs/schema.json docs/errors.json
docs/flows.json` is **empty**. Both `!` releases break Python extension points,
  not HTTP — 0.5.0's appealable draft screening arrives as the `screen_draft` gate
  function, 0.6.0's stuck-case recovery as the `rescreen_stuck_cases` beat entry
  (which also moved from `stapel_moderation.tasks` to `stapel_moderation.beat`) —
  and `docs/capabilities.json` is the only committed contract artifact in the span
  that moves at all. So every generated file in this pair regenerates
  byte-identical, and this release changes exactly one thing: `manifest.json` and
  `llms.txt` stop announcing `>=0.3 <0.4` while the deployment runs 0.6.3.

  That is worth a version of its own rather than a silent repo-local edit. A
  declared range that no longer contains the backend is the seam defect in its
  purest form — both halves green in isolation, the statement joining them false —
  and it is only fixed for anyone outside this repo once the corrected manifest is
  published.

## 0.1.2

### Patch Changes

- f79bdc3: tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

  `GatedControl` handed callers `bind.disabled` and its own JSDoc told them to spread it straight onto the control. That produced an html-`disabled` element, which fires no events in any browser: it cannot be clicked, cannot take focus, cannot be described to a screen reader that never reaches it, and cannot carry the one gesture that mattered — the tap that should open the sign-in door standing behind the gate. Every gated control across the ~20 pairs using it was inert, and the wrong instruction was half the defect: the docs taught the shape that broke it.

  Measured on a live deployment: an anonymous visitor taps the favourite heart and nothing happens at all — no sentence, no tooltip, no door (walker defects D45/D72).

  **The corrected contract.** While the gate is shut a control is now `aria-disabled="true"` and NOT html-disabled, so it stays focusable and keeps receiving events. The ACTION is suppressed by `GatedControl` itself, in a capture-phase wrapper (`display: contents`, so no pair's layout moves by a pixel): the caller's `onClick`, keyboard activation, typing, IME input, paste and drop are swallowed before the control sees them. Callers write their handlers exactly as if the gate did not exist. The activation comes back as the new `onBlockedActivate`, which is where a pair opens its door. The reason stays where it was — visible text wired by `aria-describedby` — and where a `PaneGate` pools it into one footnote, the gesture now brings a `role="status"` copy of the sentence back to the control it belongs to. A blocked `GatedButton` keeps antd's exact disabled paint (its own `-disabled` class, which sets no `pointer-events`), so nothing about any screen looks different.

  `GatedControlProps.whenBlocked` holds the two deliberate opt-outs, neither of them the default:

  - `"inert"` — html `disabled`, for the rare control that must be switched off at the browser level. `attributes-react`'s catalogue lock is the one place in the fleet that asks for it, and now says so.
  - `"annotate"` — the control stays fully usable and only gains the sentence, for a gate that judges the VALUE rather than refusing the person: `calendar-react`'s slot-length field must stay editable, because editing it is how the reason goes away, and `search-react`'s sort must still pick the options that are not the blocked one.

  `useBlockedButtonClassName()` is exported for render-prop call sites that paint their own button and want the same unavailable look rather than a second grey.

  **⚠️ The readiness-signal hazard, and its cure.** `element.disabled` is now permanently `false` on every gated control in the fleet. Any test using it as a readiness signal — `await waitFor(() => expect(save.disabled).toBe(false))`, meaning "wait until this is allowed" — returns instantly and mis-times SILENTLY: every assertion after it reads an unseeded component, and the failure looks like broken product logic rather than a gate that had not opened. One pair's suite went green → 21 failures across unrelated files on exactly this. Wait on the stamp instead, which is what such a wait was always asking:

  ```ts
  await waitFor(() =>
    expect(
      screen.getByTestId("save-gate").getAttribute("data-stapel-gated")
    ).toBe("available")
  );
  ```

  `data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

  **ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

  **The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.

## 0.1.1

### Patch Changes

- f9d8b66: Console fits a phone: the state `Segmented` scrolls inside its own box instead of dragging the page to 668px in a 390px viewport, the five filter fields collapse behind one "Filters" control below the table breakpoint, and the appeals filter leaves the card header (which never shrinks). The case card leads with the reported item's own title and keeps the lease acts pinned to the top of the sheet's scroll box; the lease is a sentence rather than a mislabelled field, an unresolvable holder is named as "another moderator" instead of a raw id, and report counts go through ICU plurals.

## 0.1.0

### Minor Changes

- 80617e9: The moderation pair, contract layer AND default skin: a person can report
  content, appeal a decision and read the rules; a moderator can triage, decide
  and sanction — all from screens this package ships.

  **Contract layer.** All eighteen operations of stapel-moderation 0.3.0, with the
  trailing slash the URL conf makes load-bearing (user routes carry one, console
  routes do not — `APPEND_SLASH` only rescues a GET, and only by dropping the
  body); every path string pinned by `test/contract.test.ts`. `content` is typed
  from the contract: 0.3.0 made it a declared `ContentDTO` field of the case card,
  so the hand-written `CaseDetail & { content }` this pair was specced to carry
  never had to exist. The vocabularies (`src/api/enums.ts`) are hand-mirrored from
  `models.py` because DRF types every one of them as a bare `string`, and a test
  re-reads the sibling's source so the mirror cannot drift silently. The keyset
  cursor is derived from the page (`nextBefore`) — core's client cannot expose the
  response header that carries it, and deriving it is strictly better, because the
  backend sets that header on the last page too.

  **Refusals are read by code, never by status.** Four different 403s are four
  different sentences; `case_claimed` and `case_resolved` share a status while
  meaning "wait" and "there is nothing left to do". 0.3.0's three newly reachable
  codes are named: a decided appeal is `409 moderation_appeal_resolved` (not the
  old `400 invalid_outcome`), `moderation_reason_not_applicable` is a stale form
  rather than client nonsense, and `moderation_not_claimant` is somebody else's
  lease.

  **Default skin — `./default`:** `ReportButton` (the embeddable slot other pairs
  mount; no nav entry, because it is a control with a target rather than a
  screen), `ReportSheet` (a bottom sheet on a phone; the description box is always
  visible and only its REQUIREMENT moves with the reason; the Art. 15(1)(e)
  screening notice is rendered from the policy, so a deployment that screens
  nothing does not claim to), `AppealPanel` (whose no-link arm EXPLAINS that an
  appeal needs the reference from the notification — no endpoint lets a subject
  list decisions about themselves — instead of drawing a composer that could never
  submit) and `PolicyDisclosurePane` (Art. 15, computed from the live
  configuration rather than written).

  **Default skin — `./default/admin`** (a new subpath, so a storefront bundle
  never carries the console): `ModerationQueue` (keyset paging, filters, counters;
  a table where there is room and cards where there is not, decided by the
  ELEMENT's width rather than the viewport's; the mandate 403 is NAMED, because
  the nav surface axis has no "staff" value and a container will route an ordinary
  member here), `CaseDetail` (the `ContentDTO` card that draws a failed content
  read as a failed read — a moderator must never be handed an empty box that looks
  like empty content — the reports/verdicts/sanctions/appeals/history trail, and
  claim/extend/release/rescan each gated by the lease the server enforces
  silently) and `AppealsQueue`. Verdict and sanction controls are
  `ActionAvailability` gates with the reason beside the control, and a verdict that
  also sanctions an author goes through `SkinConfirm` whose button names what it
  does.

  **Also:** five headless bags (`useReport`, `useReportPolicy`, `useAppeal`,
  `useModerationQueue`, `useCase`, `useAppealsQueue`) that hand out those same
  gates, so a host writing its own skin inherits the reasons and not just the
  booleans; four nav entries (`moderation.policy` public, `account.appeals` under
  `account.root`, `admin.moderation` + `admin.moderation-appeals` under
  `admin.root`); demos for all seven skin components with phone variants; 97 tests
  including every surface rendered at phone and desktop width in light and dark.

  **Breaking (pre-1.0, hence minor):** the scaffold's `ModerationPanel` is gone
  from `./default` — it was a placeholder card, and the screens above replace it.

  **Fixed:** this pair's `toFlowError` is now idempotent. A flow machine's
  `refused` state carries a `FlowError`, and core's fold only recognises
  `StapelApiError` — so folding one a second time erased the code and every
  refusal predicate downstream of a machine answered `false`. Filed for core.

  **271 keys in en, ru and es**, plus the generated 70-code backend error
  catalogue in all three.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
