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
import { featureType } from "./types.js";
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
  builtinTypes: readonly string[]
): readonly string[] {
  const builtin = new Set(builtinTypes);
  const out = new Set<string>();
  for (const feature of features) {
    const type = featureType(feature);
    if (type === undefined) {
      out.add(UNTYPED_FEATURE);
      continue;
    }
    if (resolveValueEditor(type) === null && !builtin.has(type)) out.add(type);
  }
  return [...out].sort();
}

/** What `unsupportedTypes` reports for a feature whose config names no type
 * at all. Exported so a caller can tell "we cannot draw `size_grid`" from
 * "this row has no type" without string-matching a message. */
export const UNTYPED_FEATURE = "(none)";

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
  builtinTypes: readonly string[]
): ActionAvailability {
  const types = unsupportedTypes(features, builtinTypes);
  if (types.length === 0) return actionAvailable();
  return actionBlocked(ATTRIBUTES_I18N_KEYS.submitBlockedUnsupportedType, {
    types: types.join(", "),
  });
}
