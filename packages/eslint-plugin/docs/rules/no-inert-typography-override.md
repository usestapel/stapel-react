# `stapel/no-inert-typography-override`

> A CSS rule that cannot win is a rule that did not ship.

- **Type:** problem
- **Recommended:** yes — `warn` in `configs.recommended`, `error` in `configs.strict`
- **Fixable:** no. Doubling the last compound is one of three right answers
  (double it, scope it under a parent class, or stop fighting antd and move the
  value onto the theme's own token), and the selector is assembled from
  expressions a text fixer would have to guess the shape of.

## The defect

A pair hoists a static stylesheet, puts its class on the element, and the
declaration never applies. Not "applies wrongly" — **never applies**. The rule
is in the sheet, the class is on the node, and the computed style is antd's.

Four instances in one wave, two sub-shapes.

### Losing on order

`@stapel/listings-react` 0.36.0, `cardTargetCss()` in `src/default/ListingCard.tsx`:

```ts
`.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md)}`   // (0,1,0)
```

antd generates a **per-theme class** for Typography — `.css-wgezi7`, the hash
is the theme — carrying Typography's own font-size, and injects it into
`<head>` **at runtime**, after the package's static sheet, also at (0,1,0).
Equal specificity, so order decides, and the sheet that arrives second is
antd's.

Measured on a live stand: the class **was** on the element, the card's
container **was** 1062px, the `@container` rule **was** in the sheet, and the
computed size was still antd's 16px. Fixed in 0.36.1 by doubling the class —
`.stapel-listing-card-price.stapel-listing-card-price`, (0,2,0).

The same shape again in 0.30.5's title clamp: an attribute selector
`[data-testid="listings-card-title"]` (0,1,0) in the pair's sheet against the
**host's** `storefront.css` setting `display:block` on the same testids and
loading second. 60 titles carried the class, `-webkit-line-clamp: 2` was in the
computed style, and the clamp did nothing — `line-clamp` is inert without
`display:-webkit-box`, and the host had replaced it.

### Losing on specificity

The storefront's category H1: `[data-testid="categories-category-title"]` is
(0,1,0) and antd's own `h1:where(.css-x).ant-typography` is **(0,1,1)**, so
antd wins outright, at every load order, forever. Fixed by doubling the
attribute selector.

### The ladder

| selector | score | against antd |
| --- | --- | --- |
| `h1` | (0,0,1) | loses to everything antd emits |
| `.price` / `[data-testid="x"]` | (0,1,0) | **ties** the generated class → order decides, and antd's is injected later |
| `.card h1` | (0,1,1) | **ties** the Title rule → the same coin flip |
| `.price.price` | (0,2,0) | wins both, whatever the load order |

So the bar is **at least two class-level components** — classes, attribute
selectors, pseudo-classes — or an id. `@container` and `@media` wrappers add
**no** specificity of their own, which is a large part of why this is easy to
get wrong: the rule *looks* more specific than it is, and the author reads the
sheet rather than the cascade.

## Why a lint rule, and not the per-package test

It was a per-package test, twice. That is the fourth lesson of this wave and
the reason this lives in the plugin.

The test asserted the **literal template that builds** a doubled selector. A
later refactor parameterised the builder —

```ts
function clampRule(lines: ClampLines): string {
  const self = `.${clampClass(lines)}.${clampClass(lines)}`;
  return `${self}{display:-webkit-box;…;-webkit-line-clamp:${String(lines)};…}`;
}
```

— changed **no emitted byte**, and the assertion broke anyway. Worse, the guard
only ever covered the one selector it named: the next person writes a NEW rule
in the same sheet and the test that "guards the sheet" says nothing about it.

This rule grades **the selector shape that ships** and never how it is
constructed. `.${clampClass(lines)}.${clampClass(lines)}` reads as two class
compounds — (0,2,0) — without knowing, or caring, what `clampClass` returns.
Rewrite the builder any way you like.

## Why ESLint and not stylelint

Stylelint is the obvious home for a specificity check, and it owns a rule for
exactly this shape (`selector-max-specificity`). **It has no file to open.**
`find packages -name '*.css'` in this repo finds three generated token
emissions (`tokens.css`, `tailwind.css`, `tailwind-v3.css` — where hex is born,
already carved out of the stylelint config) and a Ladle theme. Every pair's
sheet is a **string**: assembled in a `.ts` module out of template literals and
`+` concatenations, returned from a function, and handed to a React 19 hoisted
`<style href>`.

