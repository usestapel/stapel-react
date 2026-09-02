/**
 * THE LISTING PAGE HAS A DESKTOP.
 *
 * Measured on a live classified deployment at 1440×900: the whole listing
 * page was a ~930px single column hugging the start edge, the price a 22px
 * line UNDER the title and smaller than it, and the right half of the screen
 * was empty — while the reference design for this page is two columns:
 * gallery + description + specs on the left, a sticky buy column on the
 * right with the price LARGE at its top, then the actions, then the seller
 * block.
 *
 * jsdom lays nothing out, so this suite asserts the two things a DOM can
 * decide — which column holds what, in what order, and the rule text itself
 * (the grid template, the sticky position) — the same bargain
 * desktopSerpRow.test.tsx strikes with the card row.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { ListingDetailPane } from "../src/default/index.js";
import {
  DETAIL_MEASURE,
  DETAIL_SPLIT_ASIDE,
  DETAIL_SPLIT_MEASURE,
} from "../src/default/ListingDetailPane.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/** Does `b` come after `a` in the document? */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

/** A third spec row, so the two-column split has an odd count to divide. */
const THREE_FEATURES = [
  ...detail().features,
  {
    slug: "weight",
    type: "int" as const,
    value: 3,
    name: "Weight",
    order: 3,
    postfix: "kg",
  },
];

function server() {
  return mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail({ features: THREE_FEATURES }) },
  });
}

function pane(node: ReactElement): ReactElement {
  return <TestProviders server={server()}>{node}</TestProviders>;
}

describe("the default layout is the one column it always was", () => {
  it("mounts no split grid and keeps the reading measure", async () => {
    const { container } = render(pane(<ListingDetailPane id={7} />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-split")).toBeNull();
    expect(screen.queryByTestId("listings-detail-buy-column")).toBeNull();
    const root = container.querySelector<HTMLElement>("[data-stapel-skin-root]");
    expect(root?.style.maxWidth).toBe(DETAIL_MEASURE);
    // The phone column's order: the price still follows the title.
    expect(
      precedes(
        screen.getByTestId("listings-detail-title"),
        screen.getByTestId("listings-detail-price")
      )
    ).toBe(true);
  });

  it("puts a column-layout aside where the footer's flow already is", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          aside={<div data-testid="host-seller-block">seller</div>}
          footer={<div data-testid="host-footer">footer</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-seller-block")).toBeTruthy();
    });
    // No buy column to live in, so the aside joins the end of the reading
    // flow, directly above the footer that was already there.
    expect(screen.queryByTestId("listings-detail-buy-column")).toBeNull();
    expect(
      precedes(
        screen.getByTestId("host-seller-block"),
        screen.getByTestId("host-footer")
      )
    ).toBe(true);
  });
});

describe("the split layout is the reference design's two columns", () => {
  it("draws the grid, widens the measure, and pins the buy column", async () => {
    const { container } = render(
      pane(<ListingDetailPane id={7} layout="split" />)
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-split")).toBeTruthy();
    });
    const split = screen.getByTestId("listings-detail-split");
    expect(split.style.gridTemplateColumns).toBe(
      `minmax(0, 1fr) ${DETAIL_SPLIT_ASIDE}`
    );
    const buy = screen.getByTestId("listings-detail-buy-column");
    expect(buy.style.position).toBe("sticky");
    expect(buy.style.alignSelf).toBe("start");
    // A split needs more line than a one-column read: the measure widens.
    const root = container.querySelector<HTMLElement>("[data-stapel-skin-root]");
    expect(root?.style.maxWidth).toBe(DETAIL_SPLIT_MEASURE);
  });

  it("puts the price LARGE at the top of the buy column, above the actions and the aside", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          aside={<div data-testid="host-seller-block">seller</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-buy-column")).toBeTruthy();
    });
    const buy = screen.getByTestId("listings-detail-buy-column");
    const price = screen.getByTestId("listings-detail-price");
    const actions = screen.getByTestId("listings-detail-actions");
    const aside = screen.getByTestId("listings-detail-aside");
    // The right column, top to bottom: price, actions, seller block.
    expect(buy.contains(price)).toBe(true);
    expect(buy.contains(actions)).toBe(true);
    expect(buy.contains(aside)).toBe(true);
    expect(precedes(price, actions)).toBe(true);
    expect(precedes(actions, aside)).toBe(true);
    // LARGE means larger than the title, not the 22px line measured under
    // it: a level-2 heading against the title's level 3.
    expect(price.tagName).toBe("H2");
    expect(screen.getByTestId("listings-detail-title").tagName).toBe("H3");
  });

  it("keeps the reading matter — gallery, description, specs, footer — in the left column", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          footer={<div data-testid="host-footer">footer</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-buy-column")).toBeTruthy();
    });
    const buy = screen.getByTestId("listings-detail-buy-column");
    for (const testId of [
      "listings-detail-gallery",
      "listings-detail-title",
      "listings-detail-description",
      "host-footer",
    ]) {
      const el = screen.getByTestId(testId);
      expect(screen.getByTestId("listings-detail-split").contains(el)).toBe(true);
      expect(buy.contains(el)).toBe(false);
    }
  });

  it("splits the specs into two lists, read top-to-bottom left column first", async () => {
    render(pane(<ListingDetailPane id={7} layout="split" />));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-specs-split")).toBeTruthy();
    });
    // Three rows over two columns: the FIRST half (rounded up) fills the
    // left list, so category declaration order survives the split.
    const lists = screen
      .getByTestId("listings-detail-specs-split")
      .querySelectorAll("[data-testid='attributes-value-list']");
    expect(lists).toHaveLength(2);
    const left = lists[0]?.textContent ?? "";
    const right = lists[1]?.textContent ?? "";
    expect(left).toContain("Condition");
    expect(left).toContain("Power");
    expect(left).not.toContain("Weight");
    expect(right).toContain("Weight");
  });
});
