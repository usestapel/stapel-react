/**
 * The value-editor registry — THE customer seam of this package, and the
 * direct descendant of forms-react's field-widget registry.
 *
 * It keys on `config.type` (the VALUE type: `string`, `int`, `select`, …),
 * not on `FormField.kind` (the admin config form's field kinds). That is the
 * whole reason this package exists next to `@stapel/forms-react` rather than
 * inside it: two different vocabularies, and L2 pairs may not import each
 * other anyway (`stapel-react/README.md` — dependency direction is strictly
 * downward).
 *
 * The type vocabulary is an OPEN registry server-side (builtins →
 * `STAPEL_ATTRIBUTES["EXTRA_TYPES"]` → runtime `register_feature_type`), so a
 * host that adds a type on the backend must be able to draw it on the front
 * without forking the skin:
 *
 * ```tsx
 * registerValueEditor("size_grid", SizeGridEditor); // at startup
 * ```
 *
 * ── Resolution, and what happens when nothing matches ──────────────────────
 *
 * This module answers only the FIRST rung: an explicit registration, or
 * `null`. The `/default` skin completes the ladder — explicit registration >
 * skin builtin (antd) > **loud unsupported notice** — verbatim the ladder
 * forms-react's `<StapelForm>` runs.
 *
 * The last rung is a notice, deliberately, and never a skipped field. A
 * category can legally carry a type this build has no editor for; rendering
 * nothing would silently drop a feature that may be MANDATORY, and the person
 * would submit a listing they could not complete and be told, by the server,
 * that an attribute they never saw is missing. `unsupportedTypeGate` blocks
 * the submit with the reason NAMED while such a feature is present — degrade
 * loudly.
 *
 * The registry lives in the main entry, not in `/default`, so a host building
 * its own renderer uses the same seam the skin does rather than a parallel
 * one.
 */
import type { ComponentType } from "react";
import type { FlowError } from "@stapel/core";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { FeatureDef } from "./types.js";
import { featureName, featureType } from "./types.js";
import { ruleErrors } from "./rules.js";
import { VOCABULARY_BACKED_TYPES } from "./vocabulary.js";
import { ATTRIBUTES_I18N_KEYS } from "./i18n/keys.js";

/**
 * What every value editor receives. One feature, one value, one setter, one
 * error — the editor never touches an API layer or the rest of the form.
 */
export interface ValueEditorProps<T = unknown> {
  /** The feature being edited. `feature.config` carries the type's camelCase
   * options (`maxLength`, `minSelected`, `precision`, `multiline`, …). */
  readonly feature: FeatureDef;
  /** The current answer, or `undefined` while unanswered. */
  readonly value: T | undefined;
  /** Report a new answer. Pass the type's own DTO `value` — bare for the
   * scalar types, an array for `select`/`hierarchical_select`, an object for
   * `hex_color` and `convertible_unit` (see `toFeaturesDto`). */
  onChange(value: T | undefined): void;
  /** The feature's current refusal (client mirror or server verdict), or
   * `undefined`. */
  readonly error?: FlowError | undefined;
  /** True while a submit is in flight — editors should go read-only. */
  readonly disabled?: boolean;
  /**
   * Whether an answer is required — `featureAnswerRequired(feature)`, computed
   * once by the row so the editor and the required marker cannot disagree.
   *
   * An editor puts it on the control as `aria-required`. The asterisk a form
   * library draws is decorative and reaches no screen reader, so without this
   * a blind person meets the requirement for the first time as a refusal.
   */
  readonly required?: boolean;
  /**
   * Every current answer of the form, keyed by slug — the sibling seam.
   *
   * One prop, because the alternative is a second one per relationship. A
   * `ref_select` reads `siblings[optionsRef.parentFeature]` to narrow its
   * level to that term's children (and to reset itself when the parent
   * moves); nothing else in the builtin set reads it, and a host type that
   * needs a sibling no longer has to be given a bespoke prop to get one.
   *
   * It is NOT how an editor writes: `onChange` still reports only this
   * feature's own answer. A control that wrote to a sibling would be a second
   * source of truth for a value the composer already owns.
   */
  readonly siblings?: Readonly<Record<string, unknown>>;
  /**
   * DOM id the editor MUST put on its primary control. The field row points
   * its `<label for>` at this, so the label actually names the input for a
   * screen reader (and for a click). An editor that drops it renders an
   * unlabelled control — which antd's `Form.Item` cannot detect and will
   * happily draw a label beside.
   */
  readonly id: string;
}

export type ValueEditor = ComponentType<ValueEditorProps>;

const registered = new Map<string, ValueEditor>();

/**
 * Register (or override) the editor for a value type. Call at startup, before
 * the first render — the registry is module-global, like the i18n bundle
 * registration and forms-react's widget registry.
 */
export function registerValueEditor(type: string, editor: ValueEditor): void {
  registered.set(type, editor);
}

/** Remove an explicit registration (the skin's builtin, if any, resolves
 * again). */
export function unregisterValueEditor(type: string): void {
  registered.delete(type);
}

/**
 * The EXPLICIT registration for a type, or `null`. Named for what it is: the
 * skin calls this FIRST and only falls back to its own builtin when it
 * returns `null`, so a host registration always wins.
 */
export function resolveValueEditor(type: string): ValueEditor | null {
  return registered.get(type) ?? null;
}

/** Every type with an explicit registration, sorted. */
export function registeredValueEditorTypes(): readonly string[] {
  return [...registered.keys()].sort();
}

