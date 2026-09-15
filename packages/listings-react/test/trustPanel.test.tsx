/**
 * THE SELLER-TRUST PANEL, AND THE CLAIM IT MUST NOT MAKE.
 *
 * The reference fills its 980px results row with a photo, the text lines, and
 * a 220px panel on the trailing edge: the seller's name, a one-line rating,
 * two badges and both verbs.
 *
 * The badges are the part these cases exist for. The reference's wording
 * asserts facts about a seller — documents checked, a reliability grade — that
 * a deployment may not hold, so this pair ships the SHAPE and never the claim.
 * A host that cannot name the fact behind a badge passes none, and the panel
 * must then draw none: no placeholder, no reserved box, nothing that reads as
 * a verification we cannot substantiate.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingSerpCard } from "../src/default/index.js";
import { CARD_PANEL_WIDTH, cardTargetCss } from "../src/default/ListingCard.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(node: ReactElement): ReactElement {
  return <TestProviders server={mockServer({})}>{node}</TestProviders>;
}

describe("the panel draws only what the host can name", () => {
  it("draws NO badge block when the host passes none", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          trustPanel={{
            seller: <span>Seller</span>,
            rating: <span>5,0 · 765</span>,
            actions: <button type="button">Write</button>,
          }}
        />
      )
    );
    // Everything the host DID name is drawn…
    expect(screen.getByTestId("listings-serp-panel-seller")).toBeTruthy();
    expect(screen.getByTestId("listings-serp-panel-rating")).toBeTruthy();
    expect(screen.getByTestId("listings-serp-panel-actions")).toBeTruthy();
    // …and the badge container is ABSENT, not empty. An empty box still
    // reserves height and still reads as "a verification is coming".
    expect(screen.queryByTestId("listings-serp-panel-badges")).toBeNull();
  });

  it("draws an empty `badges` array as nothing, not as a box", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          trustPanel={{ seller: <span>Seller</span>, badges: [] }}
        />
      )
    );
    expect(screen.queryByTestId("listings-serp-panel-badges")).toBeNull();
  });

  it("draws the badges a host CAN substantiate, in the order given", () => {
    render(
      providers(
        <ListingSerpCard
          listing={CARD}
          href="/l/7"
          trustPanel={{
            badges: [
              <span key="a">Checked A</span>,
              <span key="b">Checked B</span>,
            ],
          }}
        />
      )
    );
    const badges = screen.getByTestId("listings-serp-panel-badges");
    const drawn = Array.from(badges.children).map((c) => c.textContent);
    expect(drawn).toEqual(["Checked A", "Checked B"]);
  });

  it("gives the panel a FIXED column, not a flexible remainder", () => {
    // A remainder makes the panel's width a function of the title's length,
    // so the verbs change size row to row. The reference's is 220px flat.
    expect(CARD_PANEL_WIDTH).toBe(220);
    const css = cardTargetCss();
    expect(css).toContain(`flex:0 0 ${String(CARD_PANEL_WIDTH)}px`);
    expect(css).toContain(`inline-size:${String(CARD_PANEL_WIDTH)}px`);
  });

  it("applies that width only in the ROW arm, and outranks antd", () => {
    const css = cardTargetCss();
    // Below the row threshold the card is a stacked tile; a 220px column
    // beside a 260px card is not a layout.
    expect(css).toContain("@container (min-width:560px)");
    // The standing lesson of this package: a single class ties antd's
    // runtime-injected sheet and loses on order.
    expect(css).toContain(".stapel-listing-card-panel.stapel-listing-card-panel");
  });
});

describe("the panel is absent rather than empty", () => {
  it("renders no panel at all when the host passes none", () => {
    render(providers(<ListingSerpCard listing={CARD} href="/l/7" />));
    expect(screen.queryByTestId("listings-serp-panel")).toBeNull();
  });
});
