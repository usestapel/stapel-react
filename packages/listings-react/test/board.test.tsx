/**
 * `<ListingBoardPane>` — the default grid for a category page.
 *
 * `CategoryPage` showed "Slot renderListings is not filled" in every
 * storefront without a search module (Tier-0 e2e D5). The pane reads the
 * public board narrowed to the category subtree (stapel-listings 0.27.0
 * `?category_id=`).
 */
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ListingBoardPane } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { PAGE } from "./fixtures.js";

describe("<ListingBoardPane>", () => {
  it("asks the board for the category subtree and draws its cards", async () => {
    const server = mockServer({ "/listings/": { body: PAGE } });
    render(
      <TestProviders server={server}>
        <ListingBoardPane categoryIds={["7", "8"]} hrefFor={(id) => `/l/${String(id)}`} />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("listings-board-grid")).toBeTruthy());
    expect(screen.getByText("Bosch GSB 1200")).toBeTruthy();
    const read = server.calls.find((call) => new URL(call.url).pathname.endsWith("/listings/"));
    expect(new URL(read?.url ?? "http://x").searchParams.get("category_id")).toBe("7,8");
  });

  it("names an empty category instead of drawing nothing", async () => {
    const server = mockServer({
      "/listings/": { body: { ...PAGE, items: [], count: 0 } },
    });
    render(
      <TestProviders server={server}>
        <ListingBoardPane categoryIds={["9"]} />
      </TestProviders>
    );
    await waitFor(() => expect(screen.getByTestId("listings-board-empty")).toBeTruthy());
    expect(screen.getByText("No listings here yet")).toBeTruthy();
  });
});
