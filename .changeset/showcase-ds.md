---
"@stapel/showcase": minor
"@stapel/eslint-plugin": minor
"@stapel/auth-react": minor
"@stapel/tokens": minor
---

Design-system showcase (frontend-guardrails §4, task G7): `defineDemo` + a
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
