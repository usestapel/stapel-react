/**
 * The geometry of a listing's action row — the heart, the share button, and
 * the rules that make both of them reachable with a thumb.
 *
 * Split out of `<ListingActions>` so `<ShareAction>` can carry the same class
 * without the two modules importing each other, and so the numbers below are
 * something a test can READ rather than something a rendered button implies.
 *
 * ── Why a class and not an inline style ───────────────────────────────────
 *
 * Three of the four rules here cannot be written inline at all: a media query
 * (the label that disappears on a phone), a descendant selector (the hit area
 * of whatever element the skin registry substituted for antd's button), and
 * `:focus-visible`. The fourth — the 44px floor — is written here with them so
 * that "how big is this control" has ONE answer in this package instead of one
 * per surface, which is how the SERP heart ended up 32px while the feed
 * heart was 40 and neither was the number the platform guidelines ask for.
 *
 * ── 44 px, and where the number comes from ────────────────────────────────
 *
 * `controls["height-phone"]` — the token dictionary's own touch floor, the
 * same value `SkinTheme` feeds antd as `controlHeight` on a phone (WCAG 2.5.8
 * and both platform HIGs land on 44 CSS px). It is applied here as a MINIMUM
 * on every viewport rather than only on a phone: these two controls are small
 * glyphs pinned to the corner of a photograph, and a 32px circle at the edge
 * of an image is a miss on a touchscreen laptop as surely as on a phone.
 */
import { breakpoints, controls, radii, spacing } from "@stapel/tokens";

/** The class every control in the PAGE cluster carries: the 44px floor. */
export const LISTING_ACTION_CLASS = "stapel-listing-action";
/**
 * The class a CARD's control carries — the same floor, one tier smaller on a
 * pointer device.
 *
 * A card heart is drawn forty to a screen on a desktop grid, where the
 * reference classified uses a 36px target and a cursor hits it every time;
 * the same glyph on a phone is a thumb target and goes back to 44. Two tiers
 * rather than one number, because a 44px circle in the corner of a 267px
 * photograph is a fifth of the picture's height on a desktop — measured
 * against the reference (§23), which is why this is not simply
 * {@link LISTING_ACTION_CLASS}.
 *
 * The GLYPH does not change size in either tier; only the box around it does.
 */
export const LISTING_CARD_ACTION_CLASS = "stapel-listing-card-action";
/** The class the cluster's row carries. */
export const LISTING_ACTIONS_CLASS = "stapel-listing-actions";
/**
 * The class that pins the cluster to the trailing TOP corner of the media it
 * is drawn over.
 *
 * Top-trailing is the one corner of a card gallery that is free: the dots own
 * the bottom centre (`SkinCarousel`) and the "3 of 16" counter owns the
 * bottom trailing corner (`cardGalleryCss`). Nothing here may move into
 * either, which is why this is a named constant with a comment rather than
 * two numbers picked per surface.
 */
export const LISTING_ACTIONS_OVERLAY_CLASS = "stapel-listing-actions-over";
/** The class on the WORD beside a glyph — painted on a desktop, dropped on a
 * phone, where the same word is still the control's accessible name. */
export const LISTING_ACTION_LABEL_CLASS = "stapel-listing-action-label";
/** The `href` the hoisted action-row stylesheet is deduplicated by. */
export const LISTING_ACTIONS_STYLE_HREF = "stapel-listings-action-row";

/**
 * The minimum touch target for every control in the cluster, in CSS pixels.
 *
 * Exported so a host laying out beside the cluster measures against the same
 * number — and so `test/shareAction.test.tsx` asserts the rule carries THIS
 * value rather than a literal that could drift from the token.
 */
export const LISTING_ACTION_HIT: number = controls["height-phone"];

/**
 * A CARD control's minimum target on a pointer device, in CSS pixels.
 *
 * The reference classified's own desktop measurement (§23). It is not on the
 * token scale, and it is not meant to be: the scale carries a control HEIGHT
 * (32) and a touch FLOOR (44), and this is the third thing — the smallest box
 * a cursor reliably hits around a 16px glyph. Named, with the measurement,
 * rather than typed into a stylesheet as `36`.
 *
 * On a phone the card control goes back to {@link LISTING_ACTION_HIT}: there
 * is no such thing as a small touch target.
 */
export const LISTING_CARD_ACTION_HIT = 36;

