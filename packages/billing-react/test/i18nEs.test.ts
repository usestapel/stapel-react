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
 * The es locale contour of the pair (i18n-shipping.md §2/§3) — now a full
 * mirror of the ru contour.
 *
 * Until wave B this suite asserted the INVERSION: Spanish covered the backend
 * error registry but none of the pair-owned UI keys, so every visible string
 * in the wallet and the shop fell through to English and a Spanish-speaking
 * customer read Spanish refusals inside an English screen. That was a
 * declared, tested state with a note saying whoever wrote the copy would flip
 * these assertions on purpose. This is that flip: the assertions below now
 * demand SPANISH for every pair-owned key, and the en floor stays underneath
 * only as the guarantee that a future key added without a translation
 * degrades to English rather than to a raw key.
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

describe("declared coverage: Spanish errors AND Spanish UI (no raw keys)", () => {
  it("every registry code resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerBillingI18nEs(i18n);
    await i18n.setLocale("es");
    const code = codeWithoutParams();
    expect(i18n.t(code)).toBe(billingErrorBundleEs[code]);
  });

  it("every pair-owned UI key resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerBillingI18n(i18n);
    registerBillingI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(BILLING_I18N_KEYS)) {
      const es = billingI18nBundleEs[key];
      // Present: the bundle carries the key at all.
      expect(es, key).toBeTruthy();
      // Reached: registration order puts it above the en floor.
      expect(i18n.t(key), key).toBe(es);
      // And never the raw key — the failure this whole contour exists to
      // make impossible.
      expect(i18n.t(key), key).not.toBe(key);
    }
  });

  it("the es UI copy is not the English text wearing a Spanish label", () => {
    // A bundle that "covers" every key by copying the en string would pass a
    // key-set comparison and ship an English screen. Keys whose text is
    // legitimately identical across the two languages (a bare placeholder,
    // a proper noun) are the exception, so this asserts the SHAPE of the
    // coverage — the overwhelming majority differ — rather than every key.
    const uiKeys = Object.values(BILLING_I18N_KEYS);
    const differing = uiKeys.filter(
      (key) => billingI18nBundleEs[key] !== billingI18nBundleEn[key]
    );
    expect(differing.length).toBeGreaterThan(uiKeys.length - 3);
  });

  it("every es UI text preserves the {param} slots its en text declares", () => {
    // A translation that drops a placeholder renders a sentence with a hole
    // in it — "créditos caducan el" with no date. Cheap to check, and the
    // exact drift a hand-written bundle acquires over time.
    for (const key of Object.values(BILLING_I18N_KEYS)) {
      const en = billingI18nBundleEn[key];
      const es = billingI18nBundleEs[key];
      if (typeof en !== "string" || typeof es !== "string") continue;
      expect(paramsOf(es).sort(), key).toEqual(paramsOf(en).sort());
    }
  });

  it("every plural family ships its es CLDR categories", () => {
    // `tPlural` looks up `<key>.<category>` first; a family that ships only
    // the flat key silently renders the `other` form for a count of one.
    const families = Object.values(BILLING_I18N_KEYS).filter(
      (key) => `${key}.other` in billingI18nBundleEn
    );
    expect(families.length).toBeGreaterThan(0);
    for (const family of families) {
      // `es` uses exactly one/other (CLDR).
      expect(billingI18nBundleEs[`${family}.one`], family).toBeTruthy();
      expect(billingI18nBundleEs[`${family}.other`], family).toBeTruthy();
    }
  });

  it("the es bundle covers the error codes AND the pair's UI keys", () => {
    const uiKeys = new Set<string>(Object.values(BILLING_I18N_KEYS));
    const carried = Object.keys(billingI18nBundleEs).filter((k) => uiKeys.has(k));
    expect(carried.sort()).toEqual([...uiKeys].sort());
    for (const code of BILLING_ERROR_CODES) {
      expect(billingI18nBundleEs[code], code).toBeTruthy();
    }
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
