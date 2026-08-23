# @stapel/core

## 0.17.0

### Minor Changes

- bd7d3b0: `tPlural` / `useTPlural` — counted copy that is right in more than one language

  The i18n engine did `{param}` substitution and nothing else, so every counted
  sentence in the fleet was one string with one ending. On a live storefront that
  reads as "Примерно 1 объявлений" — the estimate line above the results, correct
  for 5–20 and wrong for every 1, 2, 3 and 4 a page actually shows. English hides
  the defect (two forms, and `{count} results` is wrong only at 1); Russian has
  four forms and shows it on the first page load.

  **One mechanism, and it is the one the lint already speaks.** A plural message
  is catalogued as one FLAT key per CLDR category —

  ```ts
  "search.results.count_exact.one":   "{count} объявление",
  "search.results.count_exact.few":   "{count} объявления",
  "search.results.count_exact.many":  "{count} объявлений",
  "search.results.count_exact.other": "{count} объявления",
  ```

  — and rendered by naming the FAMILY:

  ```tsx
  const tPlural = useTPlural();
  <span>{tPlural("search.results.count_exact", { count })}</span>;
  ```

  `stapel/i18n-key-exists` has had `pluralFunctionNames: ["tPlural"]` since it
  shipped: a `tPlural(…)` call's first argument is a family and the rule demands
  `<key>.other` in the generated registry, where a `t(…)` call demands the key
  verbatim. The runtime now spells it the same way, so a plural rendered through
  the wrong function is a lint error rather than a page that prints a raw key.
  The alternative — an object message `{one, few, many, other}` — was rejected on
  purpose: it widens `I18nDictionary` for every consumer and every generated
  catalogue, and the lint would still need teaching the shape, which is two
  halves that can drift.

  `pluralCategory(locale, count)` is exported for a skin that needs the category
  itself. It is `Intl.PluralRules`, never a hand-rolled `n === 1 ? … : …`, and an
  unusable locale tag degrades to English instead of throwing — a plural is copy,
  and copy must not be able to crash a render.

  **Nothing that exists moves.** `I18nDictionary` is still `Record<string,
string>`, `getBundle` is unchanged, and `tPlural` falls back `<key>.<category>`
  → `<key>.other` → `<key>` → the key, so a host bundle written before this
  release still renders its single flat string instead of a raw key. Bundles gain
  plural forms when they are ready to, one family at a time.

## 0.16.0

### Minor Changes

- 301804d: Two host seams a skin needs and a library must not choose: `LinkComponent` and `SignInCta`

  Wave D mounted nine pairs in one container and both absences showed up as
  defects the same afternoon.

  **`LinkComponent`** — `categories-react`'s breadcrumbs, tree and carousel
  rendered plain `<a href>`, so every click on category chrome threw the SPA
  away and rebuilt it; `listings-react`'s card rendered `href` AND called
  `onOpen`, which navigated twice for one click. A pair cannot import a router
  (there are several, and a library that picks one picks it for every host), so
  the host hands the anchor in:

  ```tsx
  const RouterLink: LinkComponent = ({ href, children, ...rest }) => (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
  ```

  The props are a plain `href`, `children`, `className`/`style`/`onClick`,
  `aria-label` and a `data-*` index signature — the last is what keeps a pair's
  own test hooks reaching the DOM through the host's component.

  **`SignInCta`** — `actionBlocked` ended the grey-rectangle incident by making
  every switched-off control state its reason, but "sign in to add this to
  favourites" is a reason whose next action is a LINK, and no pair took one.
  Three pairs each rendered the sentence and stopped, leaving the visitor to
  find the header themselves. `SignInCta` is `{ href }` **or** `{ onSignIn }` —
  never both, which is the same two-navigations-for-one-click defect wearing a
  different hat — and `SignInCtaProp` is the mixin so the prop is spelled the
  same in every pair that has a door.

  Both are TYPES: no runtime, no router, no antd, no change to the bundle. The
  copy is deliberately NOT here — each pair ships the link's label in its own
  bundle, because core floors `en` and `ru` while those pairs also ship `es`.

  Consumers' peer floors on `@stapel/core` are unchanged in this wave: the
  symbols are unreleased, so `check:peer-floors` has nothing to measure against
  yet (it refuses to guess, by design). The floors move to `>=0.16.0` in the
  wave AFTER this one tags.

## 0.15.0

### Minor Changes

