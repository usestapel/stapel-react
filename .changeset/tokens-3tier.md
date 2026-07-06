---
"@stapel/tokens": minor
---

Retrofit `@stapel/tokens` to the frontend-guardrails three-tier contract (§1).

The source of truth is now **`theme.default.json`**, not TypeScript. A driver
(`pnpm gen:tokens`, drift-gated by `pnpm gen:tokens:check`, same family as
`gen:api`/`gen:flows`) resolves it into committed generated artifacts:
`src/generated/tokens.css`, a typed `src/generated/tokens.ts` (name unions +
typed `cssVar`), `src/generated/raw.ts` (the `@stapel/tokens/raw` subpath), and
`src/generated/tailwind.css` (a Tailwind v4 `@theme` bridge), plus the package's
`manifest.json`/`llms.txt`.

Three levels, with the invariants enforced by construction:

- **L1 raw ramps** carry hex and are **never emitted as CSS custom properties** —
  there is no `--stapel-raw-*` to reference (bypass closed by absence of API);
  hex is born only in ramps.
- **L2 core tokens** are each **exactly a `{light,dark}` pair** of `<ramp>.<step>`
  refs — an unpaired token, a hex, or a dangling step is a **build error** with a
  teaching message. Emitted as `:root` + `[data-theme="dark"]`.
- **L3 component tokens** are each **exactly one core-token ref**, emitted as a
  `var()` reference, so a theme-dependent component token is syntactically
  impossible (light/dark ends at L2).

Public API (`colors`, `cssVar`, the scales, `breakpoints` + helpers) is
preserved. Non-breaking for the only consumer (`@stapel/core` uses
`breakpoints`). Internal-only additions/removals: adds typed unions
(`CoreTokenName`, `ComponentTokenName`, `StapelVar`), `componentTokens`, and the
`./raw` / `./tailwind.css` / `./theme.default.json` subpaths; removes the
internal `generateTokensCss()` runtime helper (CSS is now a generated artifact).
