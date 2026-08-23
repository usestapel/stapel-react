import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import {
  createI18n,
  interpolate,
  pluralCategory,
  I18nProvider,
  useT,
  useTPlural,
} from "../src/i18n.js";
import type { I18nEngine } from "../src/i18n.js";

describe("interpolate", () => {
  it("substitutes {param} placeholders", () => {
    expect(
      interpolate("Hello, {name}! {count} new messages.", {
        name: "Ada",
        count: 3,
      })
    ).toBe("Hello, Ada! 3 new messages.");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("Hi {name}", {})).toBe("Hi {name}");
    expect(interpolate("Hi {name}", undefined)).toBe("Hi {name}");
  });
});

/** A bundle minus the `stapel.*` floor `createI18n` seeds into every locale. */
function withoutCoreFloor(bundle: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(bundle).filter(([key]) => !key.startsWith("stapel."))
  );
}

describe("createI18n", () => {
  it("translates from static bundles with params", () => {
    const i18n = createI18n({
      locale: "en",
      bundles: {
        en: { "auth.otp.invalid": "Invalid code, {attempts_left} tries left" },
      },
    });
    expect(i18n.t("auth.otp.invalid", { attempts_left: 2 })).toBe(
      "Invalid code, 2 tries left"
    );
  });

  it("falls back to the key itself for missing keys", () => {
    const i18n = createI18n({ locale: "en", bundles: { en: {} } });
    expect(i18n.t("billing.plan.title")).toBe("billing.plan.title");
  });

  it("loads locales through the async loader seam (translate.resolve)", async () => {
    const requested: string[] = [];
    const i18n = createI18n({
      locale: "en",
      bundles: { en: { greeting: "Hello" } },
      loadLocale: async (locale) => {
        requested.push(locale);
        return { greeting: locale === "de" ? "Hallo" : "?" };
      },
    });
    expect(i18n.t("greeting")).toBe("Hello");
    await i18n.setLocale("de");
    expect(i18n.locale).toBe("de");
    expect(i18n.t("greeting")).toBe("Hallo");
    expect(requested).toEqual(["de"]);

    // loader is called once per locale
    await i18n.setLocale("en");
    await i18n.setLocale("de");
    expect(requested).toEqual(["de", "en"]);
  });

  it("merges registered bundles per locale", () => {
    const i18n = createI18n({ locale: "en", bundles: { en: { a: "A" } } });
    i18n.registerBundle("en", { b: "B" });
    expect(i18n.t("a")).toBe("A");
    expect(i18n.t("b")).toBe("B");
  });

  // Every bundle a locale is touched for also carries core's own error floor
  // (`./i18n/coreErrors.ts`, seeded by createI18n) — asserted on its own in
  // `coreErrorFloor.test.ts`, and subtracted here so these stay about merging.
  it("getBundle returns the merged flat dictionary for a locale", () => {
    const i18n = createI18n({ locale: "en", bundles: { en: { a: "A" }, fr: { a: "Le A" } } });
    i18n.registerBundle("en", { b: "B" });
    expect(withoutCoreFloor(i18n.getBundle("en"))).toEqual({ a: "A", b: "B" });
    expect(withoutCoreFloor(i18n.getBundle("fr"))).toEqual({ a: "Le A" });
  });

  it("getBundle defaults to the current locale, and returns {} for one nothing registered", () => {
    const i18n = createI18n({ locale: "en", bundles: { en: { a: "A" } } });
    expect(withoutCoreFloor(i18n.getBundle())).toEqual({ a: "A" });
    expect(i18n.getBundle("de")).toEqual({});
  });
});

function wrapperFor(i18n: I18nEngine) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <I18nProvider i18n={i18n}>{props.children}</I18nProvider>;
  };
}

describe("useT", () => {
  it("translates and re-renders on locale change", async () => {
    const i18n = createI18n({
      locale: "en",
      bundles: {
        en: { "cart.items": "{count} items" },
        de: { "cart.items": "{count} Artikel" },
      },
    });
    const { result } = renderHook(() => useT(), {
      wrapper: wrapperFor(i18n),
    });
    expect(result.current("cart.items", { count: 2 })).toBe("2 items");

    await act(async () => {
      await i18n.setLocale("de");
    });
    expect(result.current("cart.items", { count: 2 })).toBe("2 Artikel");
  });

  it("returns the key for missing translations", () => {
    const i18n = createI18n({ locale: "en" });
    const { result } = renderHook(() => useT(), {
      wrapper: wrapperFor(i18n),
    });
    expect(result.current("profiles.title")).toBe("profiles.title");
  });

  it("throws without a provider", () => {
    expect(() => renderHook(() => useT())).toThrowError(
      /within an <I18nProvider>/
    );
  });
});