/**
 * The value types present in `features` that NOTHING can draw — neither an
 * explicit registration nor the caller's builtin set.
 *
 * Pure and React-free on purpose: the headless half must be able to judge
 * renderability without importing the skin, which is how forms-react's
 * `<FormFill>` avoids pulling antd into a headless bundle. `builtinTypes` is
 * therefore passed IN (the skin exports `BUILTIN_VALUE_EDITOR_TYPES`), not
 * imported from here.
 *
 * A feature whose config declares no `type` at all counts as unsupported and
 * is reported under `"(none)"` — an unnamed hole is still a hole, and a
 * silently dropped mandatory attribute is the exact failure this returns
 * data to prevent.
 */
export function unsupportedTypes(
  features: readonly FeatureDef[],
  builtinTypes: readonly string[],
  options?: RenderabilityOptions
): readonly string[] {
  const out = new Set<string>();
  for (const reason of undrawable(features, builtinTypes, options)) out.add(reason.reported);
  return [...out].sort();
}

/**
 * What else, besides a missing editor, makes a feature undrawable.
 *
 * An absent member is UNKNOWN, not false: a caller that does not pass
 * `vocabularyClient` is not saying "there is none", it is saying it has not
 * looked — and blocking a submit on a fact nobody asserted would break every
 * existing caller. The callers that DO know (`<FeatureFields>`, from context,
 * and listings-react's composer) pass it, and then the block is a fact.
 */
export interface RenderabilityOptions {
  /** The `VocabularyClient` in scope, or `null` when there is none. The two
   * vocabulary-backed types cannot be drawn without one — their config
   * carries a POINTER to a vocabulary, not a list of options. */
  readonly vocabularyClient?: unknown;
  /**
   * Slugs whose `rules` break the closed grammar (`ruleErrors(features)`),
   * when the caller has already computed them. Omitted, it is recomputed — a
   * rule set that does not parse is a row whose visibility and requiredness
   * are both unknown, and drawing it anyway would be a guess.
   */
  readonly invalidRuleSlugs?: readonly string[];
}

/** What the helpers report for a feature whose `rules` do not parse. A
 * distinct sentinel and not a type slug, because the TYPE is fine — it is the
 * row's conditional logic that cannot be executed. */
export const INVALID_RULES_FEATURE = "(invalid rules)";

interface Undrawable {
  readonly feature: FeatureDef;
  /** What {@link unsupportedTypes} reports it under. */
  readonly reported: string;
}

/** The ONE predicate behind all three helpers below, so "can this be drawn?"
 * has a single answer in this package. */
function undrawable(
  features: readonly FeatureDef[],
  builtinTypes: readonly string[],
  options: RenderabilityOptions | undefined
): readonly Undrawable[] {
  const builtin = new Set(builtinTypes);
  const broken = new Set(options?.invalidRuleSlugs ?? Object.keys(ruleErrors(features)));
  const noClient =
    options !== undefined &&
    "vocabularyClient" in options &&
    (options.vocabularyClient === null || options.vocabularyClient === undefined);
  const out: Undrawable[] = [];
  for (const feature of features) {
    const type = featureType(feature);
    if (type === undefined) {
      out.push({ feature, reported: UNTYPED_FEATURE });
      continue;
    }
    if (broken.has(feature.slug)) {
      out.push({ feature, reported: INVALID_RULES_FEATURE });
      continue;
    }
    if (resolveValueEditor(type) === null && !builtin.has(type)) {
      out.push({ feature, reported: type });
      continue;
    }
    // A ref type WITH an editor and WITHOUT a source is the same hole as a
    // type with no editor at all: the control draws and cannot be answered.
    if (noClient && VOCABULARY_BACKED_TYPES.includes(type)) {
      out.push({ feature, reported: type });
    }
  }
  return out;
}

/** What `unsupportedTypes` reports for a feature whose config names no type
 * at all. Exported so a caller can tell "we cannot draw `size_grid`" from
 * "this row has no type" without string-matching a message. */
export const UNTYPED_FEATURE = "(none)";

/**
 * The same features {@link unsupportedTypes} finds, named the way a PERSON
 * sees them on the page — the feature's display name, not the type slug.
 *
 * The two exist side by side because they answer different questions.
 * `unsupportedTypes` answers "which type registrations is this build
 * missing?", which is a developer's question and belongs in a log, a
 * `data-` attribute, a support ticket. This one answers "which of the things
 * on my screen can I not fill in?", which is the only question a blocked
 * submit may put in front of a seller (visual class C-DEVCOPY: `size_grid` is
 * an identifier out of a Python registry, and rendering it as product copy
 * tells a person nothing they can act on).
 */
export function unsupportedFeatureNames(
  features: readonly FeatureDef[],
  builtinTypes: readonly string[],
  options?: RenderabilityOptions
): readonly string[] {
  return undrawable(features, builtinTypes, options).map((one) => featureName(one.feature));
}

/**
 * The submit gate for an unsupported type — blocked with the reason named,
 * never a disabled button with no explanation.
 *
 * This package owns its own key (`attributes.submit.blocked.unsupported_type`)
 * because it owns the fact. A pair with its own submit — listings-react's
 * composer, say — raises its own `listings.compose.blocked.unsupported_type`
 * from the SAME `unsupportedTypes` call and never re-derives the fact; both
 * spellings say the same thing to the same person, and neither invents a
 * silent third behaviour.
 */
export function unsupportedTypeGate(
  features: readonly FeatureDef[],
  builtinTypes: readonly string[],
  options?: RenderabilityOptions
): ActionAvailability {
  const names = unsupportedFeatureNames(features, builtinTypes, options);
  if (names.length === 0) return actionAvailable();
  // FEATURE names, not type slugs: the reason is read by the person whose
  // submit is blocked, and `size_grid` is not something they can act on.
  // `unsupportedTypes` is still there for the log line.
  return actionBlocked(ATTRIBUTES_I18N_KEYS.submitBlockedUnsupportedType, {
    features: names.join(", "),
  });
}
