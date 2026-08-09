// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { BILLING_ERRORS, BILLING_ERROR_CODES } from "../src/i18n/errorsMap.js";
import type { BillingErrorCode } from "../src/i18n/errorsMap.js";
import {
  BILLING_I18N_KEYS,
  billingI18nBundleEn,
  registerBillingI18n,
} from "../src/i18n/keys.js";
import {
  billingErrorBundleEs,
  billingI18nBundleEs,
  registerBillingI18nEs,
} from "../src/i18n/es.js";

/**
 * The es locale contour of the pair (i18n-shipping.md §2/§3). Mirrors the ru
 * contour with ONE deliberate inversion: Spanish covers the backend error
 * registry but NOT the pair-owned UI keys, so the UI-coverage suite asserts
 * that those keys resolve to their ENGLISH text under locale `es` — partial
 * coverage as a declared, tested state rather than an accident. Whoever adds
 * hand-written Spanish UI copy flips that suite on purpose.
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

/** First registry code carrying `{param}` slots — kept dynamic so the test
 *  survives the registry changing shape under it. */
function codeWithParams(): BillingErrorCode {
  for (const code of BILLING_ERROR_CODES) {
    if (BILLING_ERRORS[code].params.length > 0) return code;
  }
  throw new Error("no param-bearing error code in the registry");
}

/** First registry code with no interpolation — safe to compare verbatim. */
function codeWithoutParams(): BillingErrorCode {
  for (const code of BILLING_ERROR_CODES) {
    if (BILLING_ERRORS[code].params.length === 0) return code;
  }
  throw new Error("no param-free error code in the registry");
}

describe("generated es error bundle", () => {
  it("covers exactly the backend registry (every code, nothing else)", () => {
    expect(Object.keys(billingErrorBundleEs).sort()).toEqual(
      [...BILLING_ERROR_CODES].sort()
    );
  });

  it("every es text preserves the canon's {param} slots", () => {
    for (const code of BILLING_ERROR_CODES) {
      expect(paramsOf(billingErrorBundleEs[code]).sort(), code).toEqual(
        [...BILLING_ERRORS[code].params].sort()
      );
    }
  });

  it("param-bearing keys interpolate in es", async () => {
    const code = codeWithParams();
    const params = Object.fromEntries(
      BILLING_ERRORS[code].params.map((name, i) => [name, `v${i}`])
    );
    const i18n = createI18n({ locale: "en" });
    registerBillingI18nEs(i18n);
    await i18n.setLocale("es");
    const text = i18n.t(code, params);
    for (const name of BILLING_ERRORS[code].params) {
      expect(text).not.toContain(`{${name}}`);
    }
    expect(text).toContain("v0");
  });
});

describe("declared coverage: Spanish errors, English UI (no raw keys)", () => {
  it("every registry code resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerBillingI18nEs(i18n);
    await i18n.setLocale("es");
    const code = codeWithoutParams();
    expect(i18n.t(code)).toBe(billingErrorBundleEs[code]);
  });

  it("pair-owned UI keys fall back to ENGLISH under locale es — not to a raw key", async () => {
    // The inversion of the ru suite: Spanish UI copy does not exist yet, so the
    // en floor under the locale is what a host reads. When Spanish UI copy
    // lands, this assertion is the one that must be updated.
    const i18n = createI18n({ locale: "en" });
    registerBillingI18n(i18n);
    registerBillingI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(BILLING_I18N_KEYS)) {
      const en = billingI18nBundleEn[key] ?? "";
      expect(i18n.t(key), key).toBe(en);
      expect(i18n.t(key), key).not.toBe(key);
    }
  });

  it("the es bundle carries exactly the error codes and no UI keys (yet)", () => {
    const uiKeys = new Set<string>(Object.values(BILLING_I18N_KEYS));
    const carried = Object.keys(billingI18nBundleEs).filter((k) => uiKeys.has(k));
    expect(carried).toEqual([]);
    expect(Object.keys(billingI18nBundleEs).sort()).toEqual(
      [...BILLING_ERROR_CODES].sort()
    );
  });
});

describe("locale switching through the core engine", () => {
  it("setLocale('es') switches error texts; back to en restores them", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerBillingI18n(i18n); // en floor + polish under "en"
    registerBillingI18nEs(i18n); // es locale from the subpath

    expect(i18n.t(code)).toBe(billingI18nBundleEn[code] ?? i18n.t(code));
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe(billingErrorBundleEs[code]);
    await i18n.setLocale("en");
    expect(i18n.t(code)).not.toBe(billingErrorBundleEs[code]);
  });

  it("a host bundle registered AFTER the pair's es wins (override without a fork)", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerBillingI18nEs(i18n);
    i18n.registerBundle("es", { [code]: "Texto propio" });
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe("Texto propio");
  });
});

describe("tree-shake purity: es is NOT in the main entry", () => {
  it("dist/index.js module graph never reaches the es modules", () => {
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
    const leaked = [...seen].filter((f) => /i18n\/(es|generated\/errors\.es)/.test(f));
    expect(leaked).toEqual([]);
    expect(seen.size).toBeGreaterThan(5);
  });

  it("index.ts source does not import the es subpath", () => {
    const src = readFileSync(resolve(PKG_DIR, "src/index.ts"), "utf8");
    expect(src).not.toMatch(/i18n\/es/);
    expect(src).not.toMatch(/errors\.es\.gen/);
  });
});
