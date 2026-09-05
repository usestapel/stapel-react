/**
 * THE DESKTOP RESULT CARD IS A ROW, AND IT HAS THE PHONE CARD'S GALLERY.
 *
 * Measured on the live 1440px SERP in "list" view:
 *
 * ```
 * card 974x835, photo 974x731, stripInsideLink: 15 of 15, dots: none
 * ```
 *
 * — **one offer per screen**, each showing a single photograph the size of a
 * banner, inside the card's own link, with no way to see the other two photos
 * the seller had uploaded. The phone card, measured in the same run, was
 * correct on every one of those counts: 15/15 cards with more than one photo,
 * dots on all of them, a 17px peek, and the strip a SIBLING of the anchor.
 *
 * ── What this suite can prove, and how ────────────────────────────────────
 *
 * The row arm is a `@container` query, and jsdom evaluates neither container
 * queries nor layout: every `getBoundingClientRect` here is a zero box. So
 * this asserts the two things that ARE decidable in a DOM — the structure the
 * layout acts on, and the rule text itself — and the demo variants at both
 * widths are what a browser photographs.
 *
 * The structure is not a proxy for the layout, it IS the fix: a photo that
 * lives inside the anchor cannot be moved beside the text by any stylesheet,
 * and a card that asks about the VIEWPORT is wrong in a grid on a wide screen
 * whatever the numbers say.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { SKIN_CAROUSEL_SLIDE_CLASS } from "@stapel/tokens-antd/skin";
import { ListingCard, ListingSerpCard } from "../src/default/index.js";
import {
  CARD_BLEED_CLASS,
  CARD_FRAME_CLASS,
  CARD_HOVER_CLASS,
  CARD_MAIN_CLASS,
  CARD_MEDIA_CLASS,
  CARD_QUERY_CLASS,
  CARD_TARGET_CLASS,
  LISTING_CARD_ROW_MEDIA,
  LISTING_CARD_ROW_MIN,
  cardTargetCss,
} from "../src/default/ListingCard.js";
import { PHOTO_LINK_CLASS } from "../src/default/ListingPhoto.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

/** What every card on the live category page had, and what the desktop card
 * drew one of. */
const THREE_PHOTOS = { ...CARD, images: ["image/one", "image/two", "image/three"] };

describe("the desktop card has the phone card's gallery", () => {
  it("draws one slide per photo instead of one photo", () => {
    render(providers(<ListingCard listing={THREE_PHOTOS} href="/l/7" />));
    const strip = screen.getByTestId("listings-card-photos");
    expect(strip.getAttribute("data-stapel-carousel-slides")).toBe("3");
    expect(strip.querySelectorAll("[data-stapel-carousel-slide]")).toHaveLength(3);
  });

  it("peeks and draws dots for more than one photo", () => {
    render(providers(<ListingCard listing={THREE_PHOTOS} href="/l/7" />));
    const strip = screen.getByTestId("listings-card-photos");
    expect(strip.querySelectorAll("[data-stapel-carousel-dot]")).toHaveLength(3);
    expect(strip.getAttribute("data-stapel-carousel-peek")).not.toBe("0px");
  });

  it("drops both for a single photo — a sliver of nothing is not an affordance", () => {
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    const strip = screen.getByTestId("listings-card-photos");
    expect(strip.querySelectorAll("[data-stapel-carousel-dot]")).toHaveLength(0);
    expect(strip.getAttribute("data-stapel-carousel-peek")).toBe("0px");
  });

  it("still draws one slide for a listing with no photos at all", () => {
    render(providers(<ListingCard listing={{ ...CARD, images: [] }} href="/l/7" />));
    const strip = screen.getByTestId("listings-card-photos");
    expect(strip.getAttribute("data-stapel-carousel-slides")).toBe("1");
    // The card's height must not depend on whether a seller uploaded anything.
    expect(screen.getByTestId("listings-photo-absent")).toBeTruthy();
  });

  it("puts the strip OUTSIDE the anchor, on both card surfaces", () => {
    const { unmount } = render(
      providers(<ListingCard listing={THREE_PHOTOS} href="/l/7" />)
    );
    expect(
      screen
        .getByTestId("listings-card-open")
        .contains(screen.getByTestId("listings-card-photos"))
    ).toBe(false);
    unmount();

    render(providers(<ListingSerpCard listing={THREE_PHOTOS} href="/l/7" />));
    expect(
      screen
        .getByTestId("listings-serp-open")
        .contains(screen.getByTestId("listings-serp-photos"))
    ).toBe(false);
  });
});

