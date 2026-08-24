// stapel/i18n-locale-parity — every key the pair defines exists in every
// locale the pair ships.
//
// ── WHY THIS IS A LINT RULE AND NOT A TEST HELPER ───────────────────────────
//
// The obvious implementation is a vitest helper: `expectLocaleParity(en, ru,
// es)`, exported from this package, imported by each pair's
// `test/i18n.test.ts`. It is also the implementation that has already failed
// once. Eight of nineteen pairs carry an ad-hoc `test/i18n*.test.ts` today and
// eleven do not, which is exactly what "one line of per-pair wiring" produces
// over a year: the pairs that needed the gate least wrote it, and the ones
// that skipped it are the ones missing locale files (gdpr and video have no
// `es.ts`; calendar, docs, recordings and shell-react have neither `ru` nor
// `es`). A gate that has to be adopted is not a gate; it is a suggestion with
// a test runner attached.
//
// The requirement was: it must run for every pair with zero wiring beyond
// `recommended`. Only ESLint can do that here. The root `eslint.config.mjs`
// spreads `stapel.configs.recommended` once, every package's `lint` script is
// `eslint .`, and every pair has a `src/i18n/keys.ts`. So the rule ANCHORS on
// that file — the one file that is guaranteed to exist — and reads its
// siblings. A missing `es.ts` is then a finding rather than a silence, which
// it could never be if the check lived in a test that the pair without the
// locale also never wrote.
//
// ── THE COST, STATED PLAINLY ────────────────────────────────────────────────
//
// ESLint reports on the file it is linting. A key missing from `ru.ts` is
// therefore reported at its DEFINITION in `keys.ts`, with the offending locale
// named in the message, not at the place in `ru.ts` where the line should go.
// That is the trade for zero wiring, and it is the right way round: the
// definition site is where a person adding a key is already standing, and it
// is the only site that exists when the locale file does not.
//
// The sibling files are read as TEXT, not parsed. A locale bundle is a flat
// object of `"key": "copy"` pairs (plus a spread of the generated backend
// error bundle), and a line-anchored scan of quoted keys reads it exactly.
// Pulling a second parser into a lint rule to read a data file would buy
// nothing but a dependency and a class of crash.
//
// ── WHAT IS CHECKED ─────────────────────────────────────────────────────────
//
//   missingKey     a key in the `en` bundle that no `<locale>.ts` defines
//   missingLocale  a declared locale with no file at all
//   extraKey       a key in a locale bundle that `en` does not define (a
//                  rename left behind, or a typo that will never resolve)
//   untranslated   a locale value byte-identical to the English one, for a
//                  string long enough that the coincidence is not plausible
//
// SPREADS ARE IGNORED ON BOTH SIDES. `...authErrorBundleEn` /
// `...authErrorBundleRu` are generated from the backend's error catalog, where
// coverage is guaranteed by construction and enforced by that generator; the
// keys they contribute are not written by hand on either side and comparing
// them here would report the generator's business as the pair's.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizedFilename } from "../lib/jsx.js";

const DEFAULT_LOCALES = ["ru", "es"];
/**
 * The CLDR plural categories. WHICH of these a language uses is a fact about
 * the LANGUAGE, not about the pair: English catalogues `one`/`other`, Russian
 * needs `few` and `many` as well. So a plural FAMILY has to match across
 * locales and its CATEGORIES must not — `search.results.count_exact.few` is
 * present in ru and absent in en because Russian has a paucal, which is the
 * translation being right, not a key being wrong. (`i18n-key-exists` makes the
 * same distinction from the other side, where `other` is the only category a
 * static check may demand.)
 */
const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

/** `["a.b.count", "few"]` for a plural leaf, else null. */
function pluralParts(key) {
  const dot = key.lastIndexOf(".");
  if (dot <= 0) return null;
  const category = key.slice(dot + 1);
  return PLURAL_CATEGORIES.has(category) ? [key.slice(0, dot), category] : null;
}

/** True when some key in `keys` belongs to the plural family `family`. */
function hasPluralFamily(keys, family) {
  for (const category of PLURAL_CATEGORIES) {
    if (keys.has(`${family}.${category}`)) return true;
  }
  return false;
}
/** Below this, an identical string is plausibly a real cognate ("Email", "OK"). */
const DEFAULT_UNTRANSLATED_FLOOR = 16;