- 6356af8: `StapelClient` query parameters accept an ARRAY, and repeat the key instead of
  collapsing it.

  `{ "f.brand": ["bosch", "makita"] }` now becomes `?f.brand=bosch&f.brand=makita`,
  in the given order. Repetition is a contract some backends actually specify —
  stapel-search reads a repeated `f.<slug>` as OR within a slug and different
  slugs as AND (`stapel-search/query.py`) — and the builder used `set`, so the
  second value silently replaced the first. The only alternative for a pair that
  needs it was to hand-build its URL: a second query encoder next to this one,
  outside its escaping and outside `stapel/no-string-paths`.

  An empty array contributes nothing, exactly like `undefined`: "no filter" and "a
  filter with no values" must not produce different URLs. Single values keep their
  existing `set` behaviour, so nothing already shipped moves.

- f73dfab: The mandate axis becomes a seam, plus the two bones every upload shares

  `MandateSource` / `MandateProvider` / `useMandate` / `useMandatePrincipal`
  split READING the mandate axis from DERIVING it. Until now the only
  derivation lived in `@stapel/workspaces-react`, so a surface that merely
  wanted to know "does this person hold a mandate?" had to import the
  multi-tenant machinery — impossible for a public storefront, which has no
  workspace list to ask. Core takes the provider of the axis and never learns
  what a workspace is. Outside a provider, `useMandate()` answers
  `unresolved / unavailable` naming the missing wiring: not a throw that blanks
  the subtree, and not a principal invented out of a wiring bug. The provider
  compares the answer before republishing, so a source that rebuilds its state
  every render (every query-backed one does) cannot re-fire the effects that
  watch the axis.

  Two upload primitives join core, both endpoint-free — the shared bones under
  three DIFFERENT upload contracts (cdn multipart, docs presign+finalize,
  recordings session+PUT+finalize), which stay in their own pairs:

  - `putToForeignOrigin(url, blob, opts)` — the bare PUT at an object store,
    with none of the transport's auth binding, folding a non-2xx into
    `StapelApiError{code: "stapel.http.<n>"}` instead of handing back a
    `Response` that every caller re-wraps differently.
  - `useObjectUrlPreview(file)` — a local preview whose `revokeObjectURL` is
    structural: replace, clear and unmount all balance by construction.

## 0.14.0

### Minor Changes

- e25e9a6: The mandate axis, and a nav contract that can express it.

  stapel-core 0.27 made the backend's principal three-valued — anonymous, a
  registered **guest** holding no mandate anywhere, and a member — plus an
  explicit _undetermined_ outcome for when the answer cannot be obtained. The
  frontend had one bit. A guest satisfied "authenticated", was handed every
  installed module's nav entry, mounted every screen, and collected a 403 per
  click: controls that lead to a refusal, at library level.

  `mandate.ts` carries the vocabulary. `MandateState` is `anonymous | guest |
member | unresolved`, and the fourth value is deliberately NOT a principal:
  **"we could not ask" must never render as "you may not".** The type enforces
  that three ways rather than asking politely — `unresolved` carries no
  principal to read, it carries a REASON (`asking` = a wait, `unavailable` = an
  error with something to say), and `matchMandate` takes five REQUIRED arms, so
  letting a wait fall into a refusal's branch does not compile. It is the same
  mechanism `matchList` uses, for the same reason.

  `NavEntry` gains `surface: "public" | "member"`. `requiresAuth` stays and
  still means what it meant — it is the alias half (`true` → member), so every
  manifest written before the axis keeps its meaning — but it could only ever
  say "needs a session", and a session is not a mandate. `surface` says the
  part it could not: a meeting joined by link is public to an authenticated
  person. `navEntrySurface()` is the one place the derivation lives;
  `navSurfaceVisibleTo()` is the whole rule, and it takes a
  `MandatePrincipal` — `"unresolved"` is not assignable, so a caller whose
  mandate has not settled cannot get a verdict out of it at all.

  `useActiveSessionStatus()` exposes the status the session store already
  held. `useActiveSessionReady()` answers "may a query fire", which is one bit
  and rightly so; the axis needs the distinctions underneath it, and deriving
  them from a boolean is impossible.

## 0.13.0

### Minor Changes

