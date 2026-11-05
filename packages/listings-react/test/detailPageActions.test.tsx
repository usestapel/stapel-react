/**
 * `page.actions` on the listing page: the slot other pairs' embeds land in
 * (`@stapel/core` NavEmbed `scope: { navEntry: "listings.detail" }`), drawn
 * in the reader's buy box with the page's route params.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { resolveEmbedProps } from "@stapel/core";
import type { NavEmbed } from "@stapel/core";
import { ListingDetailPane } from "../src/default/index.js";
import type { ListingDetailPaneProps } from "../src/default/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { OWNER, STRANGER, detail, statusInfo } from "./fixtures.js";

function page(props: Partial<ListingDetailPaneProps>): ReactElement {
  const server = mockServer({
    "/listings/7/status/": { body: statusInfo() },
    "/listings/7/": { body: detail() },
  });
  return (
    <TestProviders server={server}>
      <ListingDetailPane id={7} viewerId={STRANGER} {...props} />
    </TestProviders>
  );
}

const addToCart: NavEmbed = {
  id: "orders.add_to_cart",
  slot: "page.actions",
  component: { export: "AddToCartButton", subpath: "default" },
  order: 10,
  scope: { navEntry: "listings.detail" },
  routeProps: { purchasableKey: "id" },
  props: { purchasableType: "listing" },
};

function HostAction(props: { purchasableType?: unknown; purchasableKey?: unknown }): ReactElement {
  return (
    <button data-testid="host-action" data-type={String(props.purchasableType)}>
      {String(props.purchasableKey)}
    </button>
  );
}

describe("page.actions", () => {
  it("calls a render-function slot with the route params and draws it in the buy box", async () => {
    render(
      page({
        slots: {
          "page.actions": (route) => {
            const p = resolveEmbedProps(addToCart, route);
            return p === null ? null : <HostAction {...p} />;
          },
        },
      })
    );
    const action = await screen.findByTestId("host-action");
    expect(action.textContent).toBe("7");
    expect(action.getAttribute("data-type")).toBe("listing");
    const slot = screen.getByTestId("listings-detail-page-actions");
    expect(slot.contains(action)).toBe(true);
    expect(screen.getByTestId("listings-detail-actions").contains(slot)).toBe(true);
  });

  it("draws a node slot as given", async () => {
    render(page({ slots: { "page.actions": <span data-testid="host-node">x</span> } }));
    expect(await screen.findByTestId("host-node")).toBeTruthy();
  });

  it("draws no slot wrapper when nothing fills it", async () => {
    render(page({ slots: { "page.actions": () => null } }));
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-contact")).toBeTruthy();
    });
    expect(screen.queryByTestId("listings-detail-page-actions")).toBeNull();
  });

  it("is a reader's slot: the owner's buy box does not draw it", async () => {
    render(
      page({ viewerId: OWNER, slots: { "page.actions": <span data-testid="host-node">x</span> } })
    );
    await waitFor(() => {
      expect(screen.getByTestId("listings-detail-owner-view")).toBeTruthy();
    });
    expect(screen.queryByTestId("host-node")).toBeNull();
  });
});