describe("the media and the reading column are siblings the layout can swap", () => {
  for (const [name, node] of [
    ["ListingCard", <ListingCard key="g" listing={THREE_PHOTOS} href="/l/7" />],
    ["ListingSerpCard", <ListingSerpCard key="s" listing={THREE_PHOTOS} href="/l/7" />],
  ] as const) {
    it(`gives ${name} a query box, a frame, a media box and a main box`, () => {
      const { container } = render(providers(node));
      const query = container.querySelector(`.${CARD_QUERY_CLASS}`);
      const frame = container.querySelector(`.${CARD_FRAME_CLASS}`);
      const media = container.querySelector(`.${CARD_MEDIA_CLASS}`);
      const main = container.querySelector(`.${CARD_MAIN_CLASS}`);
      expect(query).not.toBeNull();
      expect(frame).not.toBeNull();
      // A container cannot answer a query about ITSELF, which is why the box
      // that declares `container-type` is not the box that flips direction.
      expect(query?.contains(frame as Node)).toBe(true);
      expect(query).not.toBe(frame);
      // Media and main are siblings of one frame: `flex-direction: row` is
      // then the whole of the row arm, and nothing has to move in the DOM.
      expect(media?.parentElement).toBe(frame);
      expect(main?.parentElement).toBe(frame);
      // And the photos are in the media box, the reading in the main one.
      expect(media?.querySelector("[data-stapel-carousel]")).not.toBeNull();
      expect(main?.querySelector("a")).not.toBeNull();
    });
  }
});

describe("the rule text — the row arm a browser applies", () => {
  const css = cardTargetCss();

  it("asks the CARD's width, not the window's", () => {
    // A media query would make the same card wrong in a grid on a wide
    // screen: a 300px column inside a 1440px viewport is not a row.
    expect(css).toContain(`@container (min-width:${String(LISTING_CARD_ROW_MIN)}px)`);
    // A WIDTH media query is the defect — it asks the WINDOW. Both `@media`
    // rules this sheet carries ask the PERSON and their device instead:
    // whether they want motion, and whether their pointer can hover at all.
    expect(css).not.toContain("@media (min-width");
    expect(css).not.toContain("@media (max-width");
    // Three, and every one of them asks the person or their hardware:
    // reduced motion (twice — the card's lift and the target's press) and
    // whether the pointer can hover at all.
    expect(css.match(/@media/g) ?? []).toHaveLength(3);
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(css).toContain("@media (hover:hover)");
    expect(css).toContain(`.${CARD_QUERY_CLASS}{container-type:inline-size}`);
  });

  it("answers a FINGER, which has no hover to give (Д176)", () => {
    // Swept on the live phone: one `:hover` rule for the card and zero
    // `:active`, with `matchMedia("(hover: hover)")` answering false. So on
    // the device this product is mostly used on, pressing a card gave no
    // feedback at all until the next screen arrived — and the hover rule,
    // unguarded, latched on after the tap.
    expect(css).toContain(`.${CARD_HOVER_CLASS}:active{`);
    expect(css).toContain(`.${PHOTO_LINK_CLASS}:active{`);
    // …and on the TARGET, which is the one element all three card surfaces
    // share: the feed tile is a bare div with this anchor over it and no card
    // chrome for a frame rule to reach.
    expect(css).toContain(`.${CARD_TARGET_CLASS}:active{transform:`);
  });

  it("stacks below the threshold and lays a row above it", () => {
    expect(css).toContain(`.${CARD_FRAME_CLASS}{display:flex;flex-direction:column`);
    expect(css).toContain(`.${CARD_FRAME_CLASS}{flex-direction:row;align-items:flex-start}`);
  });

  it("bounds the photograph so several rows fit a screen", () => {
    // 974x731 was a card that kept its stacked proportions in a full-page
    // track. The row arm fixes the media's basis AND its maximum — and gives
    // it the card's own corner on all four sides, because beside the text the
    // photo is a block rather than the top of one.
    expect(css).toContain(
      `.${CARD_MEDIA_CLASS}{flex:0 0 ${String(LISTING_CARD_ROW_MEDIA)}px;` +
        `border-radius:var(--listing-card-radius);` +
        `max-inline-size:${String(LISTING_CARD_ROW_MEDIA)}px}`
    );
    expect(LISTING_CARD_ROW_MEDIA).toBeLessThan(LISTING_CARD_ROW_MIN / 2);
  });

  it("cuts the photo to the card's OWN corner, and squares the slides", () => {
    // D180. A multi-photo tile drew a rounded sliver of the NEXT photograph
    // in the corner where the card's curve should be — measured on every row
    // of the live feed, in both themes, and read from a distance as a set of
    // pictures with a torn right edge. The card owns one radius and hands it
    // to the box that holds the pictures; the slides inside it are square,
    // because the well is what has the shape.
    expect(css).toContain(
      `.${CARD_MEDIA_CLASS}{min-inline-size:0;overflow:hidden;` +
        `border-start-start-radius:var(--listing-card-radius);` +
        `border-start-end-radius:var(--listing-card-radius)}`
    );
    expect(css).toContain(
      `.${CARD_MEDIA_CLASS} .${SKIN_CAROUSEL_SLIDE_CLASS}{border-radius:0}`
    );
  });

  it("lets the reading column take what is left, and shrink", () => {
    expect(css).toContain(
      `.${CARD_MAIN_CLASS}{display:flex;flex-direction:column;flex:1 1 auto;min-inline-size:0}`
    );
  });

  it("insets the full-bleed card's row arm, and only that card's", () => {
    // `<ListingCard>` runs its photo edge-to-edge when stacked, so in the row
    // arm it has no padding of its own to give the picture.
    expect(css).toContain(`.${CARD_BLEED_CLASS}{padding-block:var(--listing-card-inset)`);
    const { container } = render(
      providers(<ListingCard listing={THREE_PHOTOS} href="/l/7" />)
    );
    expect(container.querySelector(`.${CARD_BLEED_CLASS}`)).not.toBeNull();
  });

  it("keeps the bleed class off the SERP card, which is padded already", () => {
    const { container } = render(
      providers(<ListingSerpCard listing={THREE_PHOTOS} href="/l/7" />)
    );
    expect(container.querySelector(`.${CARD_BLEED_CLASS}`)).toBeNull();
  });
});