/**
 * The plural mechanism, stated as tests because the runtime and the lint have
 * to agree on it: a family is `<key>.<CLDR category>` flat keys, rendered
 * through `tPlural`, and which categories exist is `Intl.PluralRules`' answer
 * about the language rather than the catalogue's.
 */
describe("pluralCategory", () => {
  it("gives English two forms and Russian four", () => {
    expect(pluralCategory("en", 1)).toBe("one");
    expect(pluralCategory("en", 0)).toBe("other");
    expect(pluralCategory("en", 21)).toBe("other");

    expect(pluralCategory("ru", 1)).toBe("one");
    expect(pluralCategory("ru", 21)).toBe("one");
    expect(pluralCategory("ru", 3)).toBe("few");
    expect(pluralCategory("ru", 11)).toBe("many");
    expect(pluralCategory("ru", 100)).toBe("many");
  });

  it("degrades an unusable locale tag to English instead of throwing", () => {
    expect(pluralCategory("not a locale", 1)).toBe("one");
  });
});

describe("tPlural", () => {
  const RU = {
    "search.results.count_exact.one": "{count} объявление",
    "search.results.count_exact.few": "{count} объявления",
    "search.results.count_exact.many": "{count} объявлений",
    "search.results.count_exact.other": "{count} объявления",
  };

  it("picks the Russian category and interpolates the count", () => {
    const i18n = createI18n({ locale: "ru", bundles: { ru: RU } });
    expect(i18n.tPlural("search.results.count_exact", { count: 1 })).toBe(
      "1 объявление"
    );
    expect(i18n.tPlural("search.results.count_exact", { count: 3 })).toBe(
      "3 объявления"
    );
    expect(i18n.tPlural("search.results.count_exact", { count: 17 })).toBe(
      "17 объявлений"
    );
  });

  it("falls back to `other` for a category this bundle does not ship", () => {
    const i18n = createI18n({
      locale: "ru",
      bundles: { ru: { "cart.items.other": "{count} шт." } },
    });
    expect(i18n.tPlural("cart.items", { count: 1 })).toBe("1 шт.");
  });

  it("still renders a family a host catalogued as one flat string", () => {
    const i18n = createI18n({
      locale: "en",
      bundles: { en: { "cart.items": "{count} items" } },
    });
    expect(i18n.tPlural("cart.items", { count: 1 })).toBe("1 items");
  });

  it("falls back to the key itself when nothing is catalogued", () => {
    const i18n = createI18n({ locale: "en" });
    expect(i18n.tPlural("cart.items", { count: 2 })).toBe("cart.items");
  });

  it("carries the other params through", () => {
    const i18n = createI18n({
      locale: "en",
      bundles: { en: { "cart.left.other": "{count} of {total} left" } },
    });
    expect(i18n.tPlural("cart.left", { count: 2, total: 9 })).toBe(
      "2 of 9 left"
    );
  });
});

describe("useTPlural", () => {
  it("re-renders on a locale change, and the CATEGORY SET changes with it", async () => {
    const i18n = createI18n({
      locale: "en",
      bundles: {
        en: {
          "cart.items.one": "{count} item",
          "cart.items.other": "{count} items",
        },
        ru: {
          "cart.items.one": "{count} товар",
          "cart.items.few": "{count} товара",
          "cart.items.many": "{count} товаров",
          "cart.items.other": "{count} товара",
        },
      },
    });
    const { result } = renderHook(() => useTPlural(), {
      wrapper: wrapperFor(i18n),
    });
    expect(result.current("cart.items", { count: 1 })).toBe("1 item");
    expect(result.current("cart.items", { count: 3 })).toBe("3 items");

    await act(async () => {
      await i18n.setLocale("ru");
    });
    // 3 is `few` in Russian and `other` in English — the same number, a
    // different form, because the rules came from the locale.
    expect(result.current("cart.items", { count: 3 })).toBe("3 товара");
    expect(result.current("cart.items", { count: 5 })).toBe("5 товаров");
  });

  it("throws without a provider", () => {
    expect(() => renderHook(() => useTPlural())).toThrowError(
      /within an <I18nProvider>/
    );
  });
});
