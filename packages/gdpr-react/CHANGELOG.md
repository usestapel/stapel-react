# @stapel/gdpr-react

## 0.3.0

### Minor Changes

- 57bd738: Make the privacy and staff screens survive a 390px phone, and delete the legacy harness demo.

  - **A responsive table** (`DataTable`, internal): a real `<table>` above the tablet breakpoint
    of its own element width, a stacked definition card per row below it. This closes the three
    blockers where a desktop table at 390px broke words one to three characters per line —
    `waiting-to-be-deleted` (`Stan/d-/up,/12/Augu/st`), `data-owners` (the "Holds" column over
    eleven lines) and `data-protection-requests` (subject emails clipped mid-address).
  - **Machine values are captions, never titles.** An erasure row is titled by what the thing IS
    ("Workspace") with the host's opaque key as `Ref ws-42` underneath; a DSAR row is titled by
    what it asks for with `Ref 6` underneath. The per-row expander's accessible name replaced
    "Show which systems have confirmed" as a column header.
  - **The disabled-reason wall is gone** from both tables: the overdue explanation is stated once
    above the deletions table instead of under every affected row, and the triage note rule is
    stated once under the queue with `aria-describedby` wiring every switched-off save to it.
  - **Non-events are no longer banners.** "You have not requested a data export yet" and "Your
    account is not scheduled for deletion" are quiet body text.
  - **The privacy page has a name.** `PrivacyPane` renders a heading and a lead sentence, and the
    export panel leads (the deletions list is empty for almost every account).
  - **The archive's loud button is the one that hands it over.** "Download archive" is the primary
    when the server says the token is unspent; the progress bar and "4 of 5 sections" no longer
    contradict the word "Ready" on a finished archive.
  - **The public intake page ships no dev scaffolding.** An unfilled captcha slot renders nothing
    instead of a dashed "your captcha widget renders here" box.
  - **The grace period has a clock.** `daysUntil` renders "23 days left" beside — never instead of
    — the server's date, as an ICU plural family in all three locales.
  - Owner-health mismatches name the DELTA ("Not answering for meeting") rather than reprinting
    both subject lists; counts are number-neutral or plural families, never `n item(s)`.
  - **Removed:** the `gdpr.closure` demo (story ids `account-closure--default|grace|erasing`), the
    legacy harness stories that printed `useAccountClosure` as a heading, `state.step` four times
    and `grace_ends_at: 2026-09-23T09:00:00Z`. `GdprProvider` is covered by `gdpr.privacy-pane`.
    The `gdpr.queue.column.reference` i18n key is removed; `gdpr.privacy.explain`,
    `gdpr.closure.grace_left.*`, `gdpr.deletions.overdue_count`, `gdpr.deletions.reference`,
    `gdpr.queue.reference`, `gdpr.queue.ack_overdue_count`, `gdpr.queue.ack_automated` and
    `gdpr.owners.subject_undeclared` are added in en, ru and es.

## 0.2.0

### Minor Changes

- 80617e9: The pair gets a face the showcase can photograph, a Spanish locale, an export
  that watches itself, and the public intake page it was missing.

  **Spanish.** `./i18n/es` (`gdprI18nBundleEs`, `registerGdprI18nEs`) — the
  generated backend bundle plus this pair's own ~120 UI keys. A GDPR module that
  could not speak a European language whose catalogue it already shipped was a
  bad look specifically for this module. `error.409.gdpr.export_cooldown` is now
  overridden in EN as well: Russian had a polished sentence English did not,
  which is a key that resolves in one locale only, and a new parity test pins
  en/ru/es to the same key set.

  **The archive stops being a screen that never changes.** `useDataExport` polls
  its own status every `EXPORT_POLL_INTERVAL_MS` (15s, exported) while a worker
  is building the archive, and stops on every final answer. The bag reports
  `building`, which is also what the panel's request gate reads — the refusal is
  now known before the duplicate request, not after it.

  **Ten demos, nine skins.** Every `src/default` export and every nav-mounted
  screen now has a demo that imports the SKIN (not the headless harness), each
  with a phone variant and every variant seeded at a named step: the account
  group's stories were a debug card with a `state.step` chip while sixteen
  designed screens had never been drawn.

  **A per-row erasure detail.** `useErasure` shipped in 0.1.0 with no consumer
  anywhere. Opening a row in `<PendingDeletions>` now reads that one erasure and
  shows the per-owner receipts and the processor windows that push
  `fully_erased_by` past `due_at` — the answer to "why is this still here?",
  which the row provokes and could not give.

  **The public intake page.** `<PrivacyRequestPane>` + the nav entry
  `public.privacy-request` (`surface: "public"`, a route, not a menu item). The
  anonymous DSAR form was previously an argued omission with no route, no example
  and no story; the argument was right about the menu and wrong about the route.
  The host's captcha is a declared slot, so an unfilled one is visible in a dev
  build instead of silent.

  **Breaking (pre-1.0, so minor).** `src/default/theme.tsx` and
  `src/default/ErrorAlert.tsx` are deleted and their exports (`GdprSkinTheme`,
  `GdprSkinThemeProps`, `ErrorAlert`) are gone: use `SkinTheme` / `ErrorAlert`
  from `@stapel/tokens-antd/skin`, which own the ConfigProvider and read the mode
  from the live document, so a shell's dark toggle repaints a mounted skin. Peer
  floors move to `@stapel/tokens-antd >=0.6.0` and `@stapel/core >=0.18.0`. The
  i18n keys `retry` and the five `*Loading` sentences are removed — the substrate
  owns those arms and their copy is core's floor. Also new: the `./nav-manifest`
  export alias other pairs already ship.

