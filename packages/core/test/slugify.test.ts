import { describe, expect, it } from "vitest";
import { slugify } from "../src/slugify.js";

describe("slugify", () => {
  it("keeps digits and drops punctuation from a Latin title", () => {
    expect(slugify("Toyota Camry 2.5 AT, 2019")).toBe("toyota-camry-2-5-at-2019");
  });

  it("transliterates Russian, including ё and й, per word", () => {
    expect(slugify("Стол с электроподъёмом, светлый")).toBe(
      "stol-s-elektropodyomom-svetlyy"
    );
  });

  it("lowercases a mixed Latin/Cyrillic title", () => {
    expect(slugify("iPhone 15 Pro Max 256 ГБ")).toBe("iphone-15-pro-max-256-gb");
  });

  it("returns empty for an empty string", () => {
    expect(slugify("")).toBe("");
  });

  it("returns empty for punctuation-only input", () => {
    expect(slugify("!!! ??? ,,,")).toBe("");
  });

  it("never leaves leading, trailing or doubled hyphens", () => {
    expect(slugify("  --Hello__World--  ")).toBe("hello-world");
  });

  it("transliterates the extra Ukrainian/Belarusian/Kazakh letters", () => {
    expect(slugify("їжак ґанок ўзор")).toBe("izhak-ganok-uzor");
    expect(slugify("әні ғұрыптық қалаңай өрт ұлы үй һасил")).toBe(
      "ani-guryptyq-qalanay-ort-uly-uy-hasil"
    );
  });

  it("folds Latin diacritics without disturbing precomposed Cyrillic", () => {
    expect(slugify("café Zürich")).toBe("cafe-zurich");
  });

  it("cuts at a word boundary under the default 60-char budget", () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    const result = slugify(words);
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("-")).toBe(false);
    // every remaining word is whole, not chopped mid-token
    for (const chunk of result.split("-")) {
      expect(words).toContain(chunk);
    }
  });

  it("respects a custom maxLength, cutting on a word boundary", () => {
    expect(slugify("one two three four", { maxLength: 8 })).toBe("one-two");
  });

  it("hard-cuts a single word longer than maxLength", () => {
    expect(slugify("supercalifragilisticexpialidocious", { maxLength: 10 })).toBe(
      "supercalif"
    );
  });
});