- 400f9e6: The absence of a result is no longer spelled the same way as a result.

  `LoadState<T>` puts the data BEHIND a discriminant (`loading` | `ready` with
  `data` | `failed` with `error`), `loadStateFromQuery(query)` adapts a TanStack
  result into it, and `matchList` renders one with FOUR required arms — loading,
  failed, empty, ready — so "there is nothing here" cannot share a branch with
  "we could not find out". `matchLoad`, `mapLoad`, `bothLoaded`, the three
  guards and the deliberately-unpleasant `loadedRowsOrEmpty` escape hatch ship
  alongside.

  `loadStateFromQuery` reads `query.status` and not `query.isLoading`, which is
  its own bug fix: `isLoading` is `isPending && isFetching`, so it is FALSE for
  a query that has not been enabled yet, and every session-ready-gated list hook
  in this fleet therefore reported "not loading, no error, zero rows" for the
  whole session bootstrap.

  `ActionAvailability` closes the other half: a control that is switched off
  states its reason. `actionBlocked(code)`, `actionBlockedByFailure(error)`,
  `requireLoaded(state, …)`, `firstBlock(…)` and the `useActionGate` hook, which
  returns `{disabled, reason, detail}` — flat strings a skin renders as TEXT
  beside the control, because a disabled button receives no pointer events and a
  tooltip on one is a reason nobody can read. There is no way to spell "blocked,
  reason unknown": the union has no such member. Core's i18n floor gains
  `stapel.action.blocked.loading` and `stapel.action.blocked.load_failed` in en
  and ru, worded to say that WE failed to load something — never that the thing
  is absent, and never blaming the person.

  `@stapel/eslint-plugin` gains `stapel/no-flattened-load-state`, on at `error`
  in the recommended preset: `query.data ?? []`, `x.data?.y ?? []`, `data || {}`
  and friends are the line that manufactures the lie, and it is now a lint error
  everywhere outside the api/transport layer.

  Why: on 2026-08-09 a backend route was mounted one path segment too deep, the
  workspace-list endpoint answered 404 to every request, and the frontend
  rendered "you have no workspaces" and greyed out the upload button with no
  explanation — for hours, with the failure visible in the network tab the whole
  time. The distinction was available (the bag carried `isError` beside the
  array) and every skin flattened it anyway, because the array was reachable
  without mentioning the error. So this ships as a type and a lint rule rather
  than a convention.

## 0.12.0

### Minor Changes

- c5c0a11: Error copy: the human sentence no longer carries the HTTP status; the status
  moves to a separate technical detail.

  Core's floor copy for the codes core mints itself used to splice the status
  into the sentence — every 5xx entry ended in a bare `" (500)"`. That reads as
  a diagnostic, not as product copy, and the owner rejected it on sight
  (2026-08-09). Deleting the number was not an option either: no Stapel backend
  emits a request id, so the status is the ONLY correlation handle a person can
  quote to support.

  So it moved out of the sentence and into a second field:

  - `describeFlowError(error, bundle, opts)` returns
    `{message, detail}` — `message` is the complete human sentence, `detail` is
    the plainly-technical `"HTTP 500"` a skin renders in muted, small type
    beside it. `detail` is `undefined` when there is nothing worth quoting: no
    status, a transport fault that never reached a backend (`status: 0`), or a
    specific backend code whose sentence already says what happened.
  - `useErrorDisplay(fallbackCode?)` and `useDescribeFlowError()` are the hook
    forms, for `unknown` and `FlowError` inputs respectively.
  - `formatFlowError` / `useErrorText` / `useFormatFlowError` are unchanged and
    still return the sentence alone — a skin that renders only the message keeps
    correct, complete copy. The detail is additive, never load-bearing.
  - The detail template is the bundle key `stapel.error.detail`
    (`DETAIL_ERROR_KEY`, `"HTTP {status}"` in en and ru), so a host can override
    it like any other string — and it is where a request id goes when a backend
    starts emitting one.

## 0.11.0

### Minor Changes