/**
 * WHO AM I BUYING FROM — and where that answer sits.
 *
 * The bottom of a result card reads as one descending line of provenance:
 * what it is, then where it is, then who is selling it. This card put the
 * seller between the specs and the place, which reads as part of the
 * description rather than as the answer to "who am I buying from" — the
 * reference classified, and the host measured against it, put it last.
 *
 * A prop rather than a change of mind: a seller's OWN page, where every card
 * has the same seller, keeps that line out of the way at the bottom, and a
 * cross-seller feed leads with it. Both stay one line of composition.
 */
describe("where the seller line sits", () => {
  function positions(): { seller: number; location: number } {
    const nodes = [...document.querySelectorAll("[data-testid]")];
    return {
      seller: nodes.findIndex(
        (node) => node.getAttribute("data-testid") === "seller-line"
      ),
      location: nodes.findIndex(
        (node) => node.getAttribute("data-testid") === "listings-serp-location"
      ),
    };
  }

  it("keeps the seller ABOVE the place by default — nothing existing moves", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          sellerSlot={<span data-testid="seller-line">Ivan · 4.9</span>}
        />
      )
    );
    const { seller, location } = positions();
    expect(seller).toBeGreaterThan(-1);
    expect(location).toBeGreaterThan(-1);
    expect(seller).toBeLessThan(location);
  });

  it("puts it BELOW the place when the surface asks", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          sellerSlotPosition="below"
          sellerSlot={<span data-testid="seller-line">Ivan · 4.9</span>}
        />
      )
    );
    const { seller, location } = positions();
    expect(location).toBeLessThan(seller);
  });

  it("draws the seller alone on a card with no place at all", () => {
    render(
      providers(
        <ListingSerpCard
          listing={{ ...CARD, location_label: "" }}
          href="/l/7"
          sellerSlotPosition="below"
          sellerSlot={<span data-testid="seller-line">Ivan · 4.9</span>}
        />
      )
    );
    // The order is over two lines, one of which may not exist: a card without
    // a place must not lose the seller with it.
    expect(screen.getByTestId("seller-line")).toBeTruthy();
    expect(screen.queryByTestId("listings-serp-location")).toBeNull();
  });
});
