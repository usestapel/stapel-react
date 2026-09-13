/**
 * THE RATING IS READ WITH THE PRICE, NOT WITH THE PLACE.
 *
 * The reference's list card reads photo, stars, price, title. Ours put the
 * seller's rating inside `sellerSlot`, which this card draws at the BOTTOM
 * with the location — so on a live storefront the stars sat under the place,
 * three lines below the price they qualify, and a walker reported them as
 * missing from the card's reading order altogether.
 *
 * `ratingSlot` is a second slot rather than a position for `sellerSlot`,
 * because the two answer different questions: the rating is a fact about the
 * offer and is read with the price, the seller's NAME is provenance and
 * belongs with the place.
 *
 * Both slots stay OUTSIDE the anchor. A rating usually links to the reviews it
 * summarises and a name usually links to the seller, and a link inside a link
 * is neither valid nor operable — which is the same rule the photo strip
 * already lives by in this card.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingSerpCard } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{children}</TestProviders>;
}

const RATING = <span data-testid="the-rating">4.3</span>;
const SELLER = <span data-testid="the-seller">Seller</span>;

/** Where a node sits in the card's own document order. */
function orderOf(testId: string): number {
  const card = screen.getByTestId("listings-serp-card");
  const nodes = [...card.querySelectorAll("[data-testid]")];
  return nodes.findIndex((n) => n.getAttribute("data-testid") === testId);
}

describe("the rating's place in the card", () => {
  it("is drawn before the price, and the price before the title", () => {
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" ratingSlot={RATING} />
      )
    );
    const rating = orderOf("the-rating");
    const price = orderOf("listings-serp-price");
    const title = orderOf("listings-serp-title");
    expect(rating).toBeGreaterThanOrEqual(0);
    expect(rating).toBeLessThan(price);
    expect(price).toBeLessThan(title);
  });

  it("is not inside the card's anchor", () => {
    render(
      providers(
        <ListingSerpCard listing={CARD} href="/l/7" ratingSlot={RATING} />
      )
    );
    // The anchor is what opens the listing; a rating that links to reviews
    // cannot live inside it.
    const anchor = screen.getByTestId("listings-serp-open");
    expect(anchor.querySelector("[data-testid='the-rating']")).toBeNull();
    expect(screen.getByTestId("the-rating")).toBeTruthy();
  });

  it("draws nothing at all when the host has no rating to give", () => {
    // An unrated seller must cost no row and no empty stars — the absence is
    // the answer, not a zero.
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    expect(screen.queryByTestId("listings-serp-rating")).toBeNull();
  });

  it("leaves the seller slot where it was, at the bottom", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          ratingSlot={RATING}
          sellerSlot={SELLER}
          sellerSlotPosition="below"
        />
      )
    );
    // The two slots are independent: moving the rating up must not drag the
    // name with it, which is the whole reason there are two.
    expect(orderOf("the-rating")).toBeLessThan(orderOf("listings-serp-price"));
    expect(orderOf("the-seller")).toBeGreaterThan(orderOf("listings-serp-title"));
  });
});
