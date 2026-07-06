---
"@stapel/showcase": patch
---

Introspection gating convention (frontend-guardrails §5, task G8).

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