/**
 * HOW MANY TIMES THE HIT-TARGET CLASS IS REPEATED IN ITS OWN SELECTOR — and
 * why a repeat rather than a number typed once (D450).
 *
 * Measured on the live listing page: the heart and the share glyph were
 * **32 × 44**, not 44 × 44. The block axis survived and the inline one did
 * not, because antd's circle shape ships
 *
 *   `:where(…).ant-btn.ant-btn-circle.ant-btn{min-width:var(--ant-control-height)}`
 *
 * — three classes, specificity (0,3,0), against this sheet's single class
 * (0,1,0). `:where()` adds nothing, and a media query adds nothing either, so
 * the only thing that decides is the class count: antd's 32 won and there was
 * no viewport at which it did not.
 *
 * A repeated class is the one way to outrank it without `!important`. Four
 * repeats — (0,4,0) — clear antd's three with one to spare, and the selector
 * still matches exactly the same element, so nothing about WHAT the rule
 * applies to changes. `!important` was refused deliberately: a host that
 * genuinely wants a different target must be able to say so with a selector,
 * and this sheet's whole argument (see `movableCluster.tsx`) is that a pair's
 * geometry should never force one on somebody else.
 */
export const LISTING_ACTION_SPECIFICITY = 4;

/** A class name repeated {@link LISTING_ACTION_SPECIFICITY} times — the
 * selector that beats antd's circle. */
function outranking(className: string): string {
  return `.${className}`.repeat(LISTING_ACTION_SPECIFICITY);
}

/**
 * The floor, in BOTH spellings of the same axis.
 *
 * A browser cascades `min-inline-size` and `min-width` together and keeps the
 * winner, so in a browser the logical pair alone would be enough once the
 * selector outranks antd's. The physical pair is written beside it because
 * the declaration being beaten is spelled physically, and an engine that does
 * NOT merge the two names (jsdom, where this rule is asserted) would leave
 * antd's `min-width:32px` standing beside our `min-inline-size:44px` and call
 * that a pass. Two spellings of one number, and the number has one source.
 */
function floor(size: number): string {
  const px = `${String(size)}px`;
  return (
    `min-inline-size:${px};min-block-size:${px};` +
    `min-width:${px};min-height:${px}`
  );
}

export function actionRowCss(): string {
  const action = outranking(LISTING_ACTION_CLASS);
  const cardAction = outranking(LISTING_CARD_ACTION_CLASS);
  const row = `.${LISTING_ACTIONS_CLASS}`;
  const over = `.${LISTING_ACTIONS_OVERLAY_CLASS}`;
  const label = `.${LISTING_ACTION_LABEL_CLASS}`;
  const phone = `(max-width:${String(breakpoints.tablet - 1)}px)`;
  return [
    // The floor. `min-*` rather than `width`/`height`: a share button with a
    // word in it is wider than 44px and must stay so, and antd's own
    // `controlHeight` already reaches the height on a phone — this is the
    // guarantee for every OTHER viewport and for a host-registered button
    // that never read the antd token at all.
    `${action}{${floor(LISTING_ACTION_HIT)};` +
      `display:inline-flex;align-items:center;justify-content:center}`,
    // A card's control: one tier smaller where there is a cursor, the same
    // 44px where there is a thumb. See LISTING_CARD_ACTION_HIT.
    `${cardAction}{${floor(LISTING_CARD_ACTION_HIT)};` +
      `display:inline-flex;align-items:center;justify-content:center}`,
    `@media ${phone}{${cardAction}{${floor(LISTING_ACTION_HIT)}}}`,
    // The cluster. `align-items:flex-end` so a blocked heart's reason — the
    // one thing here that can be two lines — stacks against the same edge
    // instead of pushing the controls inwards (the arrangement
    // `<ListingFeedCard>` already ships).
    `${row}{display:flex;align-items:flex-end;gap:${String(spacing[2])}px}`,
    // Over a photograph. `z-index:2` puts it above the counter's `1`; the two
    // never meet anyway (top-trailing against bottom-trailing) and the layer
    // is stated so a future third overlay has an order to join.
    `${over}{position:absolute;inset-block-start:${String(spacing[2])}px;` +
      `inset-inline-end:${String(spacing[2])}px;z-index:2;` +
      `flex-direction:column;align-items:flex-end;` +
      `border-radius:${String(radii.full)}px}`,
    // THE WORD DISAPPEARS ON A PHONE, THE NAME NEVER DOES. Both controls
    // carry their `aria-label` in every arm, so what a screen reader
    // announces is identical at 390px and at 1440px; what changes is whether
    // there is room to paint the word as well. A viewport query rather than a
    // container one: this is chrome, not a layout that has to fit a track,
    // and the question really is "is this a phone".
    `@media ${phone}{${label}{display:none}}`,
  ].join("");
}
