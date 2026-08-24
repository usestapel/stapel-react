# @stapel/gdpr-react — module guide

Headless React pair for **stapel-gdpr**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## Layers

- **api/** — `createGdprApi(client, options)`; types are aliases over the
  package-LOCAL generated `components["schemas"]` (`src/api/generated/schema.ts`,
  produced by `pnpm gen:api` from stapel-gdpr's own `docs/schema.json`; never
  parallel hand-written bodies). The aliases drop the backend's `DTO` suffix —
  a host writing `AccountClosure` should not have to know which serialization
  strategy the module picked. Two request shapes are DISCRIMINATED UNIONS
  (`DsarSubmission`, and `RequestErasureBody`'s required pair) so a state the
  server refuses cannot be spelled. `api/download.ts` is the one raw-`fetch`
  carve-out: the export archive is a ZIP, and core's client parses every
  success as text.
- **model/** — `gdprQueryKeys` (everything under `["gdpr"]`, and deliberately
  free of any user id: every read is "mine" or staff-wide and the server
  decides whose data that is), the five reads and six writes split by subject
  (`closure.ts`, `erasures.ts`, `dataExport.ts`, `dsar.ts`, `owners.ts`),
  `refusals.ts` (the code-not-status predicates — the most load-bearing file in
  the package), `dates.ts` (formatting a server-computed instant, never
  computing one), plus runtime and context.
- **flows/** — `toFlowError` + the zero-flow `GDPR_FLOWS` registry shim
  (slim wave §21/S3). stapel-gdpr annotates no `@flow_step` and account closure
  is not a missing machine: its steps are a 30-day grace and a sweep task on
  the server, so a flow machine would be a client-side model of a clock it does
  not own.
- **headless/** — `<GdprProvider>` wires the runtime into context.
  shadcn-copyable (frontend-standard §7).
- **default/** — the member antd skin: `<AccountClosurePanel>`,
  `<PendingDeletions>`, `<DataExportPanel>`, `<DsarForm>`, `<PrivacyPane>`
  (the wired screen `account.privacy` mounts) and `<PrivacyRequestPane>` (the
  PUBLIC intake page `public.privacy-request` mounts — prop-free, because the
  nav contract mounts a named export with no props, which is why an
  anonymous-only form prop could never be a route). Every one renders its arms
  through the shared substrate's `LoadBoundary`/`LoadList`, and the ready arm
  of the two folded reads has two shapes — a closure or none, an export or
  none — so neither is ever drawn as "empty". There is no local `theme.tsx` or
  `ErrorAlert.tsx` any more: both are `@stapel/tokens-antd/skin`'s
  (`SkinTheme`, `ErrorAlert`), so the reactive-theme fix lands once for the
  fleet instead of nine times.
- **default/admin/** — the staff skin on its OWN subpath: `<DsarQueue>`,
  `<OwnersHealth>`, `<PrivacyAdminPane>`. Separate because a page where a
  person deletes their own account has no business carrying an operations table
  in its bundle; size-limit gates the three entries independently.
- **nav/** — three `NavEntry` values: `account.privacy` (under the
  container-owned `account.root`), `admin.privacy` (under `admin.root`), and
  `public.privacy-request` (top level, `surface: "public"`, not in the menu).
  The ids name the MENU rather than the module: nobody looks for "delete my
  account" under a regulation's initials.
- **i18n/** — `GDPR_I18N_KEYS` + the inline en bundle and the opt-in
  the opt-in `./i18n/ru` and `./i18n/es` subpaths; the generated backend error bundle is merged in so every
  `error.*` code has a fallback. Unlike most pairs, NOTHING is authored here to
  fill an upstream gap: stapel-gdpr ships `translations/errors.{ru,es}.json`
  covering all 15 keys it owns, so the generated ru bundle is complete over the
  registry. The four hand-written error strings are deliberate OVERRIDES of a
  correct-but-terse text, not a substitute for a missing one.
- **analytics/** — `generated/events.json`, the typed-event registry projected
  from `defineEvent` call sites + flow funnels (`pnpm gen:events`). Empty here:
  the pair defines no events of its own, and every control carries
  `data-analytics="none"` with a reason, because a host wraps these screens
  with its own `tracked()`.
- **demo/** — first-class demos (`defineDemo`, `@stapel/showcase`):
  `_harness.tsx` wires a mock runtime + i18n + query client; `Gdpr.demo.tsx`
  covers `GdprProvider` and shows the closure read in its three reachable
  states (the folded 404, a grace with its date, and an erasure that can no
  longer be recalled). Demos never ship.

## Extension seams (frontend-standard §7)

- Client is injected via `<GdprProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- The raw-bytes download takes the runtime's `fetch`/`credentials`/
  `defaultHeaders`, so a host's transport choices reach it too.
- `<DataExportPanel onArchive>` replaces the default browser save;
  `<PendingDeletions labelFor>` resolves a subject id to a human name — the
  module holds neither, by design.
- The headless layer is fully replaceable (copy-and-own).

## Open, and written down rather than papered over

1. Both nav entries hang off container-owned parents (`account.root`,
   `admin.root`) that no package here declares. `resolveNav` drops an orphaned
   submenu entry instead of throwing, so a host without an admin area gets a
   smaller menu, not a broken build.
2. The nav `surface` axis has two values (`public` | `member`) and cannot say
   "staff". `admin.privacy` is declared `member` and the SCREEN explains the
   `error.403.forbidden` it gets from `GET /dsar` and `GET /owners/health` —
   a hidden control would teach nobody that they are signed in with the wrong
   account.
3. The pair ships `./i18n/ru` only. The module's `translations/errors.es.json`
   is complete, so a Spanish bundle is one `ERRORS_LOCALES` value plus one
   authored UI bundle away — recorded here rather than half-done.
4. `manifest.json` lists all 15 browser-reachable paths; the sixteenth
   (`POST /internal/export/{id}/part-ready`) is a service endpoint and has no
   typed operation.
5. The download token never appears in a read. If stapel-gdpr ever returns one
   from `GET /user/data-export/status`, `<DataExportPanel>`'s `token` prop
   becomes optional rather than the panel gaining an input box for it.
6. `useDsarQueue` compares `ack_due_at` / `resolve_due_at` against the READER's
   clock to flag an overdue row. That is a comparison, not a derivation — the
   deadlines themselves are the server's — and it is the one place a browser
   clock affects what is drawn.
7. Every `<Alert>` here passes `message`, which antd 6 deprecates in favour of
   `title` and logs a warning about in tests. It stays: the peer range is
   `antd >=5.20 <7`, and `title` does not exist in antd 5 — switching would
   break the older half of the supported range to silence a log line. Fleet-wide
   (video-react logs the same); the fix belongs to whichever release drops
   antd 5 from the peer range, not to this pair.
