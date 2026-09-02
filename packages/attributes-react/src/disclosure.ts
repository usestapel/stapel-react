/**
 * Progressive disclosure of DEPENDENT fields — the second visibility gate,
 * beside the rules engine.
 *
 * A field whose config points at a vocabulary level *through a sibling*
 * (`optionsRef.parentFeature`, on `ref_select` and on the vocabulary-backed
 * `int` alike) is not answerable until that sibling is answered: an orphan
 * modification dropdown offers every modification of every car. The owner's
 * ruling for the composer is that such a field does not RENDER at all until
 * its parent holds a value — filling one rung reveals the next.
 *
 * This module is the React-free predicate both consumers share:
 * `<FeatureFields>` filters rows with it, and `toFeaturesDto` drops the
 * values of undisclosed fields so the payload never carries an answer to a
 * question that was not on screen. The rules engine is not consulted —
 * `show`/`hide` keep meaning what they meant, and the two gates compose (a
 * row renders when the rules say visible AND the parent is filled).
 *
 * One deliberate asymmetry with the rules engine: a `parentFeature` naming a
 * slug the feature set does NOT define gates nothing. The rules engine reads
 * an unknown controlling slug as `empty` because a rule is an instruction
 * about values; a disclosure gate on a slug nobody can ever fill would hide
 * the field forever with no way to reveal it, which is a lost question, not
 * a constraint. (`validate_configs` already warns about the dangling
 * pointer.)
 */
import type { FeatureDef } from "./types.js";
import { featureConfig, featureType } from "./types.js";
import { stringify } from "./rules.js";
import { optionsRefOf } from "./vocabulary.js";

/**
 * The sibling slug this feature's allowed set is scoped by, or `undefined`.
 * Read off `config.optionsRef.parentFeature`, whatever the feature's type —
 * the pointer means the same thing on `ref_select` and on `int`.
 */
export function dependencyParentOf(feature: FeatureDef): string | undefined {
  const pointer = optionsRefOf(featureConfig(feature));
  return pointer?.parentFeature;
}

/**
 * The slugs whose parent is still blank — the fields the form must not draw
 * (and whose values the DTO must not carry). Blankness is the rule engine's
 * own notion ({@link stringify} returning nothing), so `[]`, `""`, `null`
 * and `undefined` all mean "not answered".
 */
/**
 * The one value a feature's (already NARROWED) config still allows, or
 * `undefined` when the person genuinely has a choice — the auto-bake
 * predicate (the bake rule): a field with exactly one allowed answer commits it
 * and renders grey, `mandatory` or not.
 *
 * Collapses recognized here, on the config alone (the asynchronous ones — a
 * chained ref rung, a vocabulary-backed int — are the editors' own, because
 * only they hold the fetched terms):
 *
 *  - a SINGLE-CHOICE `select` down to one option — statically, or after a
 *    `forbid_option` rule narrowed the list. `maxSelected` must literally be
 *    `1`: absent means unlimited on `select`, and one *available* option on
 *    a multi-select is not one *answer* (leaving it unpicked is an answer
 *    too);
 *  - an `int`/`float` whose closed options list (`allowCustom: false`) is
 *    down to one number;
 *  - an `int`/`float` whose `min` equals its `max` — which is what a `limit`
 *    rule pinning both ends produces.
 *
 * The returned value has the shape the type's editor would commit — a
 * one-element code list for `select`, a bare number for the numerics — so a
 * baked payload is byte-identical to a picked one.
 */
export function soleAllowedValue(feature: FeatureDef): unknown {
  const type = featureType(feature);
  const config = featureConfig(feature);
  if (type === "select") {
    if (config["maxSelected"] !== 1) return undefined;
    const options = config["options"];
    if (!Array.isArray(options) || options.length !== 1) return undefined;
    const only = options[0];
    const code =
      only !== null && typeof only === "object"
        ? (only as { value?: unknown }).value
        : only;
    return typeof code === "string" && code.length > 0 ? [code] : undefined;
  }
  if (type === "int" || type === "float") {
    const options = config["options"];
    if (
      Array.isArray(options) &&
      options.length === 1 &&
      config["allowCustom"] === false &&
      typeof options[0] === "number"
    ) {
      return options[0];
    }
    const min = config["min"];
    const max = config["max"];
    if (typeof min === "number" && typeof max === "number" && min === max) {
      return min;
    }
  }
  return undefined;
}

/** Two submitted values that mean the same answer, in the rule engine's own
 * canonicalization — so `["2024"]`, `2024` and `"2024"` compare equal the
 * way the engine reads them. */
export function sameAnswer(left: unknown, right: unknown): boolean {
  const a = stringify(left);
  const b = stringify(right);
  return a.length === b.length && a.every((one, index) => one === b[index]);
}

export function undisclosedSlugs(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): ReadonlySet<string> {
  const raw = values ?? {};
  const defined = new Set(features.map((one) => one.slug));
  const out = new Set<string>();
  for (const feature of features) {
    const parent = dependencyParentOf(feature);
    if (parent === undefined || !defined.has(parent)) continue;
    if (stringify(raw[parent]).length === 0) out.add(feature.slug);
  }
  return out;
}
