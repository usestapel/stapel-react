/**
 * THE TITLE IS THE PAGE'S H1 — when the host says the pane IS the page.
 *
 * The pane drew the listing title at `h3` unconditionally. That is right for a
 * pane mounted inside a page that already carries its own `h1`, and wrong for
 * the route where this pane is the whole page: measured on a live storefront,
 * the listing page's document had no `h1` at all, and the workaround was an
 * offscreen heading stacked above the pane — a second title, invisible, for
 * the machines only.
 *
 * Only the host knows which of the two it built, so the host says. What this
 * suite pins is that the answer reaches the actual heading ELEMENT — the
 * outline is made of tag names, not of styles — and that a pane given nothing
 * is byte-for-byte the `h3` it has always been.
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { ListingDetailPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { detail, statusInfo } from "./fixtures.js";

function mount(node: ReactElement): void {
  const srv = mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
  render(<TestProviders server={srv}>{node}</TestProviders>);
}

async function titleTag(): Promise<string> {
  await waitFor(() => {
    expect(screen.getByTestId("listings-detail-title").textContent).toBe(
      "Bosch GSB 1200"
    );
  });
  return screen.getByTestId("listings-detail-title").tagName.toLowerCase();
}

describe("<ListingDetailPane headingLevel>", () => {
  it("is an h3 when the host says nothing — every existing mount unchanged", async () => {
    mount(<ListingDetailPane id={7} />);
    expect(await titleTag()).toBe("h3");
  });

  it("becomes the page's h1 when the host says the pane is the page", async () => {
    mount(<ListingDetailPane id={7} headingLevel={1} />);
    expect(await titleTag()).toBe("h1");
    // One h1, and it is the title: the document outline now starts at the
    // thing the page is about, with no offscreen stand-in above it.
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("takes h2 as well — a pane under a host's own page heading", async () => {
    mount(<ListingDetailPane id={7} headingLevel={2} />);
    expect(await titleTag()).toBe("h2");
  });

  it("keeps the level in the split layout, where the price leads at h2", async () => {
    mount(<ListingDetailPane id={7} layout="split" headingLevel={1} />);
    expect(await titleTag()).toBe("h1");
    // The price's own level is a LAYOUT decision (see the pane's comment) and
    // is not dragged around by this prop — the title just stops outranking it
    // the wrong way round.
    expect(screen.getByTestId("listings-detail-price").tagName.toLowerCase()).toBe(
      "h2"
    );
  });
});
