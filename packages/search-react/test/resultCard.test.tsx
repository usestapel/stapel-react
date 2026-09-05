/**
 * The generic card's three obligations to a person reading a catalogue: the
 * price is written as money, the paid-placement marking is legible, and the
 * row is something you can tap.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { createFormat } from "@stapel/core";
import { SearchResultCard, formatCardPrice } from "../src/default/SearchResultCard.js";
import type { SearchItem } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";

const format = createFormat("en");

function item(card: Record<string, unknown>, promoted = false): SearchItem {
  return { key: "l-1", score: 1, promoted, owner_key: "", distance_km: null, card };
}

function renderCard(value: SearchItem): void {
  const server = mockServer({});
  render(
    <TestProviders server={server}>
      <SearchResultCard item={value} />
    </TestProviders>
  );
}

describe("the price is written as money, not as a wire value", () => {
  it("groups the amount and uses the currency's own symbol", () => {
    const written = formatCardPrice(format, "3200", "RUB");
    // The one thing that must NOT survive: the bare pair "3200 RUB".
    expect(written).not.toBe("3200 RUB");
    expect(written).toContain("3,200");
    expect(written).not.toContain("RUB");
  });

  it("adds no cents to a whole amount and keeps them on a fractional one", () => {
    expect(formatCardPrice(format, "1500", "EUR")).not.toContain(".00");
    expect(formatCardPrice(format, "1500.5", "EUR")).toContain(".50");
  });

  it("passes a non-numeric price through untouched", () => {
    // A doc type may store "on request"; turning that into NaN loses what the
    // seller wrote.
    expect(formatCardPrice(format, "on request", "RUB")).toBe("on request");
  });

  it("falls back to a grouped number plus the code for a currency it cannot use", () => {
    const written = formatCardPrice(format, "3200", "XX");
    expect(written).toBe("3,200 XX");
  });

  it("renders the formatted price on the card", () => {
    renderCard(item({ title: "Bosch GSB 13 RE", price: "3200", currency: "RUB" }));
    const price = screen.getByTestId("search-result-price").textContent ?? "";
    expect(price).not.toBe("3200 RUB");
    expect(price).toContain("3,200");
  });
});

describe("the DSA marking is legible and the card is tappable", () => {
  it("paints the marking with the readable warning role, not the on-fill one", () => {
    renderCard(item({ title: "Bosch" }, true));
    const tag = screen.getByTestId("search-result-promoted");
    // `warning-on` is white over the SOLID warning fill; over `warning-bg` it
    // was cream on cream — the one legally mandated string in the package.
    expect(tag.getAttribute("style")).toContain("var(--stapel-warning)");
    expect(tag.getAttribute("style")).not.toContain("var(--stapel-warning-on)");
    expect(screen.getByTestId("search-result-promoted-hint")).toBeTruthy();
  });

  it("makes the whole row one link when the doc type stores a url", () => {
    renderCard(item({ title: "Bosch", price: "3200", currency: "RUB", url: "/l/1" }));
    const link = screen.getByTestId("search-result-link");
    expect(link.getAttribute("href")).toBe("/l/1");
    // The title and the price are INSIDE it — a link around the title alone
    // is a tap target the width of a word.
    expect(link.textContent).toContain("Bosch");
    expect(link.querySelector('[data-testid="search-result-price"]')).toBeTruthy();
  });

  it("invents no destination when the doc type stores none", () => {
    renderCard(item({ title: "Bosch" }));
    expect(screen.queryByTestId("search-result-link")).toBeNull();
  });
});
