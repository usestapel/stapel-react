import { fileURLToPath } from "node:url";
import rule from "../rules/i18n-locale-parity.js";
import { tsxTester } from "./helpers.js";

const tester = tsxTester();

// The rule reads the SIBLINGS of the file it is given, so these cases need
// real files. They live in test/fixtures/i18n-parity/<case>/src/i18n/ and hold
// only the locale bundles — the `en` half is supplied inline as `code`, which
// is what a pair's keys.ts is.
const FIXTURES = fileURLToPath(new URL("./fixtures/i18n-parity/", import.meta.url));
const keysOf = (name) => `${FIXTURES}${name}/src/i18n/keys.ts`;

const EN = [
  "export const demoI18nBundleEn = {",
  "  ...demoErrorBundleEn,",
  '  "demo.title": "Page title",',
  '  "demo.subtitle": "A detailed description of the screen for the reader",',
  "};",
].join("\n");

tester.run("i18n-locale-parity", rule, {
  valid: [
    // ru and es both carry both keys, both translated.
    { filename: keysOf("complete"), code: EN },
    // Not the anchor file: the rule runs once per pair, on keys.ts.
    { filename: `${FIXTURES}missing-key/src/i18n/ru.ts`, code: EN },
    { filename: "/repo/packages/auth-react/src/model/session.ts", code: EN },
    // An anchor with no `en` bundle has nothing to mirror.
    {
      filename: keysOf("complete"),
      code: "export const DEMO_I18N_KEYS = { title: 'demo.title' };",
    },
    // A locale the pair does not ship is not this rule's business.
    {
      filename: keysOf("no-es"),
      code: EN,
      options: [{ locales: ["ru"] }],
    },
    // A short identical string is a plausible cognate ("OK", "Email", "PIN"),
    // not a copy-paste placeholder — the floor is what keeps this rule from
    // reporting every two-word label in a Latin-script locale.
    {
      filename: keysOf("untranslated"),
      code: 'export const demoI18nBundleEn = { "demo.ok": "OK" };',
      options: [{ locales: ["es"], reportExtra: false }],
    },
  ],
  invalid: [
    {
      // The 11-pair case: a locale file that was never written. This is the
      // finding a per-pair test helper structurally cannot make — the pair
      // that skipped the locale also skipped the test.
      filename: keysOf("no-es"),
      code: EN,
      errors: [{ messageId: "missingLocale" }],
    },
    {
      // A key that exists in en and not in ru: at runtime the ru host renders
      // the English sentence, silently, with a green suite behind it.
      filename: keysOf("missing-key"),
      code: EN,
      errors: [{ messageId: "missingKey" }],
    },
    {
      // A rename left behind (or a typo that will never resolve).
      filename: keysOf("extra-key"),
      code: EN,
      errors: [{ messageId: "extraKey" }],
    },
    {
      // Key sets match; the es VALUE is the English sentence. Every parity
      // check that compares only key sets calls this green.
      filename: keysOf("untranslated"),
      code: EN,
      options: [{ locales: ["es"], reportExtra: false }],
      errors: [{ messageId: "untranslated" }],
    },
    {
      // `reportExtra: false` keeps the missing half and drops the extra half.
      filename: keysOf("extra-key"),
      code: EN.replace(
        '  "demo.subtitle": "A detailed description of the screen for the reader",',
        '  "demo.subtitle": "A detailed description of the screen for the reader",\n  "demo.footer": "Footer",'
      ),
      options: [{ reportExtra: false, locales: ["ru"] }],
      errors: [{ messageId: "missingKey" }],
    },
  ],
});

// ── One decision, one report ─────────────────────────────────────────────────
// auth-react's `es.ts` ships the generated backend error texts and translates
// none of the pair's 267 UI keys — deliberately, and documented in the file's
// own header. That is ONE decision; reporting it 267 times would bury every
// other finding in a fleet sweep under one pair's backlog.
tester.run("i18n-locale-parity — a wholly untranslated bundle", rule, {
  valid: [],
  invalid: [
    {
      filename: keysOf("complete"),
      // No key of this en bundle exists in either locale file.
      code: 'export const demoI18nBundleEn = { "other.a": "A sentence here", "other.b": "Another one" };',
      options: [{ locales: ["ru"] }],
      errors: [{ messageId: "untranslatedBundle" }],
    },
  ],
});

// ── Plural categories are a fact about the LANGUAGE ──────────────────────────
// English catalogues `one`/`other`; Russian also needs `few` and `many`. Six
// such keys in search-react looked like six renames left behind, and were six
// translations being right.
tester.run("i18n-locale-parity — CLDR plural categories", rule, {
  valid: [
    {
      filename: `${FIXTURES}plural/src/i18n/keys.ts`,
      code:
        "export const demoI18nBundleEn = {" +
        ' "demo.count.one": "One result", "demo.count.other": "{n} results" };',
      options: [{ locales: ["ru"] }],
    },
  ],
  invalid: [
    {
      // A family the locale does not carry AT ALL is still a finding.
      filename: `${FIXTURES}plural/src/i18n/keys.ts`,
      code:
        "export const demoI18nBundleEn = {" +
        ' "demo.count.one": "One result",' +
        ' "demo.total.one": "One", "demo.total.other": "{n}" };',
      options: [{ locales: ["ru"], reportExtra: false }],
      errors: [{ messageId: "missingKey" }, { messageId: "missingKey" }],
    },
  ],
});
