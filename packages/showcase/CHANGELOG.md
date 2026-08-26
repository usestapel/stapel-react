# @stapel/showcase

## 0.2.1

### Patch Changes

- 407a6e3: Two new optional markers on `DemoVariant`, and the variant-distinctness guard.

  `viewport?: "phone" | "tablet" | "desktop"` says which width a variant was designed for, so
  the default-skin gate in `scripts/gen-demos.mjs` can require that every `/default` component
  has been drawn at least once at 390px instead of only on a desktop. `step?: string` names
  the flow step or bag state the variant is SEEDED at — the visual pass found stories whose
  named state is only reachable by a click, so the shot is `idle` under three different names
  (`auth.passwordless-login` `locked` == `default`, `cdn.single` `already-stored` ==
  `default`, all three `reviews` write-a-review variants). Both travel into `demos.json` and,
  when declared, into the generated CSF story as `Story.parameters.stapel`, so a shot runner
  can select the width and assert the state. A demo that declares neither generates exactly
  the artifacts it generated before.

  `assertVariantsRenderDistinctly(demo, render)` / `duplicateVariantGroups(demo, render)` are
  the guard itself: render every variant, group by identical markup, fail on a collision. It
  compares DOM rather than source because the closures that collide differ textually
  (`<D deduped={false}/>` vs `<D deduped/>`) — a static check passes them. The renderer is
  injected (`renderToStaticMarkup` in a pair's vitest, a real DOM in a shot runner), so the
  package stays viewer-agnostic and pulls in no react-dom.

## 0.2.0

### Minor Changes

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

- 2adea2b: Introspection gating convention (frontend-guardrails §5, task G8).

  Documents `STAPEL_INTROSPECTION` — the frontend mirror of the backend
  `get_dev_urls()` convention that gates whether the design-system showcase (and
  future report artifacts) are built and deployed for an environment: explicit
  `STAPEL_INTROSPECTION=1|0` wins, else it follows `DJANGO_ENV` (on for
  `local`/`dev`, off otherwise), else off (production-safe default).

  - **Deploy gate + build wrapper** (`scripts/introspection-gate.mjs`): `pnpm
showcase:build` now runs through the gate — on → Ladle (Vite) minified build +
    zero-dependency Brotli/gzip precompression of every text asset (Node built-in
    `zlib`) for `nginx brotli_static`/`gzip_static`; off → clean no-op (a CI
    showcase-build job stays green in a prod context). `pnpm introspection:gate` is
    the bare predicate for composing other steps.
  - **nginx recipe** (basic-auth on a `/__stapel__/` introspection prefix +
    `brotli_static`) and the full convention table live in
    `docs/deploy-introspection.md`; the showcase and viewer READMEs point to it.
  - **By-construction cleanliness proof**: `@stapel/auth-react` gains
    `test/prodBundlePurity.test.ts` asserting the showcase packages are never a
    runtime/peer dependency of a pair (devDependency only) and that `demo/` is
    excluded from the published tarball (`npm pack --dry-run` ground truth).