- 3ac8297: fix: the error surface a 500 puts on screen — readable, and in the user's language

  Two defects an owner hit behind a backend 500 on a live sandbox, both fixed at
  their root rather than at the one alert that showed them.

  **The alert was unreadable on a dark deployment.** `@stapel/tokens-antd`'s
  `readLiveCssVar` served the host's LIVE `--stapel-*` custom properties for
  whatever mode the caller asked for — but those properties resolve through the
  document's active `data-theme`, so they are the DOCUMENT's mode, not the
  caller's. A default skin defaulting `mode` to `"light"` inside
  `<html data-theme="dark">` therefore got antd's LIGHT algorithm (deriving
  `--ant-color-error-bg: #fff2f0`, near-white) welded to a LIVE DARK
  `--ant-color-text: #f4f5f7` — measured 1.00:1 contrast.

  - `resolveThemeMode()` (new export) reads the same `data-theme` attribute
    `@stapel/tokens`' `tokens.css` keys its dark block on. `mode` is now optional
    on `toAntdTheme`/`toAntdThemeConfig` and defaults to it.
  - `readLiveCssVar` serves a live value only when the document is in the mode
    being asked for; otherwise the compiled-in default for the REQUESTED mode.
    The bridge can no longer emit a blended theme.
  - Every `@stapel/profiles-react` default skin defaults `mode` to
    `resolveThemeMode()` instead of `"light"`, so it self-themes with no host
    wiring. Pass `mode` explicitly to pin a side.

  **The alert showed `Request failed with status 500`.** That is
  `parseErrorEnvelope`'s own diagnostic for a response with no error envelope (a
  Django 500 under `DEBUG=False` returns HTML) — the HTTP client's internals, in
  English, on a Russian UI. The one-dialect machinery existed but had no rung a
  query/mutation-driven skin could reach, and no catalogue behind the codes core
  itself mints.

  - `@stapel/core` now ships an error FLOOR (`stapel.http.*`,
    `stapel.transport.failed`, `stapel.error.unknown`) in en and ru, seeded by
    `createI18n` under every locale before any caller bundle — a host wires
    nothing, and any pair or host bundle registered later still wins the key.
  - `useErrorText()` (new export) folds ANY thrown value into that dialect in one
    call, which is what a skin holding `error: unknown` needed.
  - `formatFlowError` exposes the error's HTTP `{status}` to templates and widens
    core's OWN `stapel.http.<status>` codes to a class-wide `stapel.http.5xx`
    entry. Real backend codes are never widened — two different 404s stay two
    different states.
  - Default skins across profiles-react, auth-react, notifications-react and
    workspaces-react now render `useErrorText(...)` instead of `error.message`.

## 0.10.0

### Minor Changes

- `@stapel/core` now self-describes: it ships a generated `manifest.json` and `llms.txt`, closing the gap where it was the only one of the 8 dependent pairs without a machine-readable description of its own surface. `scripts/gen-manifest.mjs` gained an explicit "no backend" mode (`MANIFEST_MODULE=""`) for packages, like core, that have no Django/DRF counterpart.

## 0.9.0

### Minor Changes

- 75f5d5f: **One error dialect.** A thrown value reaches a call site in one of two
  shapes: `StapelApiError` (what `createStapelClient` throws — has `.status`),
  or the RAW envelope `{localizable_error, error, params}` — the parsed response
  BODY, rethrown by any second transport (`if (error) throw error` over an
  openapi-fetch-style `{ data, error }` result), which has **no `.status` at
  all**. Call sites papered over the split with `(e as { status?: number
})?.status === 404` — a branch that can never be true on the second dialect,
  with the cast silencing the only check that would have caught it.

  Core now owns the discrimination, so no consumer has to invent it again:

  - `isStapelApiError(value)` — the typeguard;
  - `isErrorEnvelope(value)` — the raw dialect, recognised;
  - `errorCode(value)` / `errorStatus(value)` — read the code/status from
    EITHER dialect (`errorStatus` also recovers the status the code itself
    carries: `error.404.…`, `stapel.http.503`), `undefined` when genuinely
    unknowable;
  - `hasErrorCode(value, ...codes)` and `errorCodePredicate(...codes)` — the
    named-state predicate factory (`const isFeatureDisabled =
errorCodePredicate("error.404.feature_disabled")`), so two DIFFERENT 404s
    stay two different states, which `.status === 404` can never express;
  - `toStapelApiError(value, fallbackStatus?)` — the fold a second transport
    applies at its single rethrow point (`throw toStapelApiError(error,
response.status)`) so its call sites only ever see dialect 1;
  - `TRANSPORT_ERROR_CODE` — the honest code for "never reached the backend"
    (no invented HTTP status).

  **Behaviour change — network traffic.** The default query client's `retry`
  predicate now reads `errorStatus(error)` instead of `(error as {status?:
number}).status`. A 4xx that arrives as the raw envelope was previously
  invisible to the predicate and got retried twice; it is now recognised and
  **not retried**. Requests that were fired three times are fired once. Nothing
  that was retried before and _should_ be still is: 5xx and status-less faults
  (network, abort) keep the `failureCount < 2` budget. Minor, not patch — this
  changes what goes over the wire in consuming apps; a host that depended on the
  extra attempts must set its own `retry` on the `QueryClient` it passes in.

  Covered by a test that mocks the WIRE (a real 404 envelope through a real
  second-transport rethrow), not the module — see CONTRIBUTING.md
  "Mock the wire, not the module".

## 0.8.1

### Patch Changes

