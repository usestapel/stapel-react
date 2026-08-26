// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { AUTH_ERRORS, AUTH_ERROR_CODES } from "../src/i18n/errorsMap.js";
import type { AuthErrorCode } from "../src/i18n/errorsMap.js";
import {
  AUTH_I18N_KEYS,
  authI18nBundleEn,
  registerAuthI18n,
} from "../src/i18n/keys.js";
import {
  authErrorBundleEs,
  authI18nBundleEs,
  registerAuthI18nEs,
} from "../src/i18n/es.js";

/**
 * The es locale contour of the pair (i18n-shipping.md §2/§3), the same shape as
 * the ru contour: the generated `errors.es.gen.ts` bundle covers the whole
 * backend registry with `{param}` slots intact, the hand-written Spanish UI copy
 * covers every pair-owned key on top of it, the `./i18n/es` subpath layers per
 * the merge-priority convention (en floor under es — degradation to English,
 * never to a raw key), locale switching is live through core's i18n engine, and
 * the locale stays OUT of the main entry's module graph.
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
function codeWithParams(): AuthErrorCode {
  for (const code of AUTH_ERROR_CODES) {
    if (AUTH_ERRORS[code].params.length > 0) return code;
  }
  throw new Error("no param-bearing error code in the registry");
}

/** First registry code with no interpolation — safe to compare verbatim. */
function codeWithoutParams(): AuthErrorCode {
  for (const code of AUTH_ERROR_CODES) {
    if (AUTH_ERRORS[code].params.length === 0) return code;
  }
  throw new Error("no param-free error code in the registry");
}

describe("generated es error bundle", () => {
  it("covers exactly the backend registry (every code, nothing else)", () => {
    expect(Object.keys(authErrorBundleEs).sort()).toEqual(
      [...AUTH_ERROR_CODES].sort()
    );
  });

  it("every es text preserves the canon's {param} slots", () => {
    for (const code of AUTH_ERROR_CODES) {
      expect(paramsOf(authErrorBundleEs[code]).sort(), code).toEqual(
        [...AUTH_ERRORS[code].params].sort()
      );
    }
  });

  it("param-bearing keys interpolate in es", async () => {
    const code = codeWithParams();
    const params = Object.fromEntries(
      AUTH_ERRORS[code].params.map((name, i) => [name, `v${i}`])
    );
    const i18n = createI18n({ locale: "en" });
    registerAuthI18nEs(i18n);
    await i18n.setLocale("es");
    const text = i18n.t(code, params);
    for (const name of AUTH_ERRORS[code].params) {
      expect(text).not.toContain(`{${name}}`);
    }
    expect(text).toContain("v0");
  });
});

describe("declared coverage: Spanish errors AND Spanish UI (no raw keys)", () => {
  it("every registry code resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerAuthI18nEs(i18n);
    await i18n.setLocale("es");
    const code = codeWithoutParams();
    expect(i18n.t(code)).toBe(authErrorBundleEs[code]);
  });

  it("every pair-owned UI key resolves to its SPANISH text under locale es — never a raw key", async () => {
    const i18n = createI18n({ locale: "en" });
    registerAuthI18n(i18n);
    registerAuthI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(AUTH_I18N_KEYS)) {
      const resolved = i18n.t(key);
      expect(resolved, key).not.toBe(key);
      expect(resolved.length, key).toBeGreaterThan(0);
      expect(resolved, key).toBe(authI18nBundleEs[key]);
    }
  });

  it("the es bundle carries every UI key, with the en {param} slots intact", () => {
    const missing = Object.values(AUTH_I18N_KEYS).filter(
      (key) => !(key in authI18nBundleEs)
    );
    expect(missing).toEqual([]);
    for (const key of Object.values(AUTH_I18N_KEYS)) {
      expect(paramsOf(authI18nBundleEs[key] ?? "").sort(), key).toEqual(
        paramsOf(authI18nBundleEn[key] ?? "").sort()
      );
    }
  });
});

describe("locale switching through the core engine", () => {
  it("setLocale('es') switches error texts; back to en restores them", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerAuthI18n(i18n); // en floor + polish under "en"
    registerAuthI18nEs(i18n); // es locale from the subpath

    expect(i18n.t(code)).toBe(authI18nBundleEn[code] ?? i18n.t(code));
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe(authErrorBundleEs[code]);
    await i18n.setLocale("en");
    expect(i18n.t(code)).not.toBe(authErrorBundleEs[code]);
  });

  it("a host bundle registered AFTER the pair's es wins (override without a fork)", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerAuthI18nEs(i18n);
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
