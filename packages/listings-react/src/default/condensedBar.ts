/**
 * THE CONDENSED BAR — what a phone reads at the top of a listing page once
 * the title has scrolled away.
 *
 * ── Why the pane draws it, when it already lends the cluster out ───────────
 *
 * `renderActionsBar` hands a host the MOUNT POINT and lets it build the bar.
 * That is the right seam for a container with chrome of its own, and it is
 * also four things every container then writes identically: a fixed strip at
 * the top of the viewport, a back control, the listing's title on one line,
 * and the rule that the bar is on screen exactly while the title is not.
 * Measured against the reference classified (§24/§25/§29), which shows the
 * same four from about 160px of scroll on every listing it has.
 *
 * So `actionsPlacement={["header", "condensed-top"]}` is the pane drawing it,
 * with the SAME travelling cluster underneath — one `useFavoriteToggle`, one
 * `aria-pressed` heart, one share control, moved as a DOM node into the bar's
 * slot and moved back when the bar goes (`movableCluster.tsx` has the whole
 * argument). A host that wants a different bar keeps `renderActionsBar`, and
 * where both are asked for the host's own render prop wins: a pair's default
 * never overrules a container that said something specific.
 *
 * ── The threshold is the TITLE, not a pixel count ─────────────────────────
 *
 * The reference's "~160px" is a fact about its own header height, not a
 * number this pane could honour — the same 160px is mid-gallery on one
 * storefront and past the price on another. The pane already watches its own
 * `<h1>` through an `IntersectionObserver` for `onTitleVisible`; the bar
 * appears when that says the title left the fold, which is what the reference
 * number approximates and what a person actually reads: the bar carries the
 * title precisely because the title is no longer on screen.
 *
 * ── The geometry is a stylesheet, for two reasons ─────────────────────────
 *
 * The ellipsis needs three declarations on the title element and the bar needs
 * a `position: fixed` a host may want to move under its own header. Written as
 * a class, a container retunes either with a selector instead of `!important`
 * over an inline style — the rule `detailGallery.ts` was created to establish.
 */
import { cssVar, fontSize, spacing } from "@stapel/tokens";

/** The class the fixed bar carries. */
export const CONDENSED_BAR_CLASS = "stapel-listings-condensed-bar";
/** The class the bar's one-line title carries. */
export const CONDENSED_TITLE_CLASS = "stapel-listings-condensed-title";
/** The `href` the hoisted bar stylesheet is deduplicated by. */
export const CONDENSED_BAR_STYLE_HREF = "stapel-listings-condensed-bar";

/**
 * The bar's rules.
 *
 * The colours are token ROLES read as vars rather than resolved numbers: the
 * bar is painted over whatever the page is scrolling, so it needs an opaque
 * ground, and a ground picked in JS at render keeps the theme it was drawn
 * with when the reader switches themes. `z-index: 20` is above a page's own
 * content and deliberately below the range a modal layer uses.
 */
export function condensedBarCss(): string {
  return [
    `.${CONDENSED_BAR_CLASS}{position:fixed;inset-block-start:0;inset-inline:0;` +
      `z-index:20;display:flex;align-items:center;` +
      `gap:${String(spacing[2])}px;` +
      `padding:${String(spacing[2])}px ${String(spacing[3])}px;` +
      `background:${cssVar("surface-raised")};` +
      `border-block-end:1px solid ${cssVar("border")}}`,
    // One line, and the end of a long title is the part a reader can spare.
    // `min-inline-size:0` is what lets it shrink inside the flex row at all —
    // without it a long title pushes the two verbs off the screen.
    `.${CONDENSED_TITLE_CLASS}{flex:1 1 auto;min-inline-size:0;` +
      `overflow:hidden;white-space:nowrap;text-overflow:ellipsis;` +
      `font-size:${String(fontSize.sm.fontSize)}px;` +
      `line-height:${String(fontSize.sm.lineHeight)}px}`,
  ].join("");
}
