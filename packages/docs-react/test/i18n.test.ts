/**
 * Locale parity, in both directions, over BOTH halves of the bundle.
 *
 * The pair shipped English only: ~90 UI strings and 84 backend error codes
 * that rendered in the middle of a Russian or Spanish product as English —
 * a failure invisible to every test that runs in one locale, which is all of
 * them unless one is written on purpose. This is that one.
 *
 * stapel-docs ships `translations/errors.{ru,es}.json`, so the generated
 * bundles cover every registry code including the 32 the module owns; nothing
 * is hand-authored for the error half here. The UI half is the pair's own.
 */
import { describe, expect, it } from "vitest";
import { createI18n } from "@stapel/core";
import {
  DOCS_ERROR_CODES,
  DOCS_I18N_KEYS,
  docsI18nBundleEn,
  registerDocsI18n,
} from "../src/index.js";
import { docsI18nBundleRu, registerDocsI18nRu } from "../src/i18n/ru.js";
import { docsI18nBundleEs, registerDocsI18nEs } from "../src/i18n/es.js";

/** Codes stapel-docs itself raises — the ones a generic HTTP floor cannot
 * cover, and the reason the empty map was the pair's worst gap. */
const DOCS_OWNED = DOCS_ERROR_CODES.filter((code) => code.includes(".docs_"));

function engineFor(locale: "en" | "ru" | "es") {
  const engine = createI18n({ locale });
  registerDocsI18n(engine);
  if (locale === "ru") registerDocsI18nRu(engine);
  if (locale === "es") registerDocsI18nEs(engine);
  return engine;
}

describe("the backend registry actually reaches the pair", () => {
  it("carries all 85 codes, including the ones only this module raises", () => {
    expect(DOCS_ERROR_CODES.length).toBe(85);
    expect(DOCS_OWNED.length).toBe(43);
    // 0.7.0: the crdt write door refuses a corrupt Y payload by name.
    expect(DOCS_ERROR_CODES).toContain("error.400.docs_invalid_crdt_payload");
    // The two the audit named: a lost save race and an exhausted workspace
    // used to be the same sentence ("Something went wrong").
    expect(DOCS_ERROR_CODES).toContain("error.409.docs_seq_conflict");
    expect(DOCS_ERROR_CODES).toContain("error.507.docs_workspace_quota");
  });
});

describe.each(["en", "ru", "es"] as const)("locale %s", (locale) => {
  const engine = engineFor(locale);

  it("resolves every backend error code to a sentence, not to the key", () => {
    for (const code of DOCS_ERROR_CODES) {
      const text = engine.t(code);
      expect(text, code).not.toBe(code);
      expect(text.length, code).toBeGreaterThan(0);
    }
  });

  it("resolves every UI key the pair declares", () => {
    for (const key of Object.values(DOCS_I18N_KEYS)) {
      const text = engine.t(key);
      expect(text, key).not.toBe(key);
      expect(text.length, key).toBeGreaterThan(0);
    }
  });
});

describe("key-set parity, in both directions", () => {
  const uiKeys = (bundle: Record<string, unknown>): string[] =>
    Object.keys(bundle)
      .filter((key) => key.startsWith("docs."))
      .sort();

  it("ru and es declare exactly the UI keys en declares", () => {
    const en = uiKeys(docsI18nBundleEn);
    expect(uiKeys(docsI18nBundleRu)).toEqual(en);
    expect(uiKeys(docsI18nBundleEs)).toEqual(en);
    // Every key of the public table is in the bundle, and nothing else is.
    expect(en).toEqual([...new Set(Object.values(DOCS_I18N_KEYS))].sort());
  });

  it("the locales were TRANSLATED, not copied", () => {
    // A locale file that ships the English text under a Russian name is the
    // failure this rule exists for; a handful of keys legitimately match
    // (proper nouns like "Markdown"), so the assertion is on the bulk.
    const en = uiKeys(docsI18nBundleEn);
    const identical = en.filter(
      (key) => docsI18nBundleRu[key] === docsI18nBundleEn[key]
    );
    expect(identical.length / en.length).toBeLessThan(0.1);
  });
});
