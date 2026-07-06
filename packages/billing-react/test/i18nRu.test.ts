// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { BILLING_ERRORS, BILLING_ERROR_CODES } from "../src/i18n/errorsMap.js";
import {
  BILLING_I18N_KEYS,
  billingI18nBundleEn,
  registerBillingI18n,
} from "../src/i18n/keys.js";
import {
  billingErrorBundleRu,
  billingI18nBundleRu,
  registerBillingI18nRu,
} from "../src/i18n/ru.js";

/**
 * The ru locale contour of the pair (i18n-shipping.md волна 2, following the
 * auth-react etalon волна 1): the generated `errors.ru.gen.ts` bundle covers
 * the whole backend registry with `{param}` slots intact, the `./i18n/ru`
 * subpath layers per the merge-priority convention (en floor under ru —
 * degradation to English, never to a raw key), locale switching is live
 * through core's i18n engine, and the locale stays OUT of the main entry's
 * module graph.
 */

const PKG_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function paramsOf(text: string): string[] {
  const seen: string[] = [];
  for (const m of text.matchAll(/\{(\w+)\}/g)) {
    const name = m[1] as string;
    if (!seen.includes(name)) seen.push(name);
  }
  return seen;
}

describe("generated ru error bundle", () => {
  it("covers exactly the backend registry (every code, nothing else)", () => {
    expect(Object.keys(billingErrorBundleRu).sort()).toEqual(
      [...BILLING_ERROR_CODES].sort()
    );
  });

  it("every ru text preserves the canon's {param} slots", () => {
    for (const code of BILLING_ERROR_CODES) {
      expect(paramsOf(billingErrorBundleRu[code]).sort(), code).toEqual(
        [...BILLING_ERRORS[code].params].sort()
      );
    }
  });

  it("param-bearing keys interpolate in ru", () => {
    const i18n = createI18n({ locale: "ru" });
    registerBillingI18nRu(i18n);
    const text = i18n.t("error.400.field.max_length", {
      field: "amount",
      max_length: 10,
    });
    expect(text).toContain("amount");
    expect(text).toContain("10");
    expect(text).not.toContain("{field}");
    expect(text).not.toContain("{max_length}");
  });
});

describe("ru bundle covers the pair's UI keys", () => {
  it("every BILLING_I18N_KEYS value has a ru text", () => {
    const missing = Object.values(BILLING_I18N_KEYS).filter(
      (key) => !(key in billingI18nBundleRu)
    );
    expect(missing).toEqual([]);
  });

  it("ui {param} slots match the en copy", () => {
    for (const key of Object.values(BILLING_I18N_KEYS)) {
      expect(paramsOf(billingI18nBundleRu[key] ?? "").sort(), key).toEqual(
        paramsOf(billingI18nBundleEn[key] ?? "").sort()
      );
    }
  });
});

describe("locale switching through the core engine", () => {
  it("setLocale('ru') switches texts; back to en restores them", async () => {
    const i18n = createI18n({ locale: "en" });
    registerBillingI18n(i18n); // en floor + polish under "en"
    registerBillingI18nRu(i18n); // ru locale from the subpath

    const enBefore = i18n.t("billing.error.unknown");
    expect(enBefore).toBe(billingI18nBundleEn["billing.error.unknown"]);
    await i18n.setLocale("ru");
    expect(i18n.t("billing.error.unknown")).toBe(
      billingI18nBundleRu["billing.error.unknown"]
    );
    expect(i18n.t("billing.wallet.balance")).toBe("Баланс");
    await i18n.setLocale("en");
    expect(i18n.t("billing.wallet.balance")).toBe(
      billingI18nBundleEn["billing.wallet.balance"]
    );
  });

  it("a missing ru key degrades to its ENGLISH text, never to a raw key", async () => {
    // Simulate future drift: a ru bundle that misses one key. The register
    // helper's layering (en floor UNDER ru — merge-priority convention) is
    // exactly what guarantees the degradation.
    const { "billing.subscription.manage": _dropped, ...partialRu } = billingI18nBundleRu;
    const i18n = createI18n({ locale: "en" });
    i18n.registerBundle("ru", billingI18nBundleEn);
    i18n.registerBundle("ru", partialRu);
    await i18n.setLocale("ru");
    expect(i18n.t("billing.subscription.manage")).toBe(
      billingI18nBundleEn["billing.subscription.manage"]
    );
  });

  it("a host bundle registered AFTER the pair's ru wins (override without a fork)", async () => {
    const i18n = createI18n({ locale: "en" });
    registerBillingI18nRu(i18n);
    i18n.registerBundle("ru", { "billing.error.unknown": "Ошибка (кастом)" });
    await i18n.setLocale("ru");
    expect(i18n.t("billing.error.unknown")).toBe("Ошибка (кастом)");
  });
});

describe("tree-shake purity: ru is NOT in the main entry", () => {
  it("dist/index.js module graph never reaches the ru modules", () => {
    // Walk the compiled ESM graph from the main entry (what a host bundler
    // pulls for `import ... from "@stapel/billing-react"`). The size-limit
    // gate (main entry byte-budget unchanged by the locale) is the second
    // lock.
    const entry = resolve(PKG_DIR, "dist/index.js");
    const seen = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(
        /(?:^|\n)\s*(?:import|export)[^"']*from\s*["'](\.[^"']+)["']/g
      )) {
        queue.push(resolve(dirname(file), m[1] as string));
      }
    }
    const leaked = [...seen].filter((f) => /i18n\/(ru|generated\/errors\.ru)/.test(f));
    expect(leaked).toEqual([]);
    // Sanity: the walker actually traversed the graph.
    expect(seen.size).toBeGreaterThan(5);
  });

  it("index.ts source does not import the ru subpath", () => {
    const src = readFileSync(resolve(PKG_DIR, "src/index.ts"), "utf8");
    expect(src).not.toMatch(/i18n\/ru/);
    expect(src).not.toMatch(/errors\.ru\.gen/);
  });
});