/** Object-literal keys, line-anchored so a key inside prose is never picked up. */
const KEY_RE = /^[ \t]*(?:"([^"\n]+)"|'([^'\n]+)')\s*:/gm;
/** A whole `"key": "value",` pair on one line — the only shape we compare values for. */
const PAIR_RE = /^[ \t]*"([^"\n]+)"\s*:\s*"((?:[^"\\\n]|\\.)*)"\s*,?[ \t]*$/gm;

function readLocale(file) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    return null;
  }
  const keys = new Set();
  for (const match of text.matchAll(KEY_RE)) {
    keys.add(match[1] ?? match[2]);
  }
  const values = new Map();
  for (const match of text.matchAll(PAIR_RE)) {
    values.set(match[1], match[2]);
  }
  return { keys, values };
}

/** The `en` bundle: an exported object whose name ends in `En`. */
function englishBundles(program) {
  const bundles = [];
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "VariableDeclaration") continue;
    for (const declarator of declaration.declarations) {
      if (declarator.id?.type !== "Identifier") continue;
      if (!/En$/.test(declarator.id.name)) continue;
      let init = declarator.init;
      while (
        init &&
        (init.type === "TSAsExpression" || init.type === "TSSatisfiesExpression")
      ) {
        init = init.expression;
      }
      if (init?.type === "ObjectExpression") bundles.push(init);
    }
  }
  return bundles;
}

