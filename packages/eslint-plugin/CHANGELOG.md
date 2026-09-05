# @stapel/eslint-plugin

## 0.13.3

### Patch Changes

- 802440f: `stapel/no-raw-storage`: `**/core/src/session.{ts,js}` joins `STORAGE_ALLOWED`.

  The file was already the named exception for `no-adhoc-401` — it is where the
  single-flight refresh lives — and carried an inline `eslint-disable` for this
  rule on top. The reason is structural, not local: `SessionManager` is what
  `createRepository` is BUILT ON, so it cannot persist through it, and its one
  raw read is the cross-reload refresh-handoff marker (per-tab, readable
  synchronously at construction, deliberately not wiped at logout — the opposite
  kind of value from the one §43.4 guards). A structural exception belongs in
  the preset, where anyone reading it can see it, not in a paragraph at a line
  only the file's next reader will find.

## 0.13.2

### Patch Changes

- 9b489ef: `page-gutter` — the first scale role whose value changes with the viewport.

  How far a page's content sits from the edge of the window cannot be one
  number (24px on a 390px phone is a tenth of the screen spent on nothing) and
  must not be each component's own guess, which is what it was: a shell, a
  category page and a search page each picked a spacing step, and a page
  composed of the three had three different left edges down one window.

  The generator gains a `scales.responsive` section — roles authored as SPACING
  STEP names (so they stay on the scale a theme retunes in one place) with one
  value per breakpoint. It emits mobile-first: the narrowest value in the base
  `:root` block, then one `@media (min-width: …)` arm per wider breakpoint,
  outside the light/dark pair because a gutter is not a colour. `page-gutter`
  ships as phone `space-1` / tablet `space-2` / desktop `space-5`, reachable as
  `var(--stapel-page-gutter)`, `cssVar("page-gutter")` and the new `responsive`
  export.

  `@stapel/eslint-plugin`: `stapel/valid-token-name` reads the responsive roles
  off the token manifest instead of calling `cssVar("page-gutter")` an unknown
  colour role — a responsive role is the one scale namespace with no prefix on
  the wire, and the skip list stays data-driven rather than hardcoded.

- Updated dependencies [9b489ef]
  - @stapel/tokens@0.8.0

## 0.13.1

### Patch Changes

- Updated dependencies [3a1759b]
  - @stapel/tokens@0.7.0

## 0.13.0

### Minor Changes

- 97185d1: `no-hardcoded-theme-mode` now flags a literal `mode`/`themeMode`/`colorMode`
  JSX attribute in any source file, not only prop defaults inside default skins.

  The rule scanned two grids — `src/default/**`, and only the declaration shapes
  (`mode = "light"`, `?? "dark"`, `toAntdTheme("light")`, `resolveThemeMode()`) —
  and a storefront pinned `mode="light"` on its shell, in a host app, outside
  both. Both brands' token files carried a dark block, the shell followed
  `data-theme` correctly, and the deployment still had no way to reach dark. A
  skin that reads the document and a call site that overrides it with a literal
  render exactly the same wrong page, so the guardrail no longer stops at the
  library boundary.

  - New report `literalJsxMode`, on `<Shell mode="light"/>` and `mode={"dark"}`,
    in EVERY file. `themeMode` and `colorMode` are covered; antd's own
    `theme="dark"` deliberately is not — same word, vendor meaning, and a rule
    that flagged it would be switched off in every file that renders chrome.
    Tune the list with `jsxModeAttributes`.
  - Demos (`**/demo/**`, `*.demo.*`), stories and test paths are exempt: pinning
    both sides is what those files are for. The carve-out lives in the RULE, not
    only in the preset, so a consumer with its own config gets the same answer.
  - The declaration checks are unchanged, and still scoped to `src/default/**`.

## 0.12.1

### Patch Changes

- Updated dependencies [042a088]
  - @stapel/tokens@0.6.0

## 0.12.0

### Minor Changes

