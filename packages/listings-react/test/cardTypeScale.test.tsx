/**
 * ONE ROLE, ONE SCALE.
 *
 * Measured on the live storefront at 1440: the SERP list card priced at
 * 22px and the grid card at 16px — the same role rendered two ways inside one
 * product, which is worse than any gap against a reference. The titles were
 * 16px on both where the reference's wide tier is 18px.
 *
 * The cause was a second call site: `ListingSerpCard` set
 * `fontSize.xl.fontSize` inline while `ListingCard` set nothing. That number
 * is also the DEFAULT theme's ladder, imported into the bundle at build time,
 * so a brand publishing its own ladder could never reach it — the brand is
 * chosen at run time and a compiled-in number does not move.
 *
 * So the scale is declared ONCE, in the shared sheet, as custom properties.
 * These assertions are about that: not "the price is 18px" (a number this
 * package does not own) but "both cards ask for the same role, and the sheet
 * answers it from the brand".
 */
import { describe, expect, it } from "vitest";
import {
  CARD_PRICE_CLASS,
  CARD_TITLE_CLASS,
  LISTING_CARD_ROW_MIN,
  cardTargetCss,
} from "../src/default/ListingCard.js";

describe("the card type scale is declared once", () => {
  const css = cardTargetCss();

  it("gives the title and the price the same two rules, from the BRAND's ladder", () => {
    // Custom properties, not numbers: a compiled-in size is the default
    // theme's, and the whole point is that a brand's own ladder applies.
    expect(css).toContain(
      `.${CARD_TITLE_CLASS}.${CARD_TITLE_CLASS},.${CARD_PRICE_CLASS}.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-md);line-height:var(--stapel-line-height-md)}`
    );
    expect(css).toContain(
      `.${CARD_TITLE_CLASS}.${CARD_TITLE_CLASS},.${CARD_PRICE_CLASS}.${CARD_PRICE_CLASS}{font-size:var(--stapel-font-size-lg);line-height:var(--stapel-line-height-lg)}`
    );
  });

  it("outranks antd's runtime sheet instead of racing it", () => {
    // antd injects `.css-<hash>` with Typography's font-size into <head> at
    // runtime, AFTER this static sheet, at the same (0,1,0) specificity a
    // single class has — so a single-class rule loses on order. This shipped
    // inert exactly once that way: class on the element, container 1062px,
    // rule in the sheet, computed size still antd's. `@container` adds no
    // specificity, so the selector has to.
    expect(css).toContain(`.${CARD_PRICE_CLASS}.${CARD_PRICE_CLASS}`);
    expect(css).toContain(`.${CARD_TITLE_CLASS}.${CARD_TITLE_CLASS}`);
  });

  it("asks the CARD's width for the tier, at the row arm's own threshold", () => {
    // The package's standing rule, and `desktopSerpRow.test.tsx` enforces it
    // for the whole sheet: a window query would put an 18px title in a 280px
    // grid tile on a wide screen. The tier arrives exactly when the card
    // becomes a row and has the measure to carry it.
    expect(css).toContain(`@container (min-width:${String(LISTING_CARD_ROW_MIN)}px)`);
    expect(css).not.toContain("@media (min-width");
  });

  it("sets no WEIGHT, so the brand decides what strong means", () => {
    // The prices are `<Typography.Text strong>`. A weight written here would
    // silently overrule `fontWeightStrong`, and this brand deliberately
    // aliases medium/semibold onto its two real weights.
    const scale = css.slice(0, css.indexOf(".stapel-listing-card-target"));
    expect(scale).not.toContain("font-weight");
  });
});