- 8c4f9c2: An unreachable backend no longer logs the user out.

  Owner-reported live incident (2026-07-26, app.ironmemo.com mid-redeploy):
  "сервак явно не отвечал, но фронт меня выкинул на sign-in page. Ну да, не
  получилось отрефрешиться или auth/me вызвать, но это же не повод сессию
  терминейтить, юзера не разлогинило, бэк прилёг."

  A refresh had two outcomes — success, or "session lost" — so every way of
  _not_ getting an answer (fetch threw, DNS/TLS failed, the request timed out,
  nginx answered 502/503/504 because the upstream was restarting, the service
  5xx'd on its own crash) was filed under the same verdict as a clean 401, tore
  the session down, ran the logout hooks, purged user-scoped storage and fired
  the host's redirect-to-login policy. On a signed-in user whose credential was
  perfectly valid.

  Only the auth service can retire a credential, and only by answering. So
  there is now a third outcome, `REFRESH_UNAVAILABLE`: no verdict was obtained,
  the session is left exactly as it was, `refresh()` still resolves `false` (the
  caller's request genuinely got no token and should surface its own error), and
  `session:refresh-unavailable` is emitted for hosts that want an "offline /
  reconnecting" affordance. The next attempt, once the backend is back, simply
  succeeds. A `doRefresh` that _throws_ is treated the same way — an exception is
  not evidence a credential is dead, and the old behavior turned any bug in the
  refresh path into a forced logout.

  `@stapel/auth-react` classifies: 401/403 (and other 4xx that are genuine
  rejections) are verdicts; transport failures, 5xx, 408 and 429 are not. 429
  especially — being rate-limited is a "come back later", and logging the user
  out over it is exactly backwards. The same rule now governs the token-adoption
  path: a `me()` that never reached the server keeps the tokens instead of
  discarding them. A COLD start against a dead backend still settles (quietly,
  no banner) so nothing gated on `whenReady()` hangs.

## 0.8.0

### Minor Changes

- cff85d2: New `createMeCachePersister` (`query.ts`) — a selective, localStorage-backed persister for "/me-class" queries only (current user, current profile, …), distinct from `createStapelQueryClient`'s existing per-user namespace persistence: on a cold load the user id isn't known yet, so per-user namespacing can't help render a last-known `/me` before the network responds.

  - Persists ONLY the caller-named query keys (matched by prefix, e.g. `authQueryKeys.me()`, `profilesQueryKeys.me()`) to one fixed `localStorage` entry — `dehydrate`d selectively via `shouldDehydrateQuery`, not the whole query cache.
  - Hydrates SYNCHRONOUSLY at construction time, before the caller's first render, so `useQuery` calls for those keys already see cached data on mount (true cache-first paint, not an async fill-in a tick later).
  - Wiped on logout through the SAME registry `createRepository(namespace, { scope: "user" })` uses (`__registerWipeWhenActive`, `session.ts`) — no bespoke clear call, no separate contract to keep in sync. Fires on both explicit `logout()` and involuntary `sessionLost()`.
  - SSR-safe: every `localStorage` touch is guarded, so this is a no-op on the server.
  - Lives in `query.ts`, already the sanctioned `no-raw-storage` home alongside `storage.ts`/`repository.ts`.

  `<StapelProvider>` gained an optional `meCacheQueryKeys` prop that wires this in for the host with one line — e.g. `<StapelProvider meCacheQueryKeys={[authQueryKeys.me(), profilesQueryKeys.me()]} .../>`. Hydration runs inside the same synchronous `useState` lazy initializer that builds the `QueryClient`, before the provider's children ever mount. Omitting the prop skips /me cache-first persistence entirely (default: off) — fully backward compatible.

## 0.7.0

### Minor Changes

- fdaf339: Add the shared navigation-manifest contract types (`NavEntry`, `NavRoute`, `NavComponentRef`, `NavPlacement`, `NavPlacementLevel`, `PackageNavManifest`), exported from the package root. Ф1 lib-side foundation for the scripted-fullstack navigation contract (owner directive: one scripted command with no LLM produces a working navigated fullstack): a pair declares its screens' nav entries in `src/nav/manifest.ts` against these types, `scripts/gen-nav-manifest.mjs` validates and emits `nav-manifest.json`, and `@stapel/shell-react`'s `resolveNav` (new package, separate changeset) turns installed manifests + a project's overrides into the tree a shell renders. Pure data types — no React, no I/O — so the same contract works at scaffold codegen time and at runtime.

## 0.6.2

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.6.1

### Patch Changes

- c20f56f: Fixes a live-incident race (owner-diagnosed finisher, миттудей): `AuthSession.logout()` used to await the server-side revoke call BEFORE any local teardown. In the window between the server honoring that revoke and this session getting back around to tearing itself down, a parallel authenticated request (e.g. a Navbar still holding a stale `useWorkspaces` query) would 401, retry its own refresh against the now-revoked token, fail, and race a `sessionLost('expired'/'revoked')` teardown in ahead of the explicit logout — rendering a "session expired" banner on a logout the user asked for themselves.

  Two changes, combined:

  - `@stapel/core`'s `SessionManager.logout()` now holds a `loggingOut` guard for its full duration (set synchronously before its first `await`). `sessionLost()` is a no-op while that guard is up — in addition to its existing idempotent no-op once already `"unauthenticated"` — and now reports which case applies via its return value (`Promise<boolean>`: `true` only if it actually performed a teardown).
  - `@stapel/auth-react`'s `AuthSession.logout()` now runs the local teardown (`sessionManager.logout()` + `onTeardown('logout')`) FIRST — instant, no network dependency — and treats the server revoke as best-effort afterward. `settleRefreshFailure` only calls `onTeardown(reason)` when `sessionLost()` reports it actually tore the session down, so a racing refresh failure during an in-flight logout never fires a contradictory `onTeardown('expired'|'revoked')`.

## 0.6.0

### Minor Changes

- 6ef6c44: Session-lifecycle fix for a live incident (2026-07-17): a query hook with no
  manual `enabled` gate could race a session still bootstrapping — right after
  an external event set fresh auth state this JS runtime hadn't caught up to
  yet (e.g. a QR `session_share` scan setting httponly cookies via a plain
  redirect) — and read a live session as "expired".

  - **`SessionStatus` gains `"initializing"`** — a 4th, DISTINCT state from
    `"unauthenticated"`. `"unauthenticated"` means "checked, no session";
    `"initializing"` means "haven't checked yet". `createSessionManager` is now
    born `"initializing"` by default (previously `"unauthenticated"`, which
    collapsed the two).
  - **`SessionManager.isReady()` / `.whenReady()`** — the framework-level
    ready-gate: `false`/pending while `"initializing"`, resolves the instant the
    session settles into any of the other three states.
  - **`SessionManager.markUnauthenticated()`** — settle `"initializing"` into a
    confirmed "never had a session" with NO teardown side effects (no logout
    hooks, no `onSessionLost`) — distinct from `sessionLost()`, which assumes an
    existing session is ending.
  - **`useSessionReady(manager)` / `useActiveSessionReady()`** (new hooks) — a
    pair's query hook gates on `useActiveSessionReady()` (reads
    `getActiveSessionManager()`, zero prop plumbing) instead of hand-rolling an
    `enabled` check; `true` (never blocks) when no module has created a session
    manager at all.
  - **`createStapelClient`'s `onAuthRefresh` retry fix**: resolving `""` (empty
    string — a successful refresh with no bearer token to attach, i.e. cookie
    mode) used to be indistinguishable from `null` (refresh FAILED) because the
    retry condition checked `refreshed.length > 0` instead of `refreshed !=
null`. Every cookie-mode 401 retry threw the original error instead of ever
    re-issuing the request against the now-refreshed cookie jar. Fixed; see the
    `onAuthRefresh` doc comment for the full three-outcome contract.

  `@stapel/auth-react`'s `createAuthSession`/`createAuthRuntime` are the first
  consumer (see that package's own changeset) — a bootstrap probe on
  `restore()` plus the corrected retry contract together close the incident.

## 0.5.0

### Minor Changes

- 569d7b2: Add `formatFlowError`/`useFormatFlowError` — the renderer `toFlowError`'s own doc promised ("the frontend renders `t(code, params)`") but never actually supplied: hosts were left writing `bundle[code] ?? code`, so a bundle miss surfaced a raw, unformatted code to the user. Chain: bundle template (interpolated via the existing `interpolate()`) → the backend's own `message`, but ONLY when its `language` matches the host's current locale → the raw `code` as the last resort. `FlowError`/`StapelApiError` grow optional `message`/`language` fields to carry this (additive); `StapelErrorEnvelope` grows an optional `language` for backends that send one. `I18nEngine` grows `getBundle(locale?)` so `useFormatFlowError` can read the merged dictionary `t()` already resolves against.

## 0.4.0

### Minor Changes

- e4a29b7: Analytics restratification (slim wave §21/S1). Core keeps the analytics **type
  seam + context plumbing** — the `Analytics`/`AnalyticsProvider`/`AnalyticsEvent`
  types, the `defineEvent` type layer (`EventDef`, `EventDefInput`, `EventProps`,
  `AnyEventDef`, `PropSpec`, `PropsSchema`, `PropType`, `ResolveProps`),
  `AnalyticsContext` + `useAnalytics`, and `trackFlowStep` (flow-machine
  auto-instrumentation) — while the facade **implementation** moves to the new
  `@stapel/analytics` package.

  - **Removed exports** (now in `@stapel/analytics`): `createAnalytics`,
    `consoleProvider`, `stapelCollectorProvider`, `StapelCollectorOptions`,
    `defineEvent`, `prop`, `createTracked`, `TrackedApi`, `useTracked`.
  - **New exports**: the persistence adapters `defaultPersistStorage`,
    `idbStorage`, `localStorageAdapter`, `memoryStorage` (shared by the query
    layer and `@stapel/analytics`' offline queue), and the `ResolveProps` type.

  Rationale: mandatory analytics is a stapel-studio policy — scaffolded apps
  always wire `@stapel/analytics`; OSS consumers may bring their own provider
  behind the core type seam (pairs thread it through context; the
  `stapel/no-direct-analytics-provider` rule still guards vendor SDK imports).

- b3ac272: §17 arch-contract-pipeline Wave 0 — retire `@stapel/core`'s generated schema
  surface and the monolith as a contract source.

  `@stapel/core` no longer exports the generated `paths` / `components` /
  `operations` types (and no longer ships `src/generated/schema.ts`). Under the
  per-module contract pipeline every `@stapel/<module>-react` pair already
  generates its OWN self-contained wire types from its backend's committed
  `docs/schema.json`; nothing consumed core's aggregate export (grep-confirmed),
  and stapel-core has no DRF endpoints of its own from which a meaningful core
  slice could be emitted — the shared `User` / `StapelError` / `TokenPairResponse`
  schemas only materialise via a module's endpoints. The hand-authored runtime
  error contract (`StapelApiError`, `StapelErrorEnvelope`) is unchanged and stays
  the public error surface.

  This removed core as the last reader of the monolith aggregate: `gen:api` now
  requires per-module `API_SCHEMA` + `API_OUT` (no monolith default), and the
  monolith checkout is dropped from CI. A minor bump because generated type
  exports are removed from the public API, even though no workspace consumer
  imported them.

- c3482e7: New `<StapelProvider>` (slim wave §21/S4) — the one-provider setup composing
  `StapelConfigProvider` + TanStack's `QueryClientProvider` (via
  `createStapelQueryClient`) + `I18nProvider` (via `createI18n`). Props:
  `baseUrl` or `client` (+ per-module `clients` overrides), `locale`,
  `cacheVersion`, `analytics?`, and the escape hatches `queryClient?`,
  `queryRuntime?`, `i18n?`. Ceremony target: install → `create<Mod>Runtime` per
  pair → ONE `<StapelProvider>` + per-pair `<ModProvider>`. The individual
  providers remain exported — composition, not deprecation.

  Also new: `createModuleRuntime` / `createModuleContext` (+ `ModuleRuntime`,
  `CreateModuleRuntimeOptions`, `ModuleContextKit` types) — the one reviewed
  copy of the runtime/context/provider plumbing the six standard pairs
  previously stamped per package (§21/S2).

- dc98063: Session substrate & user-data hygiene (frontend-core-architecture-v2 §43).

  - **`createSessionManager`** (§43.1) — the one owner of session lifecycle:
    three-state status (`authenticated | anonymous | unauthenticated`),
    **single-flight refresh** (N concurrent 401s share ONE `doRefresh()` call),
    typed events (`session:refreshed` / `session:lost` / `session:logout`), a
    host-injected `onSessionLost` policy (login redirect vs anonymous
    auto-login — resolved from the host's discovery config, never hardcoded),
    and the per-session WebCrypto key repositories encrypt with.
  - **Logout-hook registry** (§43.3) — `registerLogoutHook(fn)`, run on BOTH
    explicit `logout()` and involuntary session loss; one throwing hook never
    blocks the others.
  - **`createRepository(namespace, { storage, scope, encrypted })`** (§43.4) —
    the ONE sanctioned client-side store. `scope: "user"` auto-registers
    wipe-at-logout with NO opt-out and is encrypted by default (AES-GCM,
    per-session in-memory key; logout drops the key first, synchronously, so a
    crash mid-wipe still leaves ciphertext unreadable — §43.5). `scope: "app"`
    (theme, locale) survives logout and never uses the session key.
    Contract-tested: after `logout()` user-scoped data is physically absent
    from both stores and the key is dropped. Honest boundary (in the README,
    verbatim from the governing doc): frontend encryption does NOT defend
    against XSS with code execution — it defends data at rest.
  - **`createModuleRuntime`** now registers a logout hook on the active
    `SessionManager` — the pair's `onLogout` option, or a no-op default
    (§43.7: every standard pair mechanically has a cleanup call site).
  - `createStapelClient`'s 401 path is unchanged in behavior and now documented
    as the ONE legal home of 401 handling (§43.2): `onAuthRefresh` (wire it to
    `SessionManager.refresh()`) → retry once → still 401 → session lost.

### Patch Changes

- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0

## 0.3.0

### Minor Changes

- 6c33abc: `createStapelClient` accepts a `credentials?: RequestCredentials` option,
  passed through to every fetch (including 401-refresh and verification-403
  retries). Cookie-mode backends (HTTP-only JWT cookies) need `"include"` when
  the API lives on another origin — the fetch default (`"same-origin"`) silently
  drops cookies cross-origin, so bearer mode was previously the only mode that
  worked cross-origin.
- 4a024a8: Flow-machine primitive moved into `@stapel/core` (frontend-core-architecture §4b).

  `createFlowMachine`, `useFlow`, and the `FlowError` helpers (`toFlowError`,
  `isErrorCode`) now live in `@stapel/core` — the single reviewed implementation
  every `@stapel/<module>-react` pair builds on, instead of each pair copying the
  primitive and forking its staleness/re-entrancy fixes. The primitive's tests
  travel with it. `@stapel/core.toFlowError(error, fallbackCode?)` takes an
  optional module-scoped fallback (default `stapel.error.unknown`).

  `@stapel/auth-react` now imports the primitive from core and **re-exports** it
  (`createFlowMachine`, `useFlow`, `FlowMachine`, `FlowError`, …) for one minor so
  existing imports keep resolving; its `toFlowError` wrapper pins the
  `auth.error.unknown` fallback. No behavior change — the machine implementation
  is byte-for-byte the reviewed one.

- 0db568b: Typed analytics — `defineEvent` / `tracked` over the facade (frontend-guardrails §3, G3):

  - **`defineEvent` + `prop`** (`@stapel/core`). A typed event is a literal object:
    a namespaced `name`, a one-line `description`, and a `props` schema where every
    prop carries its OWN docstring (`prop.string`/`number`/`boolean`/`oneOf`). The
    facade's `track` gains a typed overload — `track(event, props)` checks props
    against the schema (required props enforced, unknown props rejected, `oneOf`
    narrowed to its literal union), while `track(name, props?)` stays for library
    auto-instrumentation. A tsc consumer fixture (`@ts-expect-error` proofs) locks
    the enforcement in.
  - **`tracked()` / `useTracked()`** (`@stapel/core`). `tracked(event, props, handler)`
    wraps a clickable so the click both emits the typed event and runs the original
    handler; `useTracked()` binds it to the facade from context (SSR-safe — no
    mutable module singleton). `trackedSubmit` is the `onSubmit` twin.
  - **Double-count exclusion by construction.** A click that STEPS a flow machine is
    already instrumented (`flow.<id>.<step>`), so it must be marked
    `data-analytics="flow"` and NOT wrapped in `tracked()`. G4 forbids the double
    wrap statically; the facade backs it in dev — while a `tracked()` handler runs,
    a `flow.*` emission on the same instance is flagged with a teaching warning (a
    flow transition fires `started` synchronously, before the first await, so a sync
    scope catches it).
  - **Runtime-configurable flow instrumentation.** `createFlowMachine({ instrument })`
    can silence a machine's auto-funnel while keeping the facade for hand-rolled
    events (default stays on when `analytics` is present).
  - **`events.json` (generated, drift-gated).** New `gen:events` driver projects a
    pair's event registry — `defined` (defineEvent call sites, AST-extracted) +
    `flows` (auto-instrumented funnels from flows.json) — into
    `src/analytics/generated/events.json`, the single source the analytics lint (G4)
    and report (G5) read. `gen:manifest` embeds it into `manifest.json` (`events`)
    and `llms.txt`. auth-react ships its funnel registry and a typed-events
    demonstration (no full annotation of the pair).

### Patch Changes

- Updated dependencies [a6c34e2]
- Updated dependencies [f23c7f3]
  - @stapel/tokens@0.2.0

## 0.2.0

### Minor Changes

- 5dfa61e: Analytics facade per analytics-standard §1–2: `createAnalytics` with fan-out
  to N providers, consent gate (pending buffers / granted flushes / denied
  drops; persisted), offline queue on the shared persist storage surviving
  instance recreation, batched delivery with per-provider tracking and
  exponential-backoff retries, PII guard (strip/warn/off) on props and traits,
  SHA-256-hashed `identify`, event-registry dev warning, built-in
  `consoleProvider` and `stapelCollectorProvider` (batch POST to
  `/analytics/api/events`, `sendBeacon` on page teardown), `trackFlowStep`
  helper (`flow.<flowId>.<stepId>`), `AnalyticsContext`/`useAnalytics`, and an
  optional backward-compatible `analytics` prop on `StapelConfigProvider`.
