/**
 * A buyer typing Cyrillic has to be able to find a Latin make.
 *
 * The autocatalog holds 418 makes, spelled the way the manufacturer spells
 * them. `String.includes` over those captions answers "no" to every query a
 * Russian keyboard produces, which is the box not working for the half of the
 * buyers it was built for.
 */
import { describe, expect, it } from "vitest";
import { consonantKey, translitKey, translitPrefixMatch } from "../src/index.js";

describe("the two keys", () => {
  it("transliterates Cyrillic into the Latin the catalogue is spelled in", () => {
    expect(translitKey("Тойота")).toBe("toiota");
    expect(translitKey("Хонда")).toBe("honda");
    expect(translitKey("Land Rover")).toBe("landrover");
  });

  it("folds diacritics, so Škoda and Skoda are one word", () => {
    expect(translitKey("Škoda")).toBe(translitKey("Skoda"));
  });

  it("keeps digits and drops everything that is not a letter", () => {
    expect(translitKey("BMW X5!")).toBe("bmwx5");
  });

  it("strips the vowels the two scripts disagree about", () => {
    expect(consonantKey("Timberland")).toBe("tmbrlnd");
    expect(consonantKey("тимберленд")).toBe("tmbrlnd");
    expect(consonantKey("Toyota")).toBe(consonantKey("тойота"));
  });
});

describe("a typed prefix finds the value across alphabets", () => {
  it("matches the two cases the spec names", () => {
    expect(translitPrefixMatch("тимберленд", "Timberland")).toBe(true);
    expect(translitPrefixMatch("тойота", "Toyota")).toBe(true);
  });

  it("narrows while you are still typing", () => {
    for (const typed of ["т", "то", "той", "тойо"]) {
      expect(translitPrefixMatch(typed, "Toyota")).toBe(true);
    }
  });

  it("works in the other direction too — Latin typed at a Cyrillic value", () => {
    expect(translitPrefixMatch("honda", "Хонда")).toBe(true);
    expect(translitPrefixMatch("moskva", "Москва")).toBe(true);
  });

  it("is a PREFIX rule, so a substring does not drag in the whole catalogue", () => {
    expect(translitPrefixMatch("all", "Great Wall")).toBe(false);
    expect(translitPrefixMatch("wall", "Great Wall")).toBe(true);
  });

  it("matches on any WORD of the value", () => {
    expect(translitPrefixMatch("ровер", "Land Rover")).toBe(true);
    expect(translitPrefixMatch("rover", "Land Rover")).toBe(true);
  });

  it("says no to a value that shares nothing with the query", () => {
    expect(translitPrefixMatch("тойота", "Mercedes-Benz")).toBe(false);
    expect(translitPrefixMatch("bmw", "Toyota")).toBe(false);
  });

  it("an empty query is not a filter", () => {
    expect(translitPrefixMatch("", "Toyota")).toBe(true);
    expect(translitPrefixMatch("   ", "Toyota")).toBe(true);
  });
});
