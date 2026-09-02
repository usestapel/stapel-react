/**
 * The two questions a HOST asks about a feature set before it draws anything,
 * answered against the current answers rather than against the schema.
 *
 * A composer that walks a category's features in steps has to decide, per
 * step: *is there anything to ask here?* and *what does this person still
 * owe?* Both are verdicts about VALUES — a rule can empty a whole section and
 * a rule can turn requiredness on and off as a sibling is answered — and a
 * host that read `feature.mandatory` and `features.length` off the schema got
 * a step with nothing in it and a "Next" that refused over a field that was
 * not on screen.
 *
 * So the answers live here, next to the engine, and they are the SAME
 * predicates the renderer and the mirror use:
 *
 *   {@link visibleFeatures}          the rows `<FeatureFields>` will draw
 *   {@link visibleFeatureGroups}     those rows as blocks, empty ones dropped
 *   {@link hasVisibleFields}         "is there anything to ask here?"
 *   {@link missingRequiredFeatures}  what `mirrorValidate` will refuse over
 *
 * ── Two gates, composed ───────────────────────────────────────────────────
 *
 * A row is on screen when the RULES say visible (`show`/`hide`, evaluated
 * against the current values) AND progressive disclosure has revealed it (its
 * `optionsRef.parentFeature` is answered — `disclosure.ts`). Both gates are
 * already the renderer's; this module states them once for a caller that is
 * not the renderer.
 *
 * A feature whose `rules` do not PARSE is treated as visible, because that is
 * what `<FeatureFields>` does with it: it is drawn as the loud unsupported
 * notice rather than dropped, and `unsupportedTypeGate` blocks the submit
 * with the schema named. It is never reported as missing — nobody can answer
 * a control that could not be drawn, and the reason is already on screen.
 */
import type { FeatureDef } from "./types.js";
import { featureType } from "./types.js";
import type { RuleState } from "./rules.js";
import { VISIBLE_STATE, evaluateRules, ruleErrors } from "./rules.js";
import { undisclosedSlugs } from "./disclosure.js";
import { featureRequiredUnder, isBlank } from "./validate.js";

/** The rule states `<FeatureFields>` would compute, with the features whose
 * rule sets do not parse left out of the pre-pass exactly as it leaves them
 * out. */
function statesOf(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined,
  broken: Readonly<Record<string, string>>
): Readonly<Record<string, RuleState>> {
  return evaluateRules(
    features.filter((one) => broken[one.slug] === undefined),
    values
  );
}

/**
 * The features that are actually on screen for these answers — rule-visible
 * and disclosed — in the order they were given.
 *
 * This is the row set `<FeatureFields features={features} values={values}/>`
 * renders, so a host can count it, group it, or page it without drawing it.
 */
export function visibleFeatures(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): readonly FeatureDef[] {
  const broken = ruleErrors(features);
  const states = statesOf(features, values, broken);
  const undisclosed = undisclosedSlugs(features, values);
  return features.filter((feature) => {
    if (broken[feature.slug] !== undefined) return true; // drawn as the notice
    if (undisclosed.has(feature.slug)) return false;
    return (states[feature.slug] ?? VISIBLE_STATE).visible;
  });
}

/**
 * Does this set ask the person ANYTHING for the current answers?
 *
 * A `header` does not count. It is a caption, never a question — a block that
 * is nothing but headings asks for no answer, and a step showing two headings
 * and no control is an empty step under a different name.
 *
 * **Pass the WHOLE feature set.** A rule reads its controlling slug off the
 * DEFINITIONS it was given (`evaluateRules`, decision 1), so a slug that is
 * not in `features` reads as `empty` — hand this one block's rows and a
 * condition pointing at a field in another block silently reads as unanswered.
 * {@link visibleFeatureGroups} is the block-shaped answer, evaluated whole.
 */
export function hasVisibleFields(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): boolean {
  return visibleFeatures(features, values).some(
    (feature) => featureType(feature) !== "header"
  );
}

/** One block of a step ladder: a `FeatureDef.group` and the rows of it that
 * are on screen right now. Never empty — see {@link visibleFeatureGroups}. */
export interface VisibleFeatureGroup {
  /** The catalogue's group name, verbatim (admin-authored, often an i18n
   * key). `""` is "the questions before the first heading". */
  readonly group: string;
  /** The rows of this group that are visible for the current answers. */
  readonly features: readonly FeatureDef[];
}

/**
 * The whole form as the blocks that still ask something — the step ladder,
 * ready to walk.
 *
 * A host that makes one step per `FeatureDef.group` must not create a step
 * for a block whose fields are all hidden by a rule (or all waiting on a
 * parent): the person taps Next onto a page with a heading and nothing under
 * it. Reading `features.length` off the schema is what produces that step —
 * emptiness is a fact about the current ANSWERS, and it changes as they type.
 *
 * The rules are evaluated once over the FULL set, so a condition that points
 * at a field in another block reads its real answer. Groups come back in the
 * order `<FeatureFields>` draws them — ungrouped first, then each group in
 * order of first appearance — and a group with no visible non-header row is
 * omitted entirely.
 */
export function visibleFeatureGroups(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): readonly VisibleFeatureGroup[] {
  const visible = new Set(visibleFeatures(features, values).map((one) => one.slug));
  const byGroup = new Map<string, FeatureDef[]>([["", []]]);
  for (const feature of features) {
    if (!visible.has(feature.slug)) continue;
    const group = typeof feature.group === "string" ? feature.group.trim() : "";
    const rows = byGroup.get(group);
    if (rows === undefined) byGroup.set(group, [feature]);
    else rows.push(feature);
  }
  return [...byGroup.entries()]
    .filter(([, rows]) => rows.some((one) => featureType(one) !== "header"))
    .map(([group, rows]) => ({ group, features: rows }));
}

/**
 * The features that are required RIGHT NOW and still unanswered — what a
 * "Next" or a "Publish" is entitled to refuse over, and the same verdict the
 * asterisk is drawn from.
 *
 * Requiredness is {@link featureRequiredUnder} against the evaluated rule
 * state, never `feature.mandatory` on its own: a field whose `require` rule
 * has not matched is not required, and it neither carries the marker nor
 * appears here. When the condition later becomes true, both turn on in the
 * same render.
 *
 * A field that is not on screen is never listed — hidden by a rule, or
 * waiting on the parent that scopes it. The open question is the parent.
 */
export function missingRequiredFeatures(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): readonly FeatureDef[] {
  const raw = values ?? {};
  const broken = ruleErrors(features);
  const states = statesOf(features, values, broken);
  const undisclosed = undisclosedSlugs(features, values);
  return features.filter((feature) => {
    if (broken[feature.slug] !== undefined) return false;
    if (undisclosed.has(feature.slug)) return false;
    const state = states[feature.slug] ?? VISIBLE_STATE;
    if (!featureRequiredUnder(feature, state)) return false;
    return isBlank(raw[feature.slug]);
  });
}