- 95e8eec: The account-closure confirm is a bottom sheet on a phone; four screens stop
  offering what they cannot do or hiding what they must say.

  The closure `Modal` now renders through `SkinDialog` with `maskClosable={false}`
  — a destructive confirm should not be dismissible by a stray tap on the
  backdrop.

  "Request an archive" stayed enabled while one was already `pending` or
  `processing`, reacting only after the server answered 429; the status was in
  the same render all along. It is gated on the in-flight status now, with the
  reason as visible text.

  Three `Tooltip`s in `PendingDeletions` carried the ONLY copy of what the screen
  exists to convey — what `timeout` means, which owners have not receipted, what
  "fully erased by" measures. Hover-only, so on a phone a person reading about
  their own deletion request got a bare tag and an unexplained column header.
  That copy is text now.

  `PendingDeletions` and `OwnersHealth` gained `scroll={{ x: true }}`, matching
  `DsarQueue` one directory over. And DsarQueue's "Save note" no longer offers a
  PATCH that writes the value already there.

### Patch Changes

- 350f61f: Generated artifacts these pairs were entitled to and never asked for.

  `gen:errors` pinned `ERRORS_LOCALES=ru` for gdpr-react and video-react while every other
  pair on that line used `ru,es`, so no Spanish bundle was ever emitted — even though
  `stapel-gdpr/translations/errors.es.json` already carried all 15 module keys and
  video's core-owned keys were sitting in stapel-core's catalog. One word per pair;
  `src/i18n/generated/errors.es.gen.ts` now exists in both (gdpr: 57 codes, complete over
  the registry; video: 51, `Partial` because stapel-video ships no catalog of its own and its
  keys stay the pair's to author). Reaching them needs an `./i18n/es` subpath, which is the
  pairs' own `package.json` to add.

  docs-react is enrolled in the root gen drivers for the first time — `gen:api`,
  `gen:errors` (ru+es), `gen:events`, `gen:flows`, `gen:manifest`. It was the only package in
  the monorepo that appeared in none of them, so everything the pipeline gives the other 16
  pairs was hand-written and ungated, and had drifted: `manifest.json` claimed
  `backend.contract ">=0.1 <0.2"` against stapel-docs 0.3.0 and invented two operationIds the
  backend has never had. The manifest and llms.txt are generated now (27 operations, 74 error
  codes with ru and es texts) and stand under the drift gate. The pair's own source said in
  three files that the backend emitted no contract artifacts; it does, and has for a while.
  `gen:nav` and `gen:demos` still wait on a `src/nav/manifest.ts` and a `demo/` directory.

## 0.1.0

### Minor Changes

- 1039839: New pair: `@stapel/gdpr-react` — the deletion lifecycle made visible to the
  person it is about. stapel-gdpr 0.5.x generalized erasure from "the account" to
  any SUBJECT a host removes, put a receipt slot behind every data owner that
  claims that subject, and added a DSAR intake with statutory clocks and an
  owner-health table that makes a silent system visible. None of it had a face.

  Two classes of defect are refused once, here, instead of being rediscovered per
  host.

  - **A refusal is read by CODE, never by status — and two 404s are not
    failures.** The module answers three different 404s, two different 409s and
    two different 410s. `GET /user/account/close/status` answers **404
    `gdpr.no_active_closure`** for the state almost every account is in, and
    `GET /user/data-export/status` answers **404 `gdpr.export_not_found`** for
    "you never asked for an archive". `useAccountClosure` and `useDataExport`
    fold exactly those two codes (never the status) into a `null` answer, so the
    screen a person opens to ask _"is my account being deleted?"_ can never reply
    "something went wrong", while `matchLoad`'s failed arm keeps meaning "we
    could not ask". The other 404 — a missing erasure — stays a real miss. The
    two 410s on the download are opposite advice at one status (`download_
consumed`: the archive was served, look in your downloads; `download_
expired`: it was never taken), and the two 409s on closure are a no-op
    (`closure_already_pending`, absorbed by a re-read) and a legal refusal a
    person is entitled to have explained (`legal_hold`). All of it lives in
    `model/refusals.ts` as named predicates.
  - **Two clocks, and neither is computed here.** `due_at` is when OUR systems
    must be done; `fully_erased_by` is that stretched to the last subprocessor's
    contractual window. `<PendingDeletions>` draws both as their own columns —
    showing only the first would tell someone their recording is gone from the
    world on a date when it is merely gone from us. Nothing derives, counts down
    or re-computes a deadline (`ack_due_at` is three BUSINESS days; a browser
    cannot do that sum): the pair FORMATS the instant the server sent and stops.

  What ships:

  - `useAccountClosure()` — the folded read plus `initiate` / `cancel`. Cancel
    resolves to the `null` the next GET would answer, because the module excludes
    cancelled rows from the status read and caching the response body would leave
    a row on screen no refetch could reproduce.
  - `useMyErasures()` — the "waiting to be deleted" list, with `pending` and the
    `timeout` rows an owner never receipted split out; `useErasure(id)` for the
    receipts and processor windows; **`useRequestErasure()`**, the mutation a host
    calls right AFTER its own delete succeeds (the clock it starts is a purge SLA
    for something already off the screen, not a grace period). Its 403 is usually
    the host's missing `ERASURE_AUTHORIZER` — the default is staff-only — so
    `isErasureForbidden` exists to say that rather than accusing someone of not
    owning their own recording.
  - `useDataExport()` — `request` / `status` / `download` for the Art. 15/20
    archive, which had shipped in stapel-gdpr since 0.1 and was reachable from no
    product. `download_available` is taken from the server (it also encodes "the
    single-use token is unspent"), never inferred from `status === "ready"`. The
    archive rides a raw-`fetch` carve-out (`api/download.ts`, the docs-react
    precedent) because core's client parses every success as text and a ZIP read
    as UTF-8 is no longer a ZIP; the token travels in the BODY, never a URL.
  - `useDsar()` — intake as a DISCRIMINATED UNION: the app variant sends no email
    (the server reads it off the session and ignores a supplied one), the
    anonymous variant requires one plus the host's captcha token. "Anonymous with
    no email" and "authenticated with someone else's email" are unspellable
    rather than 400s. Staff: `useDsarQueue()` (which names the ack breach that
    means the AUTOMATION failed, not that an operator was slow) and
    `useOwnersHealth()`.
  - `/default`: `<AccountClosurePanel>` (confirm, then the banner "your account
    will be deleted on <date>" with a cancel while the server still allows one),
    `<PendingDeletions>`, `<DataExportPanel>`, `<DsarForm variant>` and
    `<PrivacyPane>` — the screen `account.privacy` mounts, with the destructive
    control LAST so nobody deletes an account to answer a question an export
    would have answered. `/default/admin`: `<DsarQueue>` and `<OwnersHealth>`,
    where a silent owner is a WARNING ROW and never an absent one — the table is
    built from the inventory, because one assembled from replies looks healthiest
    exactly when the deployment is most broken.
  - Nav: `account.privacy` and `admin.privacy`, both `member`. The axis has two
    values and cannot say "staff", so both admin surfaces name the
    `error.403.forbidden` they get instead of rendering an empty operations table.
  - en + ru. Unlike video/chat/cdn, NOTHING is authored to fill an upstream gap:
    stapel-gdpr ships `translations/errors.{ru,es}.json` covering all 15 keys it
    owns, so the generated ru bundle is complete over the registry. The four
    hand-written error strings are deliberate OVERRIDES, and a test asserts the
    folded 404's copy is the same string as the screen's own in both locales.

  Out of scope, and not by omission: `POST /internal/export/{id}/part-ready` is a
  service endpoint (`IsServiceRequest`) a data owner posts to with a credential
  no browser holds. `manifest.json` still lists the whole contract. The pair
  ships `./i18n/ru` only; the module's Spanish catalogue is complete, so es is one
  `ERRORS_LOCALES` value plus one authored bundle away.

  Contract pinned at stapel-gdpr v0.5.2 — the release that EMITS the contract
  triad at all (the module had no codegen; `docs/schema.json` did not exist, so
  this pair could not have been generated before it — the stapel-cdn v0.12.0
  precedent). Not published: the first publish of a new pair is a one-time manual
  bootstrap by the owner.

## 0.0.0

- Scaffolded from the video-react etalon (frontend-standard §9,
  frontend-core-architecture §4 checklist). Layers api → model → flows →
  headless → i18n; drift-gated generated surfaces (typed schema, backend error
  map, manifest + llms.txt, nav manifest) via the shared monorepo `gen:*`
  drivers.