A CSS-in-JS custom syntax does not reach them either: these are not tagged
templates (`css\`…\``) that a stylelint processor can lift out, they are plain
string expressions whose selectors arrive as `${…}` holes from constants in the
same module. Reading them needs the JS scope, which is ESLint's half of the
toolchain.

ESLint over template literals is awkward and this rule says so in its own
source: it carries a hand-written CSS reader (~150 lines: strings, comments,
balanced braces, at-rule bodies, selector lists, declarations) because a
stylesheet has to be *parsed* before a selector can be graded, and the AST hands
over text, not CSS. The trade is deliberate: awkward, where the sheets are,
beats elegant and pointed at an empty directory.

## What the rule reports

A declaration from the **typography ladder**, in a rule whose selector scores
below (0,2,0) and carries no id.

### `inertTypographyOverride` — a class or attribute selector at (0,1,0)/(0,1,1)

```ts
// ✗
`.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md)}`
`@container (min-width:560px){.${CARD_TITLE_CLASS}{font-size:18px}}`   // the wrapper adds nothing
`[data-testid="listings-card-title"]{display:-webkit-box;-webkit-line-clamp:2}`
`.stapel-listing-card-main h2{font-weight:700}`                        // (0,1,1) ties the Title rule
`.${PRICE}:where(.is-row){line-height:1.4}`                            // :where() is zero by design
```

```ts
// ✓
`.${CARD_PRICE_CLASS}.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md)}`
`${TITLE}${TITLE}{font-size:var(--stapel-font-size-2xl)}`
`.stapel-listing-card-main .${CARD_PRICE_CLASS}{font-size:14px}`       // parent-scoped, also (0,2,0)
`.${CARD_TITLE_CLASS}:focus-visible{letter-spacing:0.01em}`            // a pseudo-class counts
`.${CARD_PRICE_CLASS}{font-size:14px !important}`                      // wins at any specificity
```

Every losing member of a selector **list** is reported separately: in
`.a.a,.b{…}` the doubled half is fine and the single half is not, and a reader
has to be told which. So is every **arm**: `cardTargetCss()` 0.36.0 carried the
same two classes flat and again inside the `@container` arm, and that file is
**four** findings, not one — each is its own edit, and collapsing them is how a
half-fix ships looking clean. (Run against the file as `967be421` shipped it,
the rule reports 356:6, 356:27, 360:8 and 360:29, and is silent on 0.36.1.)

### `inertTypographyElementSelector` — a bare type selector

```ts
// ✗
`h1{font-size:28px}`
```

Its own message, because doubling is not the fix: the element needs a class
first.

### The ladder, and what is deliberately not on it

`font`, `font-family`, `font-size`, `font-size-adjust`, `font-stretch`,
`font-style`, `font-variant`, `font-weight`, `font-feature-settings`,
`font-variation-settings`, `line-height`, `letter-spacing`, `word-spacing`,
`text-transform`, `text-overflow`, `-webkit-line-clamp`, `line-clamp`,
`-webkit-box-orient`.

**`color` and `text-decoration` are absent on purpose.** antd sets both, but the
fleet's overwhelmingly common (0,1,0) use of them is a link wrapper saying
`color:inherit;text-decoration:none` — correct code competing with nothing but
a browser's UA sheet, which is (0,0,1). Listing them would have reported
`cardTargetCss()`'s own target rule **on the commit that fixed the defect**, and
a rule whose flagship file is a false positive gets switched off. A pair that
does fight antd for a colour says so with `properties`.

**`display` is absent on its own** and present through the clamp. The 0.30.5
defect *was* `display:-webkit-box` being replaced, but no sheet writes that
without `-webkit-line-clamp` beside it, and `display` alone would drag in every
layout rule in the fleet.

## What it provably cannot catch

Written down because a rule whose limits are unwritten gets read as a proof. A
clean run of this rule is **not** evidence that a pair's stylesheet applies.

