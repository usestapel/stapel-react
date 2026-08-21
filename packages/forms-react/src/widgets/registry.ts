/**
 * The field-widget registry — THE customer seam of this pair, and the direct
 * descendant of docs-react's editor registry.
 *
 * A form schema's fields are `stapel_attributes` `FeatureDef`s, and that type
 * vocabulary is an OPEN registry server-side (builtins →
 * `STAPEL_ATTRIBUTES["EXTRA_TYPES"]` → runtime `register_feature_type`). A
 * host that adds a type on the backend must be able to render it on the front
 * without forking the skin:
 *
 * ```tsx
 * registerFormFieldWidget("signature", SignaturePad); // at startup
 * ```
 *
 * ── Resolution, and what happens when nothing matches ──────────────────────
 *
 * This module answers only the FIRST rung: an explicit registration, or
 * `null`. The `/default` skin completes the ladder — explicit registration >
 * skin builtin (antd) > **unsupported-field notice** — mirroring
 * docs-react's `DocSurface`, where an explicit `registerDocEditor` outranks
 * the skin's own styled default so a host's swap is never shadowed.
 *
 * The last rung is a notice, deliberately, and never a skipped field. A
 * schema can legally contain a kind this build has no widget for; rendering
 * nothing would silently drop a field that may be REQUIRED, and the person
 * would submit a form they could not complete and be told, by the server,
 * that a field they never saw is missing. `<FormFill>` therefore also blocks
 * the submit with `forms.unsupported_kind` while such a field is present —
 * degrade loudly (spec §7.2).
 *
 * The registry lives in the main entry, not in `/default`, so a host building
 * its own renderer over `<FormFill>` uses the same seam as the skin does
 * rather than a parallel one.
 */
import type { ComponentType } from "react";
import type { FlowError } from "@stapel/core";
import type { FormFieldDef } from "../api/types.js";

/**
 * What every field widget receives. One field, one value, one setter, one
 * error — the widget never touches the API layer or the rest of the form.
 */
export interface FormFieldWidgetProps {
  /** The field's `FeatureDef`. `field.config` carries the kind's camelCase
   * options (`maxLength`, `minSelected`, `precision`, `multiline`, …). */
  readonly field: FormFieldDef;
  /** The current answer, or `undefined` while unanswered. */
  readonly value: unknown;
  /** Report a new answer. Pass the bare scalar — `select` normalizes to a
   * list server-side, so a single choice need not be wrapped. */
  onChange(value: unknown): void;
  /** The field's current refusal (client mirror or server verdict), or
   * `undefined`. */
  readonly error: FlowError | undefined;
  /** True while a submit is in flight — widgets should go read-only. */
  readonly disabled: boolean;
  /**
   * DOM id the widget MUST put on its primary control. The skin's field row
   * points its `<label for>` at this, so the label actually names the input
   * for a screen reader (and for a click). A widget that drops it renders an
   * unlabelled control — which antd's `Form.Item` cannot detect and will
   * happily draw a label beside.
   */
  readonly id: string;
}

export type FormFieldWidget = ComponentType<FormFieldWidgetProps>;

const registered = new Map<string, FormFieldWidget>();

/**
 * Register (or override) the widget for a field kind. Call at startup, before
 * the first render — the registry is module-global, like the i18n bundle
 * registration and docs-react's editor registry.
 */
export function registerFormFieldWidget(
  kind: string,
  widget: FormFieldWidget
): void {
  registered.set(kind, widget);
}

/** Remove an explicit registration (the skin's builtin, if any, resolves
 * again). */
export function unregisterFormFieldWidget(kind: string): void {
  registered.delete(kind);
}

/**
 * The EXPLICIT registration for a kind, or `null`. Named for what it is: the
 * skin calls this FIRST and only falls back to its own builtin when it
 * returns `null`, so a host registration always wins.
 */
export function resolveFormFieldWidget(kind: string): FormFieldWidget | null {
  return registered.get(kind) ?? null;
}

/** Every kind with an explicit registration, sorted. */
export function registeredFormFieldKinds(): readonly string[] {
  return [...registered.keys()].sort();
}
