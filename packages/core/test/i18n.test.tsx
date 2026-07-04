import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { createI18n, interpolate, I18nProvider, useT } from "../src/i18n.js";
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
