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
    // Ukrainian short-i and ye letters expand to two Latin letters ("yi",
    // "ye") per the storefront contract (see contract block below), rather
    // than folding to the plain vowel.
    expect(slugify("їжак ґанок ўзор")).toBe("yizhak-ganok-uzor");
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

/**
 * Shared contract with a consuming storefront's address contract: that consumer
 * refused to adopt this export until every case below passed byte for byte
 * (notably shcha expanding to "shch", not the old "sch"). Copied verbatim so
 * the two sides can't drift again.
 */
describe("slugify (storefront address contract)", () => {
  it("transliterates word by word and joins with hyphens", () => {
    expect(slugify("Стол с электроподъёмом, светлый")).toBe(
      "stol-s-elektropodyomom-svetlyy"
    );
  });

  it("spells the letters a reader expects, not a matcher's folding", () => {
    expect(slugify("Ёжик")).toBe("yozhik");
    expect(slugify("Юля")).toBe("yulya");
    expect(slugify("Подъезд")).toBe("podezd");
    expect(slugify("Щётка")).toBe("shchyotka");
  });

  it("leaves a Latin title alone but for case and punctuation", () => {
    expect(slugify("Toyota Camry 2019")).toBe("toyota-camry-2019");
    expect(slugify("Škoda Octavia")).toBe("skoda-octavia");
  });

  it("drops everything that is not a letter or a digit", () => {
    expect(slugify("iPhone 15 Pro (256 ГБ) — как новый!")).toBe(
      "iphone-15-pro-256-gb-kak-novyy"
    );
  });

  it("answers an empty slug when nothing readable survives", () => {
    expect(slugify("🙂🙂🙂")).toBe("");
    expect(slugify("   ")).toBe("");
    expect(slugify("")).toBe("");
  });

  it("cuts at 60 characters on a word boundary", () => {
    const slug = slugify(
      "Продам стол с электроподъёмом светлый почти новый доставка бесплатно"
    );
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toBe(
      "prodam-stol-s-elektropodyomom-svetlyy-pochti-novyy-dostavka"
    );
  });

  it("cuts INSIDE a single word too long to keep, rather than answering nothing", () => {
    const slug = slugify("a".repeat(80));
    expect(slug).toBe("a".repeat(60));
  });

  it("spells the Ukrainian letters the contract wants: shch, yi, ye", () => {
    expect(slugify("борщ")).toBe("borshch");
    expect(slugify("їжак")).toBe("yizhak");
    expect(slugify("єдність")).toBe("yednist");
  });
});