| Not caught | Why |
| --- | --- |
| **Which element the class lands on.** The rule cannot tell `<Typography.Text className={X}>` from `<span className={X}>`; only the first has an antd class to lose to. | The class name and the JSX are usually in different files, and the same class is legitimately used on both (`LISTINGS_GALLERY_COUNTER_CLASS` is on a `Typography.Text` in one file and a `<span>` in two others). The PROPERTY is the discriminator instead — which is why the ladder is short, and why the rule over-approximates on plain elements rather than under-approximating on antd ones. |
| **The other direction of the same blindness.** A (0,2,0) selector that still loses — the host wrote `!important`, or an id, or antd's rule for that element is `.ant-x .ant-y` (0,2,0) and arrives later. | (0,2,0) is the bar against what antd emits **today** for Typography. It is a floor, not a proof. |
| **A state rule against a state rule.** `.x:hover{font-size:…}` is (0,2,0) and passes, but antd's `.css-hash:hover` is also (0,2,0) and is injected later. | Counting pseudo-classes is what the specification says; knowing which of them antd also writes needs antd's stylesheet, which is generated at runtime from the theme. |
| **A sheet assembled across array elements.** `["@media x{", rule, "}"].join("")` — the braces do not balance in any one expression. | The reader refuses text it cannot parse rather than guessing. Every sheet in this repo keeps one complete rule per element; a sheet that does not is silently uncovered. |
| **A selector behind an unresolvable hole.** `` `${sel}{font-size:14px}` `` where `sel` is a parameter or an imported constant. | `${sel}` could be `#a .b`. The rule resolves same-file `const` strings (through any depth of template and `+`), and nothing else — a cross-file resolver would need type information and would be guessing about every string in the fleet. Note this is **not** the parameterised-builder case: `.${f(x)}.${f(x)}` is read fine, because the dots are literal. |
| **Native CSS nesting** (`&`), and rules inside a rule. | `&` resolves against a parent selector the reader does not have. Reported as unreadable, i.e. silent. |
| **A declaration that loses for another reason entirely.** `-webkit-line-clamp` with no `display:-webkit-box`; a custom property the element never inherits; a `var()` that does not resolve. | This rule answers "does the selector win?", not "does the declaration work?". The 0.30.5 clamp failed BOTH ways and only one of them is in scope. |
| **A host's stylesheet.** The rule that beat the clamp lived in a deployment's `storefront.css`, a real CSS file in another repository. | Out of reach by construction, and the reason the bar is (0,2,0) rather than "beat antd": the fix has to survive a host too. |

## Options

```js
"stapel/no-inert-typography-override": ["error", {
  properties: ["color"],                       // ADD to the ladder
  propertiesOverride: ["font-size", "color"],  // REPLACE it outright
}]
```

## The fleet sweep (2026-09-16)

Run over every `packages/*/src` in `stapel-react` with only this rule enabled,
exactly as `no-self-measuring-ref` was swept. **Four** hits, in two packages,
none of them in `@stapel/eslint-plugin`. Left for their owners:

| File | Selector | Verdict |
| --- | --- | --- |
| `packages/listings-react/src/default/detailGallery.ts:429` | `.stapel-listings-detail-count{font-size;line-height}` | **Real.** `ListingHeroGallery.tsx:410` puts that class on an `<antd Typography.Text>` — the lightbox photo counter. This is 0.36.0's defect, still shipping, one component over. |
| `packages/listings-react/src/default/cardGallery.ts:567` | `.stapel-listing-gallery-count{font-size;line-height}` | **Unproven.** The same pill in the card strip, but `ListingPhoto.tsx:349` draws it as a plain `<span>`, so antd is not in the race today. One refactor to `Typography.Text` — the change its own sibling above already made — and it is the row above. |
| `packages/listings-react/src/default/condensedBar.ts:69` | `.stapel-listings-condensed-title{text-overflow;font-size;line-height}` | **Unproven**, same shape: `ListingDetailPane.tsx:1185` draws a `<span>`. |
| `packages/search-react/src/default/LocationSummaryLine.tsx:142` | `.stapel-search-location-line-label{text-overflow;…}` | **Worth a look by `@stapel/search-react`.** The `<span>` sits INSIDE an antd `Button`, and the rule's own comment calls its `display:block` load-bearing ("`text-overflow` applies to a block container"). antd 6's Button styles `> span` only in `Button.Group`, so it looks safe today — but it is the one hit whose element antd is already drawing. |

Two packages' sheets are **silent and correct**, and both are worth reading as
the shape to copy: `ListingCard.tsx`'s `cardTargetCss()` (doubled classes, in
the flat rule and in the `@container` arm), and `tokens-antd/src/skin/theme.tsx`
(every rule scoped under `[data-stapel-skin-root][data-stapel-skin-phone]`,
which is (0,2,0) before the component class is even counted).

## The adjacent rule

`stapel/no-skin-color-literal` reads the same strings with the same gate
(`CSS_DECL_RE`) and asks a different question: *is this value written down
instead of read from the theme?* This one asks *will the declaration apply at
all?* A value can be perfectly tokenised and still never reach the element —
that was 0.36.0, whose `font-size: var(--stapel-font-size-md)` was exactly
right and completely inert.
