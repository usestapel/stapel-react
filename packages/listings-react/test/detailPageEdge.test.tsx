/**
 * THE PAGE EDGE, AND WHERE THE SELLER SITS ON A PHONE.
 *
 * Two host-measured defects of the one-column arm, both of them about
 * position rather than about data:
 *
 *  - the pane painted a flat `spacing[4]` gutter INSIDE a shell that had
 *    already placed the page edge with `--stapel-page-gutter`, so a desktop
 *    read at 40px from the frame and a 360px phone lost a ninth of its width
 *    to two stacked gutters. The host worked around it by negatively
 *    margining the pane back out;
 *  - the seller block landed at the very end of the reading flow, two
 *    screens of description, specs and meta below the button that messages
 *    that same seller — while the split layout has read price → actions →
 *    seller since it shipped.
 *
 * jsdom lays nothing out, so what is asserted here is what a DOM can decide:
 * the rule text on the skin root, and the order of the nodes.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { spacing } from "@stapel/tokens";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

/** Does `b` come after `a` in the document? */
function precedes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

function pane(node: ReactElement): ReactElement {
  return (
    <TestProviders
      server={mockServer({
        "/listings/7/status/": { body: statusInfo() },
        "/listings/7/": { body: detail() },
      })}
    >
      {node}
    </TestProviders>
  );
}

async function skinRoot(node: ReactElement): Promise<HTMLElement> {
  const { container } = render(pane(node));
  await waitFor(() => {
    expect(screen.getByTestId("listings-detail-title")).toBeTruthy();
  });
  const root = container.querySelector<HTMLElement>("[data-stapel-skin-root]");
  expect(root).toBeTruthy();
  return root as HTMLElement;
}

describe("who owns the page edge", () => {
  it("keeps its own gutter by default — the pane on a bare route", async () => {
    const root = await skinRoot(<ListingDetailPane id={7} />);
    expect(root.style.padding).toBe(`${String(spacing[4])}px`);
  });

  it("keeps its own gutter when the host says so explicitly", async () => {
    const root = await skinRoot(<ListingDetailPane id={7} gutter="own" />);
    expect(root.style.padding).toBe(`${String(spacing[4])}px`);
  });

  it("adds NO second gutter inside a shell that already placed one", async () => {
    const root = await skinRoot(<ListingDetailPane id={7} gutter="shell" />);
    expect(root.style.padding).toBe("0px");
  });

  it("leaves the reading measure alone either way — the edge is not the width", async () => {
    const own = await skinRoot(<ListingDetailPane id={7} />);
    const shell = await skinRoot(<ListingDetailPane id={7} gutter="shell" />);
    expect(shell.style.maxWidth).toBe(own.style.maxWidth);
  });
});

describe("where the seller block sits in the one column", () => {
  it("ends the reading flow by default, exactly as before", async () => {
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
    expect(
      precedes(
        screen.getByTestId("listings-detail-description"),
        screen.getByTestId("host-seller-block")
      )
    ).toBe(true);
    expect(
      precedes(
        screen.getByTestId("host-seller-block"),
        screen.getByTestId("host-footer")
      )
    ).toBe(true);
  });

  it("sits directly under the actions when the host asks for it", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          asidePlacement="after-actions"
          aside={<div data-testid="host-seller-block">seller</div>}
          footer={<div data-testid="host-footer">footer</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("host-seller-block")).toBeTruthy();
    });
    const seller = screen.getByTestId("host-seller-block");
    // Under the actions — the other half of the same decision — and ABOVE the
    // description, which is what moves it off the bottom of a phone page.
    expect(
      precedes(screen.getByTestId("listings-detail-actions"), seller)
    ).toBe(true);
    expect(
      precedes(seller, screen.getByTestId("listings-detail-description"))
    ).toBe(true);
    // Still rendered exactly once, and the footer is still last.
    expect(screen.getAllByTestId("host-seller-block")).toHaveLength(1);
    expect(precedes(seller, screen.getByTestId("host-footer"))).toBe(true);
  });

  it("is ignored by the split, whose buy column already reads that way", async () => {
    render(
      pane(
        <ListingDetailPane
          id={7}
          layout="split"
          asidePlacement="after-actions"
          aside={<div data-testid="host-seller-block">seller</div>}
        />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-buy-column")).toBeTruthy();
    });
    expect(
      screen
        .getByTestId("listings-detail-buy-column")
        .contains(screen.getByTestId("host-seller-block"))
    ).toBe(true);
  });
});