- db67604: `stapel/no-bare-dialog` fires where a team's dialogs are actually written.

  The rule returned an empty visitor for any file outside a package's
  `src/default/**` tree, so it was inert in exactly the repos that need it: a
  file at `src/__gatecheck.tsx` in a product repo, containing a bare antd
  `<Modal>`, linted clean. The §83 doctrine — on mobile every dialog is a bottom
  sheet, modals are tablet-and-up — was therefore enforced only where the
  libraries live and already comply, and never where a product team writes its
  own dialogs. The owner has reported the mobile experience twice; a green gate
  that cannot fire reads as coverage of a doctrine nobody was enforcing.

  - **New `scope` option.** `"all"` (the default) reads every file; `"default-skin"`
    is the pre-0.12.0 behaviour, `src/default/**` only, for a consumer that wants
    the wall on the skins and nothing outside them.
  - **Severity, not scope, is what keeps it adoptable.** `recommended` arms the
    rule fleet-wide at `warn` and keeps `src/default/**` at `error` — a worklist
    outside the skins, the same shape the doctrine tier shipped in, so upgrading
    the plugin hands a repo its list rather than a wall. `strict` makes the whole
    surface an error: that is what a product repo arms to make the doctrine a
    gate.
  - **The exemptions are stated now, not implied by a directory shape.**
    `allowNavigationDrawer` (a shell's menu drawer is navigation, not a dialog)
    is unchanged; test and fixture paths are carved out in the rule itself, so a
    consumer who never spreads the preset agrees with it; and
    `@stapel/tokens-antd/skin` — the substrate that BUILDS `SkinDialog` out of
    antd's `Modal` and `Drawer` — is carved out by path in both presets, the same
    way `no-raw-fetch` is carved out in the api layer.

  The rule also stops carrying its own copy of the default-skin path test and
  uses `lib/jsx.js`'s `isDefaultSkin`, like its seven sibling skin-tier rules.

## 0.11.0

### Minor Changes

- 350f61f: Doctrine tier: nine new rules, one extended, and a `strict` preset.

  The design rulings the fleet kept re-taking by hand are now stated mechanically.
  New rules: `no-tooltip-in-skin` (touch has no hover, and a disabled antd Button
  never fires the events a tooltip needs), `icon-button-needs-label` (its other
  half — removing the hover without adding a name leaves the control unnamed),
  `no-hardcoded-theme-mode` and `no-local-skin-theme` (CF-1: three `mode = "light"`
  defaults rendered light inputs under `data-theme="dark"`, and nine pairs carry a
  copy of the same `theme.tsx`, so the fix has to land nine times),
  `no-raw-dimensions` (**autofixable** — `padding: 16` → `spacing[4]`, import
  written too — the px twin of `no-raw-colors`), `i18n-locale-parity` (missing
  locale files and untranslated copies, anchored on each pair's `src/i18n/keys.ts`
  so it runs with zero per-pair wiring), `no-adhoc-socket` (one socket client for
  the fleet; the TS twin of core's RT001-RT003), `no-silent-slot` (an unfilled slot
  renders a hole, and a hole looks like a finished page), and `no-boolean-disabled`
  (a grey button with no reason — heuristic, with its limits documented in the
  rule header). `no-bare-dialog` gains the confirm surface (`Popconfirm` →
  `SkinConfirm`).

  Wiring: the tier ships at **`warn`** in `recommended` — a worklist, so `eslint .`
  stays green while the pairs migrate — and at **`error`** in the new
  `strict` preset, which a pair opts into once its migration has landed. `strict`
  is built by appending to `recommended`, so the two cannot disagree about a
  carve-out. Two lines marked `← WAVE-B SWITCH` in `index.js` flip the tier to
  `error` and enable the confirm surface when the wave is done.

- 95e8eec: New rule `stapel/no-bare-dialog`, on in `recommended`: inside a package's
  `src/default` tree, `Modal` and `Drawer` are not importable from antd.

  The dialog surface is a fleet rule now (`@stapel/tokens-antd/skin`'s
  `SkinDialog` — a bottom sheet on a phone, a modal above the tablet
  breakpoint), and this is what stops the twelfth dialog from being hand-rolled
  the old way. Deliberately narrow: a host app's dialogs are the host's
  business, a pair's headless layer renders no chrome, and a `Drawer` used as
  NAVIGATION is not a dialog — the shell's menus are named in the preset's
  `allowNavigationDrawer` option rather than disabled inline. A rule that fired
  everywhere would be switched off everywhere.

### Patch Changes

- 308e3d6: New autofixable rule `stapel/antd-alert-title`: antd 6 renamed `<Alert message>` to `<Alert title>`

  A prop a major version stops reading does not fail loudly — it renders an alert
  with no heading, on the one component whose entire job is to be read. Every site
  is a rename, so the rule ships autofixable and at `error` in `recommended`: it
  states no doctrine and has no migration to sequence, which is why it does not
  join the warn-level worklist tier.

  It fires only on an `Alert` imported from antd in the same file (named, aliased,
  or through a namespace import), so a local or design-system `Alert` that still
  takes `message` is untouched. An element that already passes `title` is reported
  WITHOUT a fix — renaming would pass the same prop twice and let source order
  pick the heading.

- 308e3d6: `no-raw-dimensions` autofix imports from the module the file is allowed to depend on

  Inside `src/default/**` the fix now writes `from "@stapel/tokens-antd"` (which
  re-exports `spacing`/`radii`/`fontSize`/`cssVar`/`breakpoints` for exactly this
  reason), so a pair's only design-system dependency stays the antd bridge it
  already declares. Outside a default skin the fix keeps writing
  `from "@stapel/tokens"` — there is no antd leg to route through.

  This closes a real hole rather than a stylistic one: the fix wrote a bare
  `@stapel/tokens` import into 274 sites across twenty pairs, and not one of those
  pairs DECLARES that package — it resolved only because the consumer's tree
  happened to hoist. A binding the file already imports from either module is not
  imported a second time (a duplicate declaration is a syntax error, produced by
  an autofix); an existing import of the target module is extended in place.

## 0.10.0

### Minor Changes

- 9d42cad: `stapel/i18n-key-exists` resolves the forms a real call site takes instead of
  skipping them.

  Every branch of a literal ternary is checked; a plural family via
  `tPlural("…")` is checked as `<key>.other` (`options.pluralFunctionNames`);
  a template key `` t(`a.b.${x}`) `` is checked by its static head, so a
  renamed or deleted family under that head is caught. A key built from a
  variable cannot be resolved and is ignored by default, because reporting it
  would be a guess; `options.dynamicKeys: "report"` surfaces those under their
  own `dynamicKey` message. `options.requireRegistry: true` makes the rule fail
  when no catalogue is configured — without it a mis-wired project got a silent
  no-op that read exactly like a passing gate. Defaults unchanged.

## 0.9.0

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

## 0.8.0

### Minor Changes

- `recommended`: `no-cyrillic-source` and `no-mixed-script-word` now run on test files

  0.7.0 switched both rules off for every test-file glob (`*.test.*`, `*.spec.*`,
  `test/`, `tests/`, `__tests__/`, `__mocks__/`, `fixtures/`, `*.fixture.*`) so
  that this plugin's own rule fixtures — which must contain Cyrillic and
  homoglyph words — would lint clean. The cost was a blanket exemption every
  consumer inherited on exactly the files where the English-only canon leaks
  hardest: one downstream sweep reported 5603 → 0 violations and still had 15
  live hits sitting in a single `.test.ts` the gate was skipping. The Python half
  of the same canon (`stapel-tools` R010/R011) deliberately runs ON test files
  for that reason — Russian identifiers were thickest there, and pytest prints
  those names. The two halves now agree.

  The plugin's own fixture problem is solved locally instead, in the two files
  that have it, with a scoped `eslint-disable … -- reason`. Nothing ships to
  consumers.

  **This can newly fail your lint.** Consumers' test files are now covered.
  Expect Cyrillic comments, JSDoc, and identifiers in tests to report; string
  literals remain exempt, so Russian i18n copy and fixture content still pass
  untouched. If the burn-down is large, baseline it (a file-scoped
  `eslint-disable` with a ticket in the reason) rather than reinstating a glob —
  a glob is how this was missed the first time.

## 0.7.0

### Minor Changes

- 4daca60: Two new rules, wired into `recommended`: **`stapel/no-cyrillic-source`** and
  **`stapel/no-mixed-script-word`** — the frontend half of the fleet-wide
  English-only source canon (owner ruling 2026-08-09; the Python-side check
  lives in stapel-tools). Source is English-only across the fleet:
  identifiers, comments, JSDoc, developer-facing log strings, commit messages.
  Russian UI copy inside translation catalogs is NOT affected.

  `no-cyrillic-source` flags Cyrillic in a comment, a JSDoc block, or an
  identifier (variable/function/class/type/property name). It deliberately
  never looks at plain string literals — i18n catalog values, fixtures, and
  sample content are the legitimate case — which is the whole design: because
  string literals are exempt, the rule needs no path allowlist, and a rule
  with no allowlist is one nobody learns to silence wholesale. Reports land on
  the line the Cyrillic actually sits on (never collapsed onto a block
  comment's or file-leading JSDoc's opening line), so a suppression directive
  placed before it has somewhere to attach.

  `no-mixed-script-word` is the literal-scanning counterpart: it DOES look
  inside string and template literals, because no legitimate text mixes
  scripts mid-word. It catches the homoglyph shape a plain Cyrillic-presence
  check misses — `miттudei` (Latin у vs Cyrillic и/т), `Q12а` (Latin Q,
  Cyrillic а) — while staying silent on pure-Cyrillic i18n text. It scans the
  _parsed_ value of string/template literals (so a `\n` escape can't glue onto
  a following Cyrillic run and misread as a mixed word), skips regex literals
  outright (`\b`, `[a-zА-Я]` are pattern syntax, not prose), and applies a
  4-character floor so an adjacent regex-range-boundary pair like `zА` stays
  silent while `dataдата` still fires.

  Both rules are off only in tests (their own fixtures deliberately contain
  Cyrillic/homoglyph words); everywhere else, including i18n catalog files,
  they stay on — the exemption is for the translated _copy_, not for comments,
  identifiers, or homoglyphs living alongside it.

## 0.6.0

### Minor Changes

- 75f5d5f: New rule **`stapel/no-raw-error-shape`**, wired into `recommended` (direct
  precedent: `no-raw-fetch` — "raw access is forbidden, go through the layer").

  Bans, outside the transport/error layer:

  - `as`-casting a caught value (`catch (e) { … e as StapelApiError … }`, and
    the same on a `.catch((e) => …)` parameter);
  - casting anything to a hand-written error shape (`{ status?: number }`,
    `{ localizable_error?: string }`, …) — this catches the defect even where
    the value is not catch-bound, e.g. a `retry(failureCount, error)` predicate;
  - reading `.status` / `.code` / `.localizable_error` off an un-narrowed
    caught value.

  Narrowing is accepted only through `instanceof StapelApiError` or an
  **imported** predicate (`isStapelApiError`, `hasErrorCode`, a named
  `errorCodePredicate(…)` export) — via `if`, `? :`, `&&`, or an early-exit
  `if (!guard) return/throw`.

  Why: a thrown value has two dialects — `StapelApiError` (has `.status`) and
  the raw `{localizable_error, error, params}` envelope (has none) — so
  `(e as { status?: number })?.status === 404` is dead code against the second
  one, and the cast is what hides it. In production this told users "the AI
  found nothing" about a meeting nobody had analysed.

  Scoped by path, deliberately: **off** in `**/api/**`, `*client.*`, `errors.*`,
  `error-layer/**` (somebody must touch the raw shape to fold it — that is the
  layer's job), off in Node-side `scripts/**`, `bin/**`, `*.config.*` (there
  `e.code` is an errno, not an envelope), and off in tests/fixtures. An unscoped
  version would just get blanket-disabled, and then it guards nothing. Tune with
  `options.properties` / `options.errorClasses`.

  Consumers on `recommended` may see new errors on existing code — that is the
  point; each one is a state discrimination that cannot fire in production.

## 0.5.1

### Patch Changes

- 8c4f9c2: `stapel/no-adhoc-401`: the carve-out now covers `auth-react`'s
  `model/session.ts` alongside core's `client.ts`/`session.ts`.

  That file is the authenticating module's `doRefresh` — the other half of the
  same seam, not a bypass of it. Somebody has to read the status code the
  refresh endpoint answered with and decide what it means (revoked vs expired
  vs "the backend simply isn't there") before handing `SessionManager` an
  outcome, and this is the one file that does it. Forcing the classification
  out of there would push it into call sites, which is exactly what this rule
  exists to prevent.

## 0.5.0

### Minor Changes

- a2071d2: §68 Ф3 — new `stapel/valid-token-name` rule, wired into `recommended`: a `cssVar("…")` call or a `var(--stapel-…)` CSS reference must name a colour-token role that exists in the live `@stapel/tokens` manifest catalog. Catches both failure modes the neutral-dictionary migration made possible — a renamed/removed legacy role (`accent`, `background-*-subtle`, `upperground-*`, the old L3 component tier, …) and a plain typo — neither of which fails loudly at runtime (an unresolved custom property just falls through silently). Suggests the nearest live role by edit distance when one is plausible. Scoped to colour roles only: the non-colour scale suffixes `cssVar()` also accepts (`font-*`, `radius-*`, `space-*`, `line-height-*`, `breakpoint-*`, `elevation-*`) are a separate, stable vocabulary and are never flagged. Off in test/fixture files, same as `no-raw-colors`.

  Also scrubbed the last old-convention token names (`bg-background-primary`, `text-text-primary`, `cssVar("color-…")` / `var(--stapel-color-…)`) out of `no-raw-colors`' and `no-raw-token-import`'s own lint-message copy, and out of the synthetic mock manifests in `test/helpers.js` / `test/demo-literal-meta.test.js` — cosmetic (mocks/messages only), no behavioural change.

### Patch Changes

- Updated dependencies [a86ced9]
  - @stapel/tokens@0.5.0

## 0.4.0

### Minor Changes

- a5b0666: New rule **`stapel/no-reserved-backend-route`** (owner directive: the SPA
  router must not claim a reserved backend sub-path): flags an SPA route
  (`<Route path="…">`, a `createBrowserRouter`/`createHashRouter`/
  `createMemoryRouter` array literal, or any RouteObject-shaped `{ path, element/
Component/children/index/errorElement/loader/action/lazy }`) whose path falls
  into a reserved backend sub-path — `/<mod>/api/…`, `/<mod>/swagger…`, or the
  project-wide `/admin`, `/staticfiles`, `/media` (§57 nginx canon). A bare
  module root (`/calendar`) is legitimate and never flagged — roots belong to
  the frontend, only sub-paths collide.

  Data-driven: reads the flat `reservedPathPrefixes` array from a project-root
  `reserved-paths.json` (the projection stapel-tools' generator emits), or
  `settings.stapel.reservedPathsFile`/`reservedPaths`. A missing catalog
  degrades the rule to a no-op — it never fails the lint run. In the
  `recommended` preset; off in tests/fixtures.

## 0.3.0

### Minor Changes

- 412a710: Two session-substrate guardrails (frontend-core-architecture-v2 §43), both in
  the `recommended` preset:

  - **`stapel/no-raw-storage`** (§43.4) — direct `localStorage` /
    `sessionStorage` / `indexedDB` access (bare, or via
    `window.`/`globalThis.`/`self.`) and `idb-keyval` imports are banned
    outside `@stapel/core`'s repository layer; persist through
    `createRepository()` (wipe-at-logout + encryption live there). Scope-aware:
    a local binding that merely shares the name is not flagged. Carve-outs:
    core's `storage.ts`/`repository.ts`/`query.ts`, tests. Extra banned
    backends via `options.modules` / `settings.stapel.storageModules`.
  - **`stapel/no-adhoc-401`** (§43.2) — comparing a status to the literal `401`
    (`===`/`!==`/`case 401:`) or wiring an axios-style `*.interceptors` chain
    outside core's client/SessionManager; 401 handling is single-flight refresh
    → retry once → session lost, in ONE place. Carve-outs: core's
    `client.ts`/`session.ts`, tests.

### Patch Changes

- e4a29b7: `no-direct-analytics-provider` follows the analytics restratification: the
  provider-adapter carve-out now also matches `@stapel/analytics`' own
  `src/providers.ts` (`**/analytics/src/providers.{ts,js}` in the recommended
  preset's fetch + provider overrides), and the rule's message points at the
  facade's new home (implementation `@stapel/analytics`, type seam
  `@stapel/core`).
- Updated dependencies [48188d9]
- Updated dependencies [2c22f06]
  - @stapel/tokens@0.4.0

## 0.2.0

### Minor Changes

- a164db2: Analytics guardrail rules (frontend-guardrails §3, task G4) — the enforcement
  tier over typed analytics (`defineEvent`/`tracked`, `events.json`). All four are
  data-driven or purely syntactic, and every message teaches the fix.

  - **`clickable-needs-event`** — an interactive JSX element (`onClick`/`onSubmit`/
    `onPointerDown`/…) must declare exactly one of three static outcomes: (a) the
    handler is wrapped — `onClick={tracked(event, props, handler)}` /
    `trackedSubmit(...)`; (b) it steps a flow machine — `data-analytics="flow"`
    (the auto-instrumented funnel emits `flow.<id>.<step>` itself); or (c) it opts
    out — `data-analytics="none"` with a **non-empty** `data-analytics-reason="…"`
    (the report lists it under "explicitly untracked"). Decorative/technical
    handlers whose body only calls `e.stopPropagation()`/`preventDefault()` are
    exempt by policy; custom components that merely forward `onClick` still need an
    outcome (mark them `none` reason `"passthrough"`).
  - **`no-double-count`** — a hard ban (user decision Q12а, overriding open
    question §7): `tracked()`/`trackedSubmit()` over a handler that also steps a
    flow machine double-counts the funnel. Fires when the wrapped handler calls a
    `run`/`step`/`submit*` method, or when the same element carries both
    `data-analytics="flow"` and a `tracked()` wrapper. Message: the flow step
    already emits the funnel — drop the wrapper or the marker, keep one channel.
  - **`event-literal-meta`** — `defineEvent()` must be a literal object (literal
    `name`/`description`, every prop via a `prop.*` builder) so the `gen:events`
    extractor can project it into `events.json`; a dynamic definition is invisible
    to the registry and reports.
  - **`known-event`** — `track()`/`tracked()` with an event name absent from the
    generated `events.json` → **warning** (drift; goes green after `pnpm
gen:events`). Reads the same `manifest.events` projection the report reads;
    resolves string literals and in-file `defineEvent` identifiers, and skips
    anything it can't statically read (no false positives).

  Severities in the `recommended` preset: `no-double-count` and
  `event-literal-meta` error, `clickable-needs-event` error (JSX), `known-event`
  warn; all four off in `test`/`fixtures` (where anti-patterns are trained on
  purpose). Adds an `events.json`/`manifest.events` loader to the data layer
  (dynamic + cached + `__resetCaches`), degrading to a no-op when the manifest is
  absent. 41 new RuleTester cases; the whole monorepo lints clean.

- 6743a59: New package: `@stapel/eslint-plugin` — the static-enforcement tier of the
  frontend guardrails (frontend-guardrails §2). Data-driven rules that read the
  same generated manifests the codegen writes (token catalog, i18n key registries),
  so lint and code never drift; every message teaches the one right way and points
  at the catalog.

  Rules (flat-config `recommended` preset):

  - **`no-raw-colors`** — hex/rgb/hsl/named colours in style objects and CSS
    templates, Tailwind arbitrary colour values (`bg-[#…]`), interpolated arbitrary
    values (`bg-[${x}]` — JIT-invisible), and bare raw-ramp references (`gray.500`).
  - **`no-raw-token-import`** — `@stapel/tokens/raw` outside theme-config/showcase
    (off there via preset overrides).
  - **`no-raw-fetch`** — `fetch`/`globalThis.fetch`/`new XMLHttpRequest()`/`axios`/
    `ky` outside the codegen api layer (off there via preset overrides).
  - **`i18n-key-exists`** — `t("…")` keys absent from the generated registry, scoped
    to managed namespaces so host-local keys never false-positive.
  - **`no-hardcoded-text`** — user-facing JSX text and `alt`/`title`/`placeholder`/
    `aria-*` literals.
  - **`require-disable-description`** — every `eslint-disable` must carry a
    `-- reason` (§2.4 escape-hatch policy).

  Also ships a self-contained **stylelint preset**
  (`@stapel/eslint-plugin/stylelint/preset`): colour properties only via
  `var(--stapel-*)`, no hex/rgb/hsl in CSS. Wired into the monorepo lint;
  auth-react, tokens, and core all pass.

- dc2a02c: `stapel/no-direct-analytics-provider` (frontend-guardrails §2.2, the last rule
  of the declared set that was still missing): importing an analytics vendor SDK
  (posthog-js, mixpanel, `@amplitude/*`, `@segment/*`, rudderstack, snowplow,
  GA, …) anywhere but the core facade's provider adapters
  (`analytics/providers.*`) is an error — a direct provider import bypasses the
  facade's consent gate, PII guard, and offline queue in one line. The vendor
  list is extendable per host (`options.providers` /
  `settings.stapel.providerModules`); the recommended preset carves out the one
  legal adapter home via file overrides, same shape as the `no-raw-fetch`
  api-layer carve-out.
- 864ae02: Two server-state guardrails (frontend-guardrails §2.2 / §2.6 — the last two
  written rules of the declared set), both data-driven and both with a one-legal-
  home carve-out in the recommended preset:

  - **`stapel/no-string-paths`** — API URLs are reached through NAMED operations
    of the codegen client, never a hand-written path string. Fires on two shapes:
    a `client.<verb>("/…")` call on an http verb (syntactic, holds without a
    catalog), and a bare literal/template that IS a catalogued operation path
    (data-driven — read from each package `manifest.json §operations` via the new
    `loadOperationCatalog`, degrading to a no-op when absent). A client-relative
    literal (`/me/`) resolves to its operation by trailing-segment suffix, so the
    message can name the op to call. Path strings in object-KEY position (route /
    mock-handler tables) are skipped — the bypass is argument position. The preset
    turns it OFF in the api layer (`api/`, `*client.ts`, `generated/`), mirroring
    the `no-raw-fetch` carve-out. Vendor list of verbs / operation paths overridable
    via `options` / `settings.stapel`.
  - **`stapel/query-keys-from-factory`** (core gap #8) — TanStack Query keys come
    only from the module key factory (`<module>QueryKeys`, e.g.
    `authQueryKeys.sessions()`). An inline `queryKey`/`mutationKey` array literal
    inside `useQuery`/`useMutation`/`queryClient.*` (options object or a
    positional `setQueryData` key) is an error: a hand-rolled array drifts from the
    invalidations that target the factory — the write lands, the cache goes stale.
    The preset turns it OFF in the factory file itself (`**/queryKeys.*`).

  RuleTester valid/invalid coverage for both; the monorepo run is clean.

- a6c34e2: Design-system showcase (frontend-guardrails §4, task G7): `defineDemo` + a
  generated viewer + the headless-coverage completeness gate.

  **New package `@stapel/showcase`** — the demo SOURCE format. `defineDemo({ id,
title, description, component, covers?, flow?, tokens?, decorator?, variants })`
  is a literal, statically-extractable registration (mirrors `defineEvent`), plus
  `renderDemoVariant`/`variantIds` for stories and smoke tests. Viewer-agnostic:
  one `defineDemo` feeds four projections that can't drift from the component.

  **Hybrid viewer** (user-approved deviation from the spec's self-rolled Vite
  shell): the format stays ours; the VIEWER is a commodity. `gen:demos` projects
  each demo into CSF, and a thin private **Ladle** app (`@stapel/showcase-viewer`,
  Vite) renders them — chosen over Storybook for a clean, light pnpm-monorepo fit.
  `pnpm showcase` serves the whole workspace; the theme toggle drives
  `data-theme`, so demos re-theme through the G1 tokens with no JS in the token
  layer. The viewer is introspection-only — not published, not in any prod bundle
  (§5).

  **`gen:demos` driver + drift gate + completeness gate.** From
  `demo/**/*.demo.tsx` it emits `demo/generated/demos.json` + CSF stories
  (byte-stable, `pnpm gen:demos:check`), and enforces §4.2: every headless
  component a pair exports must be covered by ≥1 demo, else CI is red. Demos embed
  into `manifest.demos` + `llms.txt` (canonical compiled/linted/rendered examples)
  via `gen:manifest`.

  **`@stapel/eslint-plugin`**: new rule `demo-literal-meta` (recommended preset) —
  keeps `defineDemo` meta literal so extraction stays possible, the analogue of
  `event-literal-meta`.

  **`@stapel/auth-react`**: 13 demos covering all 14 headless exports (OTP,
  passkey login/registration, QR are the rich pilots; the rest mount + show their
  bag state). Demos are first-class code — token-styled (`cssVar`), i18n labels,
  flow-instrumented clicks (`data-analytics="flow"`), typechecked, linted with the
  product ruleset, and smoke-rendered. The pair's completeness gate is green.

  **`@stapel/tokens`**: a `Token palette` auto-demo that enumerates the generated
  token surface (L1 ramps, L2 core live var-refs, L3 component, scales) — always
  reflects the catalog, never a hardcoded list.

### Patch Changes

- Updated dependencies [a6c34e2]
- Updated dependencies [f23c7f3]
  - @stapel/tokens@0.2.0
