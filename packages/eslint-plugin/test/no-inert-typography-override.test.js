// The shapes here are TRANSCRIBED, not invented. The invalid cases are the
// four sites this defect was found on in one wave — `@stapel/listings-react`
// 0.36.0's `cardTargetCss()`, its 0.30.5 title clamp, the same clamp's
// `@container` arm, and the storefront's category H1 — and the valid cases are
// the code that fixed each of them, including the PARAMETERISED builder whose
// literal-template assertion is why this became a lint rule. A rule for a
// production defect has to fail on the code that caused it and pass on the
// code that fixed it; anything else is a gate that proves nothing.
import rule from "../rules/no-inert-typography-override.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

const CARD = "/repo/packages/listings-react/src/default/ListingCard.tsx";
const CLAMP = "/repo/packages/listings-react/src/default/titleClamp.ts";
const STOREFRONT = "/repo/apps/storefront/src/categories/categoryTitle.ts";

tester.run("no-inert-typography-override", rule, {
  valid: [
    // ── listings-react 0.36.1, the fix ────────────────────────────────────
    //
    // The class written TWICE — (0,2,0) — which outranks antd's generated
    // (0,1,0) on specificity rather than on load order, and outranks its
    // `h1:where(.css-x).ant-typography` (0,1,1) too.
    {
      filename: CARD,
      code:
        'const CARD_TITLE_CLASS = "stapel-listing-card-title";\n' +
        'const CARD_PRICE_CLASS = "stapel-listing-card-price";\n' +
        "function cardTargetCss() {\n" +
        "  return [\n" +
        "    `.${CARD_TITLE_CLASS}.${CARD_TITLE_CLASS},.${CARD_PRICE_CLASS}.${CARD_PRICE_CLASS}{` +\n" +
        "      `font-size:var(--stapel-font-size-md);` +\n" +
        "      `line-height:var(--stapel-line-height-md)}`,\n" +
        "  ].join('');\n" +
        "}",
    },
    // The same, inside the `@container` arm. The wrapper adds no specificity,
    // so this passes for the same reason the flat rule does — not because the
    // rule failed to look inside the at-rule (see the invalid case below).
    {
      filename: CARD,
      code:
        'const CARD_TITLE_CLASS = "stapel-listing-card-title";\n' +
        "const LISTING_CARD_ROW_MIN = 560;\n" +
        "function rowArm() {\n" +
        "  return `@container (min-width:${String(LISTING_CARD_ROW_MIN)}px){` +\n" +
        "    `.${CARD_TITLE_CLASS}.${CARD_TITLE_CLASS}{font-size:var(--stapel-font-size-lg)}}`;\n" +
        "}",
    },
    // ── the parameterised builder ─────────────────────────────────────────
    //
    // THE POINT OF THIS RULE. `clampClass(lines)` is a function call the rule
    // cannot resolve, and it does not need to: `.HOLE.HOLE` is two class
    // compounds whatever the function returns. The per-package test that
    // asserted the literal template broke on exactly this refactor while the
    // emitted bytes were unchanged.
    {
      filename: CLAMP,
      code:
        "function clampRule(lines) {\n" +
        "  const self = `.${clampClass(lines)}.${clampClass(lines)}`;\n" +
        "  return (\n" +
        "    `${self}{display:-webkit-box;-webkit-box-orient:vertical;` +\n" +
        "    `-webkit-line-clamp:${String(lines)};overflow:hidden;overflow-wrap:normal}`\n" +
        "  );\n" +
        "}",
    },
    // The doubled ATTRIBUTE selector — the storefront H1's fix.
    {
      filename: STOREFRONT,
      code:
        "const TITLE = '[data-testid=\"categories-category-title\"]';\n" +
        "const css = `${TITLE}${TITLE}{font-size:var(--stapel-font-size-2xl);line-height:1.2}`;",
    },
    // A parent-scoped selector reaches (0,2,0) the other way, and is the right
    // answer when the class cannot be doubled.
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-main .stapel-listing-card-price{font-size:14px}`;",
    },
    // `!important` wins at any specificity. A different answer to the same
    // question, not a defect.
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-price{font-size:14px !important}`;",
    },
    // A pseudo-class is a class-level component: `.x:hover` is (0,2,0).
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-title:focus-visible{letter-spacing:0.01em}`;",
    },
    // An id outranks everything antd emits.
    {
      filename: STOREFRONT,
      code: "const css = `#serp-title{font-weight:600}`;",
    },
    // ── silent on purpose ─────────────────────────────────────────────────
    //
    // NOT a typography declaration. A single class setting layout competes
    // with nothing antd writes for Typography, and reporting it would turn
    // every sheet in the fleet red. This is `cardTargetCss()`'s own frame
    // rule, as shipped.
    {
      filename: CARD,
      code:
        'const CARD_FRAME_CLASS = "stapel-listing-card-frame";\n' +
        "const css = `.${CARD_FRAME_CLASS}{display:flex;flex-direction:column;min-inline-size:0}`;",
    },
    // The card's own target rule — `color:inherit;text-decoration:none` on a
    // link wrapper at (0,1,0). Correct code, and the reason `color` is not on
    // the default ladder (see the rule header).
    {
      filename: CARD,
      code:
        'const CARD_TARGET_CLASS = "stapel-listing-card-target";\n' +
        "const css = `.${CARD_TARGET_CLASS}{display:block;color:inherit;text-decoration:none}`;",
    },
    // A whole selector behind an unresolvable hole. `${sel}` could be
    // `#a .b .c`; the rule does not report what it cannot read.
    {
      filename: CARD,
      code: "function sheet(sel) { return `${sel}{font-size:14px}`; }",
    },
    // Not a stylesheet at all.
    {
      filename: CARD,
      code: 'const label = "font-size: the size of the font";',
    },
    // A test path is carved out inside the rule, not only in the preset —
    // a fixture's job is to BE the losing selector.
    {
      filename: "/repo/packages/listings-react/test/cardCss.test.ts",
      code: "const css = `.stapel-listing-card-price{font-size:16px}`;",
    },
    // `@keyframes` percentages are not selectors and nothing in them competes
    // with antd.
    {
      filename: CARD,
      code: "const css = `@keyframes grow{from{font-size:12px}to{font-size:16px}}`;",
    },
  ],

  invalid: [
    // ── CASE 1: listings-react 0.36.0, as it shipped ──────────────────────
    //
    // A single class carrying the card's font ladder. The class was on the
    // element, the sheet was in the head, and the computed size was antd's.
    {
      filename: CARD,
      code:
        'const CARD_PRICE_CLASS = "stapel-listing-card-price";\n' +
        "const css = `.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md);line-height:var(--stapel-line-height-md)}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            // The class const resolves, so the message names the selector the
            // browser sees rather than the expression that built it.
            selector: ".stapel-listing-card-price",
            property: "font-size",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // ── CASE 2: the same rule inside the `@container` arm ─────────────────
    //
    // The wrapper adds NO specificity. A rule that only looked at top-level
    // selectors would have blessed the exact line that shipped inert.
    {
      filename: CARD,
      code:
        'const CARD_TITLE_CLASS = "stapel-listing-card-title";\n' +
        "const LISTING_CARD_ROW_MIN = 560;\n" +
        "const css = `@container (min-width:${String(LISTING_CARD_ROW_MIN)}px){` +\n" +
        "  `.${CARD_TITLE_CLASS}{font-size:var(--stapel-font-size-lg)}}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-title",
            property: "font-size",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // ── CASE 3: listings-react 0.30.5, the title clamp ────────────────────
    //
    // An attribute selector at (0,1,0) against the HOST's storefront.css
    // setting `display:block` on the same testids and loading second. 60
    // titles carried the class and none of them clamped.
    {
      filename: CLAMP,
      code:
        "const css = `[data-testid=\"listings-card-title\"]{display:-webkit-box;` +\n" +
        "  `-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: '[data-testid="listings-card-title"]',
            property: "-webkit-box-orient",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // ── CASE 4: the storefront's category H1 ──────────────────────────────
    //
    // Losing on SPECIFICITY rather than on order: antd's own
    // `h1:where(.css-x).ant-typography` is (0,1,1), so this never applies at
    // any load order.
    {
      filename: STOREFRONT,
      code:
        "const css = `[data-testid=\"categories-category-title\"]{font-size:var(--stapel-font-size-2xl);line-height:1.2}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: '[data-testid="categories-category-title"]',
            property: "font-size",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // ── the shapes around the four ────────────────────────────────────────
    //
    // A bare type selector: no class component at all, so antd's generated
    // class outranks it outright. Its own message, because doubling is not
    // the fix — the element needs a class first.
    {
      filename: STOREFRONT,
      code: "const css = `h1{font-size:28px;font-weight:600}`;",
      errors: [
        {
          messageId: "inertTypographyElementSelector",
          data: { selector: "h1", property: "font-size", score: "(0,0,1)" },
        },
      ],
    },
    // (0,1,1) — a class plus a type selector TIES antd's Title rule, so the
    // coin flip is back. Two class-level components is the bar, not two
    // components.
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-main h2{font-weight:700}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-main h2",
            property: "font-weight",
            score: "(0,1,1)",
          },
        },
      ],
    },
    // `:where()` contributes nothing — that is its entire job — so this reads
    // as one class, not two.
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-price:where(.is-row){line-height:1.4}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-price:where(.is-row)",
            property: "line-height",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // Each losing member of a selector LIST is reported: the doubled half is
    // fine and the single half is not, and a reader has to be told which.
    {
      filename: CARD,
      code:
        'const T = "stapel-listing-card-title";\n' +
        'const P = "stapel-listing-card-price";\n' +
        "const css = `.${T}.${T},.${P}{font-size:14px}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-price",
            property: "font-size",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // A sheet assembled by `+` across several templates, the selector in one
    // piece and the declaration in another — the shape `cardTargetCss()`
    // actually uses.
    {
      filename: CARD,
      code:
        'const CLASS = "stapel-listing-card-subtitle";\n' +
        "const css = `.${CLASS}{` + `letter-spacing:0.02em;` + `text-transform:uppercase}`;",
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-subtitle",
            property: "letter-spacing",
            score: "(0,1,0)",
          },
        },
      ],
    },
    // A `properties` option adds to the ladder rather than replacing it, so a
    // pair that DOES fight antd for a colour can say so.
    {
      filename: CARD,
      code: "const css = `.stapel-listing-card-price{color:var(--stapel-text)}`;",
      options: [{ properties: ["color"] }],
      errors: [
        {
          messageId: "inertTypographyOverride",
          data: {
            selector: ".stapel-listing-card-price",
            property: "color",
            score: "(0,1,0)",
          },
        },
      ],
    },
  ],
});
