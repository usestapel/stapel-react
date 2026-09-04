/**
 * Config values that are TRANSLATION KEYS, resolved in one place.
 *
 * ── The class this file closes ─────────────────────────────────────────────
 *
 * `stapel_attributes` marks, per type, which config strings are catalogue keys
 * rather than copy — and it does so machine-readably, in each type's
 * `get_translation_keys(config)`:
 *
 *   `bool`      → `trueLabel`, `falseLabel`      (`types/bool/type.py:117-123`)
 *   `int/float` → `prefix`, `postfix`, `postfix1000`  (`types/int/type.py:155-160`)
 *   `string`    → `prefix`, `postfix`            (`types/string/type.py:155-162`)
 *   `select`    → every option's `label`         (`types/select/type.py`)
 *   `hex_color` → every option's `label`         (`types/hex_color/type.py:281-289`)
 *   `hierarchical_select` → each option's `label` and `childrenTitle`
 *
 * The audit found the skin honouring exactly one of those (select options) and
 * rendering the rest verbatim: a Russian storefront showed `Negotiable` on its
 * bool switches and `feature.colour.ruby` beside its colour swatches. Three
 * patches would have closed three sites and left the fourth to be discovered
 * by a customer, so this is one helper every editor goes through, and
 * `test/labels.test.ts` asserts the KEY SET here matches what the engine's
 * `get_translation_keys` declares per type.
 *
 * ── The `translatable_options` escape hatch ────────────────────────────────
 *
 * `string`/`select`/`hierarchical_select` carry `translatable_options`
 * (default **true**). When an admin turns it off, option labels are literal
 * copy typed into the catalogue and must NOT be looked up. `prefix`/`postfix`/
 * `trueLabel`/`falseLabel` have no such flag upstream — they are always keys —
 * so they always pass through `t()`, which returns the key itself when the
 * host's catalogue has no entry and therefore degrades to today's behaviour
 * rather than to a blank.
 */
import type { FeatureConfig, FeatureDef } from "../types.js";
import { featureConfig, featureType } from "../types.js";
import { stringify } from "../rules.js";

/** The translator shape this module needs — core's `useT()` return value,
 * narrowed so a non-React caller can pass a plain lookup. */
export type Translate = (key: string, params?: Readonly<Record<string, unknown>>) => string;

/**
 * Config keys whose value is a translation key, per value type — the mirror of
 * each type's `get_translation_keys(config)`. Exported so a test can hold it
 * against the Python rather than against a reviewer's memory.
 */
export const TRANSLATABLE_CONFIG_KEYS: Readonly<Record<string, readonly string[]>> = {
  bool: ["trueLabel", "falseLabel"],
  int: ["prefix", "postfix", "postfix1000"],
  float: ["prefix", "postfix", "postfix1000"],
  string: ["prefix", "postfix"],
  select: ["options[].label"],
  hex_color: ["options[].label"],
  hierarchical_select: ["options[].label", "options[].childrenTitle"],
  convertible_unit: ["prefix"],
};

/**
 * Resolve one config string that the engine declares to be a translation key.
 *
 * Returns `""` for an absent value, so a caller can keep using
 * `resolved || fallback`. Never returns a raw key when the catalogue has one,
 * and never swallows a key when it does not — `t()` falls back to the key,
 * which stays more informative than an empty control.
 */
export function configLabel(t: Translate, raw: unknown): string {
  const text = typeof raw === "string" ? raw : "";
  return text.length === 0 ? "" : t(text);
}

/**
 * Resolve an OPTION's label — the one family gated by `translatable_options`.
 *
 * `fallback` is the option's own `value`, and a label EQUAL to it is left
 * alone: an option that spells its label the same as its stored value is
 * carrying copy, not a key, and looking it up would turn `red` into `red`
 * through a catalogue miss for no gain.
 */
export function optionLabel(
  t: Translate,
  config: FeatureConfig,
  raw: unknown,
  fallback: string
): string {
  const text = typeof raw === "string" && raw.length > 0 ? raw : fallback;
  if (config["translatable_options"] === false) return text;
  return text === fallback ? text : t(text);
}

/**
 * One field's current ANSWER as a person reads it — "BMW", "Yes", "2019".
 *
 * The other direction from {@link optionLabel}: that one dresses an option
 * being offered, this one names an answer already given, so a sentence about
 * ANOTHER field can quote it ("for this generation, from 2018 to 2024"). A
 * code with no matching option travels verbatim — a vocabulary term's label
 * lives behind a second wire and is not this function's to invent.
 */
export function answerLabel(t: Translate, feature: FeatureDef, value: unknown): string {
  const config = featureConfig(feature);
  const codes = stringify(value);
  if (codes.length === 0) return "";
  if (featureType(feature) === "bool") {
    const caption = configLabel(t, config[codes[0] === "true" ? "trueLabel" : "falseLabel"]);
    return caption.length > 0 ? caption : codes[0] ?? "";
  }
  const options = Array.isArray(config["options"]) ? config["options"] : [];
  return codes
    .map((code) => {
      const hit = options.find(
        (option) =>
          option !== null &&
          typeof option === "object" &&
          String((option as { value?: unknown }).value) === code
      );
      return hit === undefined
        ? code
        : optionLabel(t, config, (hit as { label?: unknown }).label, code);
    })
    .join(", ");
}
