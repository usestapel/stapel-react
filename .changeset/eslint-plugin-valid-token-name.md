---
"@stapel/eslint-plugin": minor
---

§68 Ф3 — new `stapel/valid-token-name` rule, wired into `recommended`: a `cssVar("…")` call or a `var(--stapel-…)` CSS reference must name a colour-token role that exists in the live `@stapel/tokens` manifest catalog. Catches both failure modes the neutral-dictionary migration made possible — a renamed/removed legacy role (`accent`, `background-*-subtle`, `upperground-*`, the old L3 component tier, …) and a plain typo — neither of which fails loudly at runtime (an unresolved custom property just falls through silently). Suggests the nearest live role by edit distance when one is plausible. Scoped to colour roles only: the non-colour scale suffixes `cssVar()` also accepts (`font-*`, `radius-*`, `space-*`, `line-height-*`, `breakpoint-*`, `elevation-*`) are a separate, stable vocabulary and are never flagged. Off in test/fixture files, same as `no-raw-colors`.

Also scrubbed the last old-convention token names (`bg-background-primary`, `text-text-primary`, `cssVar("color-…")` / `var(--stapel-color-…)`) out of `no-raw-colors`' and `no-raw-token-import`'s own lint-message copy, and out of the synthetic mock manifests in `test/helpers.js` / `test/demo-literal-meta.test.js` — cosmetic (mocks/messages only), no behavioural change.
