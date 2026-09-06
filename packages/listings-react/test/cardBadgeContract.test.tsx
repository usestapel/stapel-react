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
import { ListingCard, ListingSerpCard } from "../src/default/index.js";
import type { ListingCard as ListingCardData } from "../src/index.js";
import {
  badgePresentation,
  captionName,
  cardBadgeText,
  cardBadgeTexts,
  hasCardBadgeContract,
} from "../src/index.js";
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

/**
 * D421 — the spec line under a card's title, measured on a live feed:
 *
 *   phones  "HONOR · Model 90 · 256 GB"  ← the caption reads as the value
 *   flats   "5 fl. · 9 fl. · 54 m²"      ← two axes, one caption, no way to
 *                                          tell the floor from the number of
 *                                          floors
 *
 * The rows below carry the copy the feed carries; the sentences here are the
 * same two lines in English.
 *
 * Both are about the LINE and neither is about the chip: a chip's border says
 * where one fact stops, and " · " does not.
 */
describe("a spec line is a run of values, not a row of chips (D421)", () => {
  const PHONE: readonly CardBadgeRow[] = [
    row({ slug: "vendor", type: "select", value: "honor", label: "HONOR", name: "Производитель", presentation: "value" }),
    row({ slug: "model", value: 90, name: "Модель", presentation: "name_value" }),
    row({ slug: "memory", value: 256, unit: "ГБ", name: "Память", presentation: "value_unit" }),
  ];

  it("marks a caption as a caption, so it cannot be read as the answer", () => {
    expect(cardBadgeTexts(PHONE, "ru", "line").map((one) => one.text)).toEqual([
      "HONOR",
      "Модель: 90",
      "256 ГБ",
    ]);
  });

  it("leaves the CHIP exactly as the 0.22 contract wrote it", () => {
    // A space and never a colon, inside a border that already separates it
    // from its neighbour. The same rows, the other surface.
    expect(cardBadgeTexts(PHONE, "ru").map((one) => one.text)).toEqual([
      "HONOR",
      "Модель 90",
      "256 ГБ",
    ]);
    expect(cardBadgeText(PHONE[1] as CardBadgeRow, "ru")).toBe("Модель 90");
  });

  const FLAT: readonly CardBadgeRow[] = [
    row({ slug: "floor", value: 5, unit: "эт.", name: "Этаж", presentation: "value_unit" }),
    row({ slug: "floors", value: 9, unit: "эт.", name: "Этажей", presentation: "value_unit" }),
    row({ slug: "area", type: "float", value: "54", unit: "м²", name: "Площадь", presentation: "value_unit" }),
  ];

  it("tells two axes wearing one unit apart, with the catalogue's own names", () => {
    expect(cardBadgeTexts(FLAT, "ru", "line").map((one) => one.text)).toEqual([
      "Этаж: 5 эт.",
      "Этажей: 9 эт.",
      // The third measures something nothing else on the line does, so it is
      // not ambiguous and is left alone.
      "54 м²",
    ]);
  });

  it("disambiguates the badge strip too — the collision is in the SET, not the layout", () => {
    expect(cardBadgeTexts(FLAT, "ru").map((one) => one.text)).toEqual([
      "Этаж 5 эт.",
      "Этажей 9 эт.",
      "54 м²",
    ]);
  });

  it("says nothing extra where a caption would not help", () => {
    // No names to caption with: printing "5 fl. · 9 fl." is bad, and printing
    // ": 5 fl. · : 9 fl." is worse. Same for one word over both axes — a
    // caption that does not tell two things apart is noise a reader still has
    // to read.
    const nameless: readonly CardBadgeRow[] = [
      row({ slug: "floor", value: 5, unit: "эт.", presentation: "value_unit" }),
      row({ slug: "floors", value: 9, unit: "эт.", presentation: "value_unit" }),
    ];
    expect(cardBadgeTexts(nameless, "ru", "line").map((one) => one.text)).toEqual([
      "5 эт.",
      "9 эт.",
    ]);
    const sameName = FLAT.slice(0, 2).map((one) => ({ ...one, name: "Этаж" }));
    expect(cardBadgeTexts(sameName, "ru", "line").map((one) => one.text)).toEqual([
      "5 эт.",
      "9 эт.",
    ]);
  });

  it("catches two unitless answers that simply read the same", () => {
    const twins: readonly CardBadgeRow[] = [
      row({ slug: "doors", value: 4, name: "Дверей", presentation: "value" }),
      row({ slug: "seats", value: 4, name: "Мест", presentation: "value" }),
    ];
    expect(cardBadgeTexts(twins, "ru", "line").map((one) => one.text)).toEqual([
      "Дверей: 4",
      "Мест: 4",
    ]);
  });

  it("draws the line through the card, not only through the model", () => {
    render(
      providers(
        <ListingSerpCard
          listing={{
            ...cardWith([]),
            features_title: FLAT as unknown as ListingCardData["features_title"],
          }}
          href="/l/7"
        />,
        "ru"
      )
    );
    expect(screen.getByTestId("listings-serp-specs-text").textContent).toBe(
      "Этаж: 5 эт. · Этажей: 9 эт. · 54 м²"
    );
  });
});

