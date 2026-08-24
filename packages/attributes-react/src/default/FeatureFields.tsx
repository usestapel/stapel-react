/**
 * `<FeatureFields/>` — a category's features, drawn as antd form rows, and
 * the place the three-rung ladder is actually executed.
 *
 * It holds no state and owns no submit: values and errors come in, changes go
 * out. That is what lets the composer that DOES own the submit
 * (listings-react) keep one source of truth for a draft, and what lets this
 * component be dropped into any form — a filter panel, an admin preview —
 * without dragging a mutation along. A host that wants the state as well as
 * the drawing takes `useFeatureFields` from the main entry and feeds it
 * straight in; the hook is the headless half of exactly this component (§54).
 */
import type { ReactElement, ReactNode } from "react";
import { Alert, Form } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "../types.js";
import { featureName, featureType } from "../types.js";
import { featureAnswerRequired } from "../validate.js";
import { resolveValueEditor } from "../registry.js";
import { BUILTIN_VALUE_EDITORS } from "./editors.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";

/** Stable per-feature DOM id, so `<label for>` reaches the control. Slugs are
 * `[a-z0-9_]`-shaped by the engine, so this needs no further escaping. */
export function featureControlId(slug: string): string {
  return `attributes-field-${slug}`;
}

export interface UnsupportedValueEditorProps {
  readonly feature: FeatureDef;
}

/**
 * The loud last rung. NOT a skipped field: a category can legally carry a
 * type this build has no editor for, and drawing nothing would silently drop
 * a feature that may be mandatory — the person would submit a listing they
 * could not complete and be told, by the server, that an attribute they never
 * saw is missing.
 *
 * It names the FEATURE and says the sentence; the type SLUG travels as
 * `data-attributes-type` instead of being rendered. That is the C-DEVCOPY fix
 * from the visual pass: `size_grid` is an identifier out of a Python registry,
 * and "this build has no editor for it" is a fact about our release process —
 * neither is something a seller can act on, and support can still read both
 * off the DOM.
 */
export function UnsupportedValueEditor(
  props: UnsupportedValueEditorProps
): ReactElement {
  const t = useT();
  const type = featureType(props.feature);
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="attributes-unsupported-type"
      data-attributes-type={type ?? "(none)"}
      message={featureName(props.feature)}
      description={
        type === undefined
          ? t(ATTRIBUTES_I18N_KEYS.untypedFeature)
          : t(ATTRIBUTES_I18N_KEYS.unsupportedType)
      }
    />
  );
}

export interface FeatureFieldsProps {
  readonly features: readonly FeatureDef[];
  /** Current answers keyed by slug. The DTO envelope is built at submit time
   * with `toFeaturesDto`, not held here. */
  readonly values: Readonly<Record<string, unknown>>;
  onChange(slug: string, value: unknown): void;
  /** Refusals keyed by slug — mirrored or from the server, folded through
   * `featureErrorsBySlug` either way. */
  readonly errors?: Readonly<Record<string, FlowError>>;
  /** True while a submit is in flight — every editor goes read-only. */
  readonly disabled?: boolean;
  /** Rendered instead of a default `Form.Item` row, for a host with its own
   * field chrome. */
  readonly renderRow?: (row: FeatureRowProps) => ReactNode;
}

export interface FeatureRowProps {
  readonly feature: FeatureDef;
  readonly controlId: string;
  readonly control: ReactNode;
  readonly error: FlowError | undefined;
  /** Required by the CATEGORY (`mandatory`) or by the TYPE's own config —
   * `featureAnswerRequired`, the same predicate the mirror refuses with, so
   * the asterisk and the refusal can never disagree. */
  readonly required: boolean;
  /** The admin's per-feature help text (`FeatureDef.comment`), when there is
   * one. */
  readonly help: string | undefined;
  /** True when nothing could draw this feature and `control` is the notice
   * rather than an editor. The notice names the feature itself, so the row
   * must not ALSO label it — the visual pass caught "Size grid" printed twice,
   * once as a label and once inside the alert. */
  readonly unsupported: boolean;
}

function FeatureRow(props: FeatureRowProps): ReactElement {
  const format = useFormatFlowError();
  // A header is a caption, and an unsupported notice names itself: no label,
  // no colon, no required marker. Rendering either inside a labelled Form.Item
  // would make a section heading look like a question and print the feature's
  // name twice.
  if (featureType(props.feature) === "header" || props.unsupported) {
    return <Form.Item style={{ marginBottom: spacing[2] }}>{props.control}</Form.Item>;
  }
  return (
    <Form.Item
      label={featureName(props.feature)}
      htmlFor={props.controlId}
      required={props.required}
      // `FeatureDef.comment` is the sentence an admin wrote FOR the person
      // filling the form in ("measured at the widest point"). It was typed,
      // carried over the wire and never rendered.
      {...(props.help !== undefined ? { extra: props.help } : {})}
      {...(props.error ? { validateStatus: "error" as const, help: format(props.error) } : {})}
    >
      {props.control}
    </Form.Item>
  );
}

/** A category's features as form rows, each drawn by the ladder's winner. */
export function FeatureFields(props: FeatureFieldsProps): ReactElement {
  const errors = props.errors ?? {};
  return (
    <>
      {props.features.map((feature) => {
        const controlId = featureControlId(feature.slug);
        const type = featureType(feature);
        // The ladder: a host's explicit registration outranks the skin's
        // builtin, and nothing at all is a NOTICE, never an omission.
        const Editor =
          (type === undefined ? null : resolveValueEditor(type)) ??
          (type === undefined ? undefined : BUILTIN_VALUE_EDITORS[type]);
        const unsupported = Editor === undefined || Editor === null;
        const required = featureAnswerRequired(feature);
        const control = Editor === undefined || Editor === null ? (
          <UnsupportedValueEditor feature={feature} />
        ) : (
          <Editor
            id={controlId}
            feature={feature}
            value={props.values[feature.slug]}
            onChange={(value) => props.onChange(feature.slug, value)}
            error={errors[feature.slug]}
            disabled={props.disabled === true}
            required={required}
          />
        );
        const comment = typeof feature.comment === "string" ? feature.comment.trim() : "";
        const row: FeatureRowProps = {
          feature,
          controlId,
          control,
          error: errors[feature.slug],
          required,
          help: comment.length > 0 ? comment : undefined,
          unsupported,
        };
        if (props.renderRow) return <div key={feature.slug}>{props.renderRow(row)}</div>;
        return <FeatureRow key={feature.slug} {...row} />;
      })}
    </>
  );
}
