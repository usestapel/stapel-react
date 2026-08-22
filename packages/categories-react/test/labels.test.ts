/**
 * NAMES ARE TRANSLATION KEYS — the claim this pair makes loudest, tested.
 *
 * The wire fact behind every assertion here: `stapel-categories` stores keys
 * and never owns a catalogue (`translation.py`), and its `DISPLAY_TRANSLATOR`
 * seam is called from `Category.__str__` and the admin label cache only — no
 * serializer runs it. A category's `name` therefore arrives as
 * `category.electronics` even on a deployment with a real translator wired.
 */
import { describe, expect, it } from "vitest";
import {
  categoryLabel,
  featureLabel,
  featureOptionsAreKeys,
  renderCategoryLabel,
} from "../src/index.js";
import {
  ELECTRONICS,
  FEATURE_BRAND,
  FEATURE_CLOSED_SET,
  FEATURE_POWER,
  FEATURE_WARRANTY,
  PHONES,
  categoryRow,
} from "./fixtures.js";

const t = (key: string): string =>
  ({ "category.electronics": "Electronics" })[key] ?? key;

describe("a category's name", () => {
  it("is a KEY when translatable is true", () => {
    expect(categoryLabel(ELECTRONICS)).toEqual({
      kind: "key",
      value: "category.electronics",
    });
  });

  it("is a KEY when translatable is absent — the model default is true", () => {
    // Guessing "literal" for an absent flag is the wrong-way-round failure: it
    // prints `category.electronics` at a visitor on a translated deployment.
    const row = categoryRow(50, "x", "category.x", null, "", "");
    const { translatable: _dropped, ...withoutFlag } = row;
    expect(categoryLabel(withoutFlag as typeof row).kind).toBe("key");
  });

  it("is a LITERAL when the row opted out", () => {
    const row = categoryRow(51, "y", "Second Hand", null, "", "", {
      translatable: false,
    });
    expect(categoryLabel(row)).toEqual({ kind: "literal", value: "Second Hand" });
  });
});

describe("a feature's name", () => {
  it("is a KEY under translate all/title", () => {
    expect(featureLabel(FEATURE_BRAND).kind).toBe("key");
    expect(featureLabel(FEATURE_POWER).kind).toBe("key");
  });

  it("is a LITERAL under translate: none", () => {
    expect(featureLabel(FEATURE_WARRANTY)).toEqual({
      kind: "literal",
      value: "Warranty (raw label)",
    });
  });

  it("falls back to the slug exactly as the server does", () => {
    expect(featureLabel({ slug: "unnamed" }).value).toBe("unnamed");
  });
});

describe("a feature's option labels", () => {
  it("are keys only under translate: all", () => {
    expect(featureOptionsAreKeys(FEATURE_BRAND)).toBe(true);
    // `title` translates the name and nothing else.
    expect(featureOptionsAreKeys(FEATURE_POWER)).toBe(false);
    expect(featureOptionsAreKeys(FEATURE_WARRANTY)).toBe(false);
  });

  it("are literals when the config opted out with translatable_options:false", () => {
    // Translating an opted-out option shows the raw key; NOT translating an
    // opted-in one shows the raw key too. Same symptom, opposite fix.
    expect(featureOptionsAreKeys(FEATURE_CLOSED_SET)).toBe(false);
  });
});

describe("rendering", () => {
  it("resolves a key through the host's translator", () => {
    expect(renderCategoryLabel(categoryLabel(ELECTRONICS), t)).toBe("Electronics");
  });

  it("prints a literal untouched", () => {
    const row = categoryRow(52, "z", "category.electronics", null, "", "", {
      translatable: false,
    });
    // Even though `t` KNOWS this string, the row said it is not a key.
    expect(renderCategoryLabel(categoryLabel(row), t)).toBe(
      "category.electronics"
    );
  });

  it("shows the KEY when nothing resolves it", () => {
    // Deliberate. A visible `category.phones` gets fixed; a prettified
    // "Phones" invented by the library ships for a year in the wrong language.
    expect(renderCategoryLabel(categoryLabel(PHONES), t)).toBe(
      "category.phones"
    );
  });
});
