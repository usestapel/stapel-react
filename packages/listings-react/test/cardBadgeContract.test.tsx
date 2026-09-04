/**
 * The CARD BADGE CONTRACT (stapel-listings 0.21.3), and the older backend.
 *
 * The live card's badge line read "Brick · 3 · 9": three true facts about a
 * flat and two of them unreadable, because a stored `features_badges` row
 * carried the VALUE and nothing that says what the value is. The contract
 * adds `label`, `unit`, `name` and `presentation` to each element, and
 * `presentation` is the SERVER's decision — which is the whole point, since
 * the right badge depends on the category and no client heuristic gets
 * "3 rooms", "Brick" and "20 000 km" right at once.
 *
 * Four presentations, one test each, plus the two things a renderer gets
 * wrong for free: a FALSE boolean that must not print "not brick", and an
 * older backend that must render exactly as it rendered yesterday.
 */
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { render, screen } from "@testing-library/react";
import { ListingCard } from "../src/default/index.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import { badgePresentation, cardBadgeText, hasCardBadgeContract } from "../src/index.js";
import type { CardBadgeRow } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import { CARD } from "./fixtures.js";

function providers(children: ReactElement, locale?: string): ReactElement {
  return (
    <TestProviders server={mockServer({})} {...(locale !== undefined ? { locale } : {})}>
      {children}
    </TestProviders>
  );
}

function row(over: Partial<CardBadgeRow>): CardBadgeRow {
  return { slug: "x", type: "int", value: 1, ...over } as CardBadgeRow;
}

function cardWith(rows: readonly CardBadgeRow[]): ListingCardData {
  return {
    ...CARD,
    features_title: [],
    features_badges: rows as unknown as ListingCardData["features_badges"],
  };
}

describe("the four presentations", () => {
  it("`value` prints the resolved label alone", () => {
    expect(
      cardBadgeText(
        row({ slug: "wall", type: "select", value: "brick", label: "Brick", name: "Wall", presentation: "value" })
      )
    ).toBe("Brick");
  });

  it("`value_unit` prints the number, grouped, and its unit — and no name", () => {
    const text = cardBadgeText(
      row({ slug: "mileage", value: 20000, unit: "km", name: "Mileage", presentation: "value_unit" }),
      "ru"
    );
    expect(text?.endsWith("km")).toBe(true);
    expect(text).not.toContain("Mileage");
    expect(text?.replace(/[^0-9a-z]/gi, "")).toBe("20000km");
  });

  it("`name_value` prints the name and the value with a SPACE, never a colon", () => {
    expect(
      cardBadgeText(row({ slug: "floor", value: 3, name: "Floor", presentation: "name_value" }))
    ).toBe("Floor 3");
    // A named row keeps its unit: dropping it reads "Mileage 20 000".
    const withUnit = cardBadgeText(
      row({ slug: "mileage", value: 120, unit: "km", name: "Mileage", presentation: "name_value" })
    );
    expect(withUnit).toBe("Mileage 120 km");
    expect(withUnit).not.toContain(":");
  });

  it("`name` prints the name for a TRUE boolean and nothing for a false one", () => {
    const brick = row({ slug: "brick", type: "bool", value: true, name: "Brick", presentation: "name" });
    expect(cardBadgeText(brick)).toBe("Brick");
    // "Not brick" is not a selling point, and a card is a summary.
    expect(cardBadgeText({ ...brick, value: false })).toBeUndefined();
  });

  it("refuses to guess at a presentation it does not know", () => {
    // The key exists so the SERVER decides. A fifth reading invented here
    // would print one category's rule on another category's card.
    expect(badgePresentation(row({ presentation: "shout" }))).toBeUndefined();
    // …and the element still prints its value rather than vanishing.
    expect(cardBadgeText(row({ value: 3, presentation: "shout" }))).toBe("3");
  });
});

describe("the value's own typography", () => {
  it("keeps the decimals the wire stated and the reader's decimal mark", () => {
    expect(
      cardBadgeText(row({ slug: "volume", type: "float", value: "2.0", unit: "l", presentation: "value_unit" }), "ru")
    ).toBe("2,0 l");
  });

  it("prefers the server's label over the raw value", () => {
    expect(
      cardBadgeText(row({ type: "select", value: "b-u", label: "Second-hand", presentation: "value" }))
    ).toBe("Second-hand");
  });
});

describe("on a card", () => {
  it("draws the contract line when the projection speaks it", () => {
    render(
      providers(
        <ListingCard
          listing={cardWith([
            row({ slug: "wall", type: "select", value: "brick", label: "Brick", presentation: "value" }),
            row({ slug: "floor", value: 3, name: "Floor", presentation: "name_value" }),
            row({ slug: "area", type: "float", value: "9.0", unit: "m²", presentation: "value_unit" }),
          ])}
          href="/l/7"
        />
      )
    );
    const badges = screen.getByTestId("listings-card-badges");
    expect(badges.textContent).toContain("Brick");
    expect(badges.textContent).toContain("Floor 3");
    expect(badges.textContent).toContain("m²");
    // The measured defect, gone: the bare numbers are no longer alone.
    expect(screen.getByTestId("listings-card-badge-floor").textContent).toBe("Floor 3");
  });

  it("falls back to today's rendering when no element declares one", () => {
    // An older backend. `CARD`'s own badges carry no `presentation`, so the
    // card renders through `<FeatureBadges>` exactly as the last release did.
    render(providers(<ListingCard listing={CARD} href="/l/7" />));
    expect(screen.queryByTestId("listings-card-badges")).toBeNull();
    // Two of them: the title line and the badge strip, both on the old path.
    expect(screen.getAllByTestId("attributes-badges").length).toBeGreaterThan(0);
    expect(hasCardBadgeContract(CARD.features_badges as unknown as CardBadgeRow[])).toBe(false);
  });

  it("draws no badge row at all where every element has nothing to say", () => {
    render(
      providers(
        <ListingCard
          listing={cardWith([
            row({ slug: "brick", type: "bool", value: false, name: "Brick", presentation: "name" }),
          ])}
          href="/l/7"
        />
      )
    );
    expect(screen.queryByTestId("listings-card-badges")).toBeNull();
  });
});
