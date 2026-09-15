---
"@stapel/eslint-plugin": minor
---

`stapel/no-inert-typography-override`: a CSS rule that cannot win is a rule that did not ship.

Four times in one wave a pair's own static stylesheet set a typography declaration at (0,1,0) and it never applied — the class on the element, the rule in the sheet, and the computed style antd's:

```ts
// listings-react 0.36.0, as it shipped
`.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md)}`
```

antd generates a per-theme class for Typography (`.css-wgezi7`) carrying its own font ladder and injects it into `<head>` **at runtime**, after the package's static sheet, at the same (0,1,0). Equal specificity, so order decides, and antd's is second. On a heading it is worse: antd's `h1:where(.css-x).ant-typography` is (0,1,1) and wins outright at any load order. Measured on a live stand for the card price — class on the element, container 1062px, the `@container` rule in the sheet, computed size still antd's 16px — and again for 0.30.5's title clamp, where a host sheet's `display:block` on the same testids took 60 titles' `-webkit-line-clamp` out of effect.

`@container` and `@media` wrappers add **no** specificity, so the rule grades what is inside one exactly as if it were flat. The bar is (0,2,0) — two class-level components, which doubling the last compound buys — and a declaration carrying `!important` is never reported.

It grades **the selector shape that ships**, never how it is built. `.${clampClass(lines)}.${clampClass(lines)}` reads as (0,2,0) without resolving `clampClass`, which is the point: the per-package test this replaces asserted the literal template that builds a doubled selector, and broke on a refactor that parameterised the builder and changed no emitted byte.

ESLint and not stylelint because `find packages -name '*.css'` finds three generated token emissions and a Ladle theme — every pair's sheet is a string assembled in a `.ts` module, which is where the rule reads it (a hand-written CSS reader over template literals and `+` concatenations, resolving same-file `const` selectors).

The ladder is short on purpose — `font-*`, `line-height`, `letter-spacing`, `word-spacing`, `text-transform`, `text-overflow`, `-webkit-line-clamp`/`line-clamp`/`-webkit-box-orient`. `color` and `text-decoration` are out: a link wrapper's `color:inherit;text-decoration:none` at (0,1,0) is correct code, and listing them would have reported `cardTargetCss()` on the very commit that fixed it. Add them per-package with `properties`.

**`warn` in `recommended`, `error` in `strict`.** The fleet sweep over every `packages/*/src` (2026-09-16, only this rule armed) reports four hits in two packages, left for their owners: `listings-react`'s `detailGallery.ts` — **real**, the lightbox counter class is on an `<antd Typography.Text>` — plus `cardGallery.ts` and `condensedBar.ts` on plain spans, and `search-react`'s `LocationSummaryLine.tsx`, whose label sits inside an antd Button.

24 tests transcribe the four production sites and the code that fixed each; the rule header and [its docs page](https://github.com/usestapel/stapel-react/blob/main/packages/eslint-plugin/docs/rules/no-inert-typography-override.md) carry the ladder and the table of what it provably cannot see — starting with which element the class lands on.
