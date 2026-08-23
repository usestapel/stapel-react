# @stapel/gdpr-react

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
