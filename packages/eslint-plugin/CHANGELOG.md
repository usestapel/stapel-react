# @stapel/eslint-plugin

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