function propertyKey(property) {
  if (property.type !== "Property" || property.computed) return null;
  if (property.key.type === "Literal" && typeof property.key.value === "string") {
    return property.key.value;
  }
  return null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every key of a pair's English i18n bundle to exist, translated, in each locale bundle it ships (ru/es).",
    },
    schema: [
      {
        type: "object",
        properties: {
          /** Locale file basenames to require, without extension. */
          locales: { type: "array", items: { type: "string" } },
          /** Minimum English string length before an identical copy is a finding. */
          untranslatedFloor: { type: "number" },
          /** Report keys present in a locale but absent from `en`. */
          reportExtra: { type: "boolean" },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      missingLocale:
        'No `{{locale}}.ts` beside this file. The pair ships English only, so a {{locale}} host renders English copy in the middle of its own UI — the failure is invisible in every test that runs in one locale, which is all of them. Add `src/i18n/{{locale}}.ts` mirroring keys.ts (spread the generated `<pair>ErrorBundle{{Locale}}` first, then the hand-written copy) and export it as the `./i18n/{{locale}}` subpath so hosts opt in without paying for it.',
      untranslatedBundle:
        '`{{locale}}.ts` translates NONE of this pair\'s {{count}} own keys — it carries the generated backend error texts and falls back to English for the whole UI. A {{locale}} host therefore reads {{locale}} error messages inside an English screen, which is a worse result than either language alone and reads as a half-finished product rather than a missing translation. Add the hand-written {{locale}} copy for `<PAIR>_I18N_KEYS` beside the generated spread in `src/i18n/{{locale}}.ts`. (Reported once, not once per key: this is one decision.)',
      missingKey:
        'i18n key "{{key}}" has no {{locale}} translation. The {{locale}} bundle falls back to the English string at runtime, silently — one English sentence in a Russian dialog, shipped, with a green test suite behind it. Add "{{key}}" to `src/i18n/{{locale}}.ts`.',
      extraKey:
        'The {{locale}} bundle defines "{{key}}", which the English bundle does not. Either it is a key that was renamed in keys.ts and left behind here (dead weight that will never be looked up), or it is a typo that will never resolve. Delete it, or fix the spelling to match keys.ts.',
      untranslated:
        'i18n key "{{key}}" is byte-identical in {{locale}} and English ("{{sample}}"). For a string this long that is a copy-paste placeholder, not a translation — and it passes every parity check that only compares key sets, which is why this one compares values too. Translate it, or, if the term genuinely does not translate (a brand, a protocol name), keep it and note why in the bundle.',
    },
  },
  create(context) {
    const path = normalizedFilename(context);
    // The anchor: a pair's own key module. Not `generated/`, not a locale file.
    if (!/\/src\/i18n\/keys\.tsx?$/.test(path)) return {};

    const options = context.options[0] ?? {};
    const locales = options.locales ?? DEFAULT_LOCALES;
    const floor = options.untranslatedFloor ?? DEFAULT_UNTRANSLATED_FLOOR;
    const reportExtra = options.reportExtra !== false;
    const dir = dirname(path);

    return {
      "Program:exit"(program) {
        const bundles = englishBundles(program);
        if (bundles.length === 0) return; // no en bundle here → nothing to mirror

        /** key → the Property node that defines it (for the report location). */
        const english = new Map();
        for (const bundle of bundles) {
          for (const property of bundle.properties) {
            const key = propertyKey(property);
            if (key !== null && !english.has(key)) english.set(key, property);
          }
        }
        if (english.size === 0) return;

        // The top-level segments the pair writes by hand. `extraKey` fires
        // only inside these (see the note at the loop below).
        const managedNamespaces = new Set();
        for (const key of english.keys()) {
          const dot = key.indexOf(".");
          managedNamespaces.add(dot > 0 ? key.slice(0, dot) : key);
        }

        for (const locale of locales) {
          const file = ["ts", "tsx"]
            .map((ext) => join(dir, `${locale}.${ext}`))
            .find((candidate) => existsSync(candidate));
          if (!file) {
            context.report({
              node: program,
              messageId: "missingLocale",
              data: {
                locale,
                Locale: locale.charAt(0).toUpperCase() + locale.slice(1),
              },
            });
            continue;
          }
          const bundle = readLocale(file);
          if (!bundle) continue;

          // A locale file that translates NONE of the pair's own keys is one
          // decision, not N. auth-react's `es.ts` is exactly this: it ships
          // the generated backend error texts and deliberately falls back to
          // English for all 267 UI keys, and saying so 267 times would bury
          // every other finding in this sweep under one pair's backlog.
          const translated = [...english.keys()].filter((k) => {
            if (bundle.keys.has(k)) return true;
            const plural = pluralParts(k);
            return plural !== null && hasPluralFamily(bundle.keys, plural[0]);
          });
          if (translated.length === 0) {
            context.report({
              node: program,
              messageId: "untranslatedBundle",
              data: {
                locale,
                count: String(english.size),
                Locale: locale.charAt(0).toUpperCase() + locale.slice(1),
              },
            });
            continue;
          }

          for (const [key, node] of english) {
            if (!bundle.keys.has(key)) {
              // A plural family whose categories differ is the translation
              // being RIGHT — the locale expresses the family with its own
              // CLDR categories.
              const plural = pluralParts(key);
              if (plural && hasPluralFamily(bundle.keys, plural[0])) continue;
              context.report({ node, messageId: "missingKey", data: { key, locale } });
              continue;
            }
            const localeValue = bundle.values.get(key);
            if (localeValue === undefined) continue; // multi-line value: not compared
            const englishValue =
              node.value.type === "Literal" && typeof node.value.value === "string"
                ? node.value.value
                : null;
            if (englishValue === null) continue;
            if (localeValue !== englishValue) continue;
            if (englishValue.length < floor || !/\s/.test(englishValue)) continue;
            context.report({
              node,
              messageId: "untranslated",
              data: {
                key,
                locale,
                sample:
                  englishValue.length > 48
                    ? `${englishValue.slice(0, 48)}…`
                    : englishValue,
              },
            });
          }

          if (!reportExtra) continue;
          for (const key of bundle.keys) {
            if (english.has(key)) continue;
            // Only inside a namespace the pair hand-writes on the EN side.
            // A locale bundle legitimately authors keys the en side receives
            // through a spread — chat-react's ru.ts writes the twelve
            // `error.*` texts stapel-chat owns but does not yet ship a
            // `translations/` catalog for, while keys.ts gets them from the
            // generated bundle. Those are the generator's business, not a
            // rename left behind, and reporting them would bury the finding
            // this message is actually for under forty false ones.
            const dot = key.indexOf(".");
            const namespace = dot > 0 ? key.slice(0, dot) : key;
            if (!managedNamespaces.has(namespace)) continue;
            // …and not an extra CLDR category of a family en already has.
            const plural = pluralParts(key);
            if (plural && hasPluralFamily(new Set(english.keys()), plural[0])) continue;
            context.report({
              node: program,
              messageId: "extraKey",
              data: { key, locale },
            });
          }
        }
      },
    };
  },
};
