// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import { WORKSPACES_ERRORS, WORKSPACES_ERROR_CODES } from "../src/i18n/errorsMap.js";
import type { WorkspacesErrorCode } from "../src/i18n/errorsMap.js";
import {
  WORKSPACES_I18N_KEYS,
  workspacesI18nBundleEn,
  registerWorkspacesI18n,
} from "../src/i18n/keys.js";
import {
  workspacesErrorBundleEs,
  workspacesI18nBundleEs,
  registerWorkspacesI18nEs,
} from "../src/i18n/es.js";

/**
 * The es locale contour of the pair (i18n-shipping.md §2/§3). Mirrors the ru
 * contour with ONE deliberate inversion: Spanish covers the backend error
 * registry completely but the pair-owned UI keys only where hand-written copy
 * exists, so the UI-coverage suite asserts BOTH halves — the translated keys
 * resolve to Spanish, and every other key resolves to its ENGLISH text under
 * locale `es`. Partial coverage as a declared, tested state rather than an
 * accident. The split is read off the bundle, so the next Spanish string is an
 * edit to `es.ts` alone.
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
function codeWithParams(): WorkspacesErrorCode {
  for (const code of WORKSPACES_ERROR_CODES) {
    if (WORKSPACES_ERRORS[code].params.length > 0) return code;
  }
  throw new Error("no param-bearing error code in the registry");
}

/** First registry code with no interpolation — safe to compare verbatim. */
function codeWithoutParams(): WorkspacesErrorCode {
  for (const code of WORKSPACES_ERROR_CODES) {
    if (WORKSPACES_ERRORS[code].params.length === 0) return code;
  }
  throw new Error("no param-free error code in the registry");
}

describe("generated es error bundle", () => {
  it("covers exactly the backend registry (every code, nothing else)", () => {
    expect(Object.keys(workspacesErrorBundleEs).sort()).toEqual(
      [...WORKSPACES_ERROR_CODES].sort()
    );
  });

  it("every es text preserves the canon's {param} slots", () => {
    for (const code of WORKSPACES_ERROR_CODES) {
      expect(paramsOf(workspacesErrorBundleEs[code]).sort(), code).toEqual(
        [...WORKSPACES_ERRORS[code].params].sort()
      );
    }
  });

  it("param-bearing keys interpolate in es", async () => {
    const code = codeWithParams();
    const params = Object.fromEntries(
      WORKSPACES_ERRORS[code].params.map((name, i) => [name, `v${i}`])
    );
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18nEs(i18n);
    await i18n.setLocale("es");
    const text = i18n.t(code, params);
    for (const name of WORKSPACES_ERRORS[code].params) {
      expect(text).not.toContain(`{${name}}`);
    }
    expect(text).toContain("v0");
  });
});

describe("declared coverage: Spanish errors, English UI (no raw keys)", () => {
  it("every registry code resolves to its SPANISH text under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18nEs(i18n);
    await i18n.setLocale("es");
    const code = codeWithoutParams();
    expect(i18n.t(code)).toBe(workspacesErrorBundleEs[code]);
  });

  it("a pair-owned UI key WITH Spanish copy resolves to it under locale es", async () => {
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18n(i18n);
    registerWorkspacesI18nEs(i18n);
    await i18n.setLocale("es");
    const translated = Object.values(WORKSPACES_I18N_KEYS).filter(
      (key) => key in workspacesI18nBundleEs
    );
    // Partial UI coverage is the declared state, not an empty one: whatever
    // Spanish copy exists must actually reach a reader.
    expect(translated.length).toBeGreaterThan(0);
    for (const key of translated) {
      expect(i18n.t(key), key).toBe(workspacesI18nBundleEs[key]);
    }
  });

  it("every OTHER pair-owned UI key falls back to ENGLISH — not to a raw key", async () => {
    // The inversion of the ru suite: Spanish UI copy is partial, so the en
    // floor under the locale is what a host reads for the rest. The split is
    // read off the bundle, so adding the next Spanish string needs no edit here.
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18n(i18n);
    registerWorkspacesI18nEs(i18n);
    await i18n.setLocale("es");
    for (const key of Object.values(WORKSPACES_I18N_KEYS)) {
      if (key in workspacesI18nBundleEs) continue;
      const en = workspacesI18nBundleEn[key] ?? "";
      expect(i18n.t(key), key).toBe(en);
      expect(i18n.t(key), key).not.toBe(key);
    }
  });

  it("the es bundle carries every error code, plus only pair-owned UI keys", () => {
    const uiKeys = new Set<string>(Object.values(WORKSPACES_I18N_KEYS));
    // A plural family is declared ONCE in the key registry and catalogued as
    // one flat string per CLDR category, so `workspaces.members.count.one` is
    // a leaf of a declared key rather than a key of its own. Which categories
    // a language uses is a fact about the language — see keys.ts.
    const PLURAL = /\.(zero|one|two|few|many|other)$/;
    const declared = (key: string): boolean =>
      uiKeys.has(key) || (PLURAL.test(key) && uiKeys.has(key.replace(PLURAL, "")));
    const carried = Object.keys(workspacesI18nBundleEs);
    // Nothing in here that is neither a registry code nor a key this pair owns
    // — a typo'd key would otherwise sit in the bundle translating nothing.
    expect(carried.filter((k) => !declared(k)).sort()).toEqual(
      [...WORKSPACES_ERROR_CODES].sort()
    );
  });
});

describe("locale switching through the core engine", () => {
  it("setLocale('es') switches error texts; back to en restores them", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18n(i18n); // en floor + polish under "en"
    registerWorkspacesI18nEs(i18n); // es locale from the subpath

    expect(i18n.t(code)).toBe(workspacesI18nBundleEn[code] ?? i18n.t(code));
    await i18n.setLocale("es");
    expect(i18n.t(code)).toBe(workspacesErrorBundleEs[code]);
    await i18n.setLocale("en");
    expect(i18n.t(code)).not.toBe(workspacesErrorBundleEs[code]);
  });

  it("a host bundle registered AFTER the pair's es wins (override without a fork)", async () => {
    const code = codeWithoutParams();
    const i18n = createI18n({ locale: "en" });
    registerWorkspacesI18nEs(i18n);
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
