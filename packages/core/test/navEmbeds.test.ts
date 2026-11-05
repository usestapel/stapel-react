import { describe, expect, it } from "vitest";
import { embedsForPage, resolveEmbedProps } from "../src/index.js";
import type { NavEmbed } from "../src/index.js";

const addToCart: NavEmbed = {
  id: "orders.add_to_cart",
  slot: "page.actions",
  component: { export: "AddToCartButton", subpath: "default" },
  order: 10,
  scope: { navEntry: "listings.detail" },
  routeProps: { purchasableKey: "id" },
  props: { purchasableType: "listing" },
};

describe("resolveEmbedProps", () => {
  it("merges static props with the page's route params", () => {
    expect(resolveEmbedProps(addToCart, { id: "42" })).toEqual({
      purchasableType: "listing",
      purchasableKey: "42",
    });
  });

  it("is null when a mapped param is absent or empty", () => {
    expect(resolveEmbedProps(addToCart, {})).toBeNull();
    expect(resolveEmbedProps(addToCart, { id: "" })).toBeNull();
  });

  it("passes static props through when nothing is mapped", () => {
    expect(resolveEmbedProps({ props: { compact: true } }, {})).toEqual({ compact: true });
  });
});

describe("embedsForPage", () => {
  const book: NavEmbed = {
    ...addToCart,
    id: "reservations.book_action",
    order: 10,
    component: { export: "BookButton", subpath: "default" },
  };
  const elsewhere: NavEmbed = { ...addToCart, id: "feed.posts", scope: { navEntry: "profiles.public" } };
  const chrome: NavEmbed = {
    id: "orders.cart_badge",
    slot: "topbar.end",
    component: { export: "CartBadge", subpath: "default" },
    order: 1,
  };

  it("keeps only the page's scoped embeds, ordered by order then id", () => {
    const ids = embedsForPage([elsewhere, chrome, book, addToCart], "listings.detail").map(
      (e) => e.id
    );
    expect(ids).toEqual(["orders.add_to_cart", "reservations.book_action"]);
  });

  it("never returns an unscoped chrome embed", () => {
    expect(embedsForPage([chrome], "listings.detail", "topbar.end")).toEqual([]);
  });
});
