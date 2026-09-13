/**
 * THE TWO CALLS TO ACTION, ON A 390px PHONE.
 *
 * The reference classified reads, under the price: the seller row, then the
 * pair of verbs (message / show the phone number), then the canned questions.
 * This pane read the canned questions FIRST — four wrapping chips standing
 * between the price and the only two controls a buyer came for — and the pair
 * landed below the fold on a 390px screen. Measured on the live storefront:
 * the contact row needed a scroll on every listing.
 *
 * Two claims, and each one is a DOM order a person reads:
 *
 *  1. the contact slot comes BEFORE the chips, always — this is not a prop,
 *     it is the order the block is built in;
 *  2. `asidePlacement="before-actions"` is how the seller row leads that
 *     pair, which is the reference's own reading order and the one thing the
 *     existing two placements could not say — `"after-actions"` puts the
 *     seller UNDER the verbs and `"end"` puts it a screen further down.
 *
 * jsdom lays nothing out, so "above the fold" is asserted as what makes it
 * true: nothing but the price stands between the seller row and the verbs.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/** Does `b` come after `a` in the document? */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
}

function pane(node: ReactElement): ReactElement {
  return <TestProviders server={server()}>{node}</TestProviders>;
}

/** The pane with both halves of the reference's block: a seller row from the
 * host, and the chips the pair ships. */
function phonePage(
  asidePlacement?: "end" | "after-actions" | "before-actions"
): ReactElement {
  return pane(
    <ListingDetailPane
      id={7}
      aside={<div data-testid="host-seller-block">seller</div>}
      {...(asidePlacement !== undefined ? { asidePlacement } : {})}
      contactSlot={<button data-testid="host-contact">write</button>}
      onQuickQuestion={() => undefined}
    />
  );
}

describe("the contact pair stands above the canned questions", () => {
  it("draws the contact slot BEFORE the chips", async () => {
    render(phonePage("after-actions"));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-contact")).toBeTruthy();
    });
    const contact = screen.getByTestId("listings-detail-contact");
    const questions = screen.getByTestId("listings-detail-questions");
    expect(screen.getAllByTestId("listings-detail-question")).toHaveLength(4);
    // The whole defect in one line: the chips used to precede the verbs.
    expect(precedes(contact, questions)).toBe(true);
  });
});

describe('asidePlacement="before-actions" — the seller row leads the verbs', () => {
  it("puts the seller row under the price and directly above the contact pair", async () => {
    render(phonePage("before-actions"));
    await waitFor(() => {
      expect(screen.getByTestId("host-seller-block")).toBeTruthy();
    });
    const price = screen.getByTestId("listings-detail-price");
    const aside = screen.getByTestId("listings-detail-aside");
    const contact = screen.getByTestId("listings-detail-contact");
    const questions = screen.getByTestId("listings-detail-questions");
    expect(precedes(price, aside)).toBe(true);
    expect(precedes(aside, contact)).toBe(true);
    expect(precedes(contact, questions)).toBe(true);
    // Nothing of the page's own stands between the seller row and the verbs:
    // no description, no spec table, no meta.
    expect(
      precedes(contact, screen.getByTestId("listings-detail-description"))
    ).toBe(true);
  });

  it("leaves the two older placements exactly where they were", async () => {
    const after = render(phonePage("after-actions"));
    await waitFor(() => {
      expect(after.getByTestId("host-seller-block")).toBeTruthy();
    });
    expect(
      precedes(
        after.getByTestId("listings-detail-contact"),
        after.getByTestId("listings-detail-aside")
      )
    ).toBe(true);
    after.unmount();

    const end = render(phonePage());
    await waitFor(() => {
      expect(end.getByTestId("host-seller-block")).toBeTruthy();
    });
    // The default: the end of the reading flow, after the description.
    expect(
      precedes(
        end.getByTestId("listings-detail-description"),
        end.getByTestId("listings-detail-aside")
      )
    ).toBe(true);
  });
});