// ── D455: the catalogue's own punctuation ────────────────────────────────────

describe("a name that already ends in a colon does not get a second one", () => {
  /** Measured on a live feed: one card in twenty-four. The catalogue row for
   * this leaf spells the feature's name with the colon IN it. */
  const HONOR: readonly CardBadgeRow[] = [
    row({ slug: "vendor", type: "select", value: "honor", label: "HONOR", presentation: "value" }),
    row({ slug: "model", value: 90, name: "Модель:", presentation: "name_value" }),
    row({ slug: "memory", value: 256, unit: "ГБ", presentation: "value_unit" }),
  ];

  it("prints one colon on a line, where the surface adds its own", () => {
    expect(cardBadgeTexts(HONOR, "ru", "line").map((one) => one.text)).toEqual([
      "HONOR",
      "Модель: 90",
      "256 ГБ",
    ]);
  });

  it("prints no dangling colon in a chip, where the surface adds none", () => {
    expect(cardBadgeText(HONOR[1] as CardBadgeRow, "ru")).toBe("Модель 90");
  });

  it("draws one spelling whichever way the catalogue spelled it", () => {
    // The SAME slug arrives captioned "Model:" on one listing and "Model" on
    // the next. Two catalogue rows, one caption on screen.
    const tidy = row({ slug: "model", value: 90, name: "Модель", presentation: "name_value" });
    expect(cardBadgeText(HONOR[1] as CardBadgeRow, "ru", "line")).toBe(
      cardBadgeText(tidy, "ru", "line")
    );
  });

  it("takes the space with the colon, and only from the END", () => {
    expect(captionName("Модель :")).toBe("Модель");
    expect(captionName("Модель::")).toBe("Модель");
    // Interior punctuation is the catalogue's business and is left alone.
    expect(captionName("Модель: год")).toBe("Модель: год");
    expect(captionName("Модель")).toBe("Модель");
  });

  it("does not leave a lone colon standing as a boolean's whole badge", () => {
    // `name` presentation prints the name and nothing else, so a name that is
    // only punctuation has nothing to say — and says nothing.
    expect(
      cardBadgeText(row({ slug: "brick", value: true, name: ":", presentation: "name" }))
    ).toBeUndefined();
    expect(
      cardBadgeText(row({ slug: "brick", value: true, name: "Кирпич:", presentation: "name" }))
    ).toBe("Кирпич");
  });

  it("counts two spellings of one word as one word when disambiguating", () => {
    // Both axes wear the same unit, so the pass would caption them — but the
    // two names are the same word and a caption that does not tell them apart
    // is noise. It refuses, as it does for two literally identical names.
    const twoSpellings: readonly CardBadgeRow[] = [
      row({ slug: "floor", value: 5, unit: "эт.", name: "Этаж:", presentation: "value_unit" }),
      row({ slug: "floors", value: 9, unit: "эт.", name: "Этаж", presentation: "value_unit" }),
    ];
    expect(
      cardBadgeTexts(twoSpellings, "ru", "line").map((one) => one.text)
    ).toEqual(["5 эт.", "9 эт."]);
  });
});
