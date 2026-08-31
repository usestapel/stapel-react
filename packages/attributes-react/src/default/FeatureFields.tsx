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
 *
 * ── What the RULE PRE-PASS changed here (stapel-attributes 0.5.0) ──────────
 *
 * One `evaluateRules(features, values)` per render decides three things
 * before any editor is asked to draw:
 *
 *  - a HIDDEN row is not rendered at all (and `toFeaturesDto` drops its value,
 *    so the client and the server agree on what the listing says);
 *  - REQUIRED comes from `RuleState.required`, never from `mandatory` alone —
 *    the marker, the mirror and the publish gate all read the same predicate;
 *  - the feature's config is NARROWED (`narrowConfig`) before the editor sees
 *    it, so a forbidden option is not offered and a tightened bound is on the
 *    control. **Editors stay rule-unaware**: they receive a `FeatureDef` whose
 *    config already says what the rules decided, which is why a host's own
 *    registered editor gets rules for free.
 *
 * A rule set that does not PARSE is drawn as the loud notice, per feature.
 * Treating it as "no rules" would render a conditionally-mandatory field as
 * unconditionally optional because its `require` rule had a typo.
 */
import { useMemo, useRef } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Divider, Form, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import { SkinTheme, useElementWidth } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "../types.js";
import { featureConfig, featureName, featureType } from "../types.js";
import type { RuleState } from "../rules.js";
import { VISIBLE_STATE, evaluateRules, narrowFeature, ruleErrors } from "../rules.js";
import { resolveValueEditor } from "../registry.js";
import { VOCABULARY_BACKED_TYPES, useVocabularyClient } from "../vocabulary.js";
import { BUILTIN_VALUE_EDITORS } from "./editors.js";
import { ATTRIBUTES_I18N_KEYS } from "../i18n/keys.js";
import { UnsupportedValueEditor } from "./notice.js";
import { TOUCH_FLOOR_BELOW, TouchFloorProvider } from "./touchFloor.js";

export { UnsupportedValueEditor } from "./notice.js";
export type { UnsupportedValueEditorProps } from "./notice.js";

/** Stable per-feature DOM id, so `<label for>` reaches the control. Slugs are
 * `[a-z0-9_]`-shaped by the engine, so this needs no further escaping. */
export function featureControlId(slug: string): string {
  return `attributes-field-${slug}`;
}

/** What the section holding the ungrouped rows is keyed by. They are "the
 * questions before the first heading" and carry no name of their own, so one
 * is spelled here rather than left as an empty suffix nothing can select. */
export const UNGROUPED_SECTION = "ungrouped";

/**
 * The test id of the section one `FeatureDef.group` produces.
 *
 * A category's attribute region is the tallest thing on a composer — a live
 * classified deployment measured 25 rows under 6 headings across some 5000px
 * — and the whole of it carried ONE test id, on an alert that appears only
 * when a field has hints. "Are the headings there?", "did this field render?",
 * "in which section?" were all unmeasurable, so none of them could regress
 * loudly. These builders are exported rather than inlined so a host's e2e
 * suite keys on the same strings this component writes.
 *
 * `group` is admin-authored text (and a translation key as often as not), so
 * it travels verbatim: normalizing it would collide two sections that differ
 * only in punctuation.
 */
export function featureSectionTestId(group: string): string {
  return `attributes-group-${group.length > 0 ? group : UNGROUPED_SECTION}`;
}

/** The test id of one feature's row — the field and everything under it,
 * whether this build could draw an editor for it or not. */
export function featureRowTestId(slug: string): string {
  return `attributes-row-${slug}`;
}

/** The value types whose control has a text box an `example` can sit in. A
 * `select` has no placeholder an example would mean anything in, and putting
 * one on a `Switch` is nonsense. */
const EXAMPLE_TYPES = new Set(["string", "int", "float"]);

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

/** One hint under a field, already resolved through the host's catalogue. */
export interface FeatureHint {
  readonly title: string;
  readonly content: string;
}

export interface FeatureRowProps {
  /** The feature with its config ALREADY NARROWED by its rule state — what
   * the editor is handed, so a host's `renderRow` sees the same thing. */
  readonly feature: FeatureDef;
  /**
   * The column is narrow enough that the label belongs ABOVE the control
   * rather than beside it — the same measurement the touch floor reads
   * ({@link TOUCH_FLOOR_BELOW}), not a viewport media query, because a
   * composer column is not a viewport.
   *
   * It is not cosmetic. With the label beside the control, every row's control
   * column is as wide as its own label is short, so "Scratches and dents"
   * leaves ~80px of text — and the field's help and hints wrap mid-word
   * ("descriptio / n."). A row is either readable or it is not.
   */
  readonly stacked: boolean;
  readonly controlId: string;
  readonly control: ReactNode;
  readonly error: FlowError | undefined;
  /** Required by the RULES (`RuleState.required`, which folds `mandatory` and
   * every matching `require` rule) or by the TYPE's own config — the same
   * predicate the mirror refuses with, so the asterisk and the refusal can
   * never disagree. */
  readonly required: boolean;
  /** The admin's help text for this field (`FeatureDef.description`), resolved
   * through the host's catalogue. */
  readonly help: string | undefined;
  /** `FeatureDef.hints` — the warnings the catalogue attached to this field,
   * resolved. Empty for most features. */
  readonly hints: readonly FeatureHint[];
  /** True when nothing could draw this feature and `control` is the notice
   * rather than an editor. The notice names the feature itself, so the row
   * must not ALSO label it — the visual pass caught "Size grid" printed twice,
   * once as a label and once inside the alert. */
  readonly unsupported: boolean;
}

/**
 * The hints of one field, as ONE info alert.
 *
 * One alert and not one per hint: three stacked info boxes under a single
 * input is a wall, and the catalogue's warnings are a list by nature ("do not
 * include the case", "measure without the strap"). `wordBreak: normal` because
 * this alert lives in the CONTROL column, which on a phone is narrow enough
 * for the ambient `break-word` to split "description" across two lines.
 */
function FeatureHints(props: { readonly hints: readonly FeatureHint[] }): ReactElement | null {
  if (props.hints.length === 0) return null;
  const only = props.hints.length === 1 ? props.hints[0] : undefined;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginTop: spacing[1], wordBreak: "normal", overflowWrap: "break-word" }}
      data-testid="attributes-hints"
      {...(only
        ? { title: only.title, description: only.content }
        : {
            description: (
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: spacing[3],
                  // The ambient rule in this column is `break-word`, which in a
                  // phone-width control splits "description" across two lines.
                  // A hint is prose: it wraps between words or it overflows.
                  wordBreak: "normal",
                  overflowWrap: "break-word",
                }}
              >
                {props.hints.map((hint) => (
                  <li key={`${hint.title} ${hint.content}`}>
                    {hint.title.length > 0 ? <strong>{hint.title}: </strong> : null}
                    {hint.content}
                  </li>
                ))}
              </ul>
            ),
          })}
    />
  );
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
  // Help THEN hints, both under the control: the sentence that tells a person
  // what to type comes before the warnings about what not to. `extra` is
  // antd's slot for exactly that, so the two never end up on opposite sides of
  // the field.
  const extra =
    props.help === undefined && props.hints.length === 0 ? undefined : (
      <>
        {props.help}
        <FeatureHints hints={props.hints} />
      </>
    );
  return (
    <Form.Item
      label={featureName(props.feature)}
      htmlFor={props.controlId}
      required={props.required}
      {...(props.stacked ? { layout: "vertical" as const } : {})}
      // `FeatureDef.description` is the sentence the catalogue wrote FOR the
      // person filling the form in ("measured at the widest point"), and 99.9%
      // of imported fields carry one. `comment` used to be read here and is
      // not any more: one field, one role (D14).
      {...(extra !== undefined ? { extra } : {})}
      {...(props.error ? { validateStatus: "error" as const, help: format(props.error) } : {})}
    >
      {props.control}
    </Form.Item>
  );
}

/** A form SECTION — `FeatureDef.group`, in order of first appearance. The
 * ungrouped rows come first and carry no heading, because "the questions
 * before the first heading" is what an ungrouped field is. */
interface Section {
  readonly group: string;
  readonly rows: FeatureDef[];
}

/** Features → sections, ungrouped first, each group in the order its first
 * feature appears. Pure, so `test/fields.test.tsx` can assert the ORDER
 * without rendering. */
export function featureSections(features: readonly FeatureDef[]): readonly Section[] {
  const byGroup = new Map<string, FeatureDef[]>([["", []]]);
  for (const feature of features) {
    const group = typeof feature.group === "string" ? feature.group.trim() : "";
    const rows = byGroup.get(group);
    if (rows === undefined) byGroup.set(group, [feature]);
    else rows.push(feature);
  }
  return [...byGroup.entries()]
    .filter(([, rows]) => rows.length > 0)
    .map(([group, rows]) => ({ group, rows }));
}

/** `FeatureDef.hints` → resolved `{title, content}` pairs. Both members are
 * key-or-literal, like `name`: the catalogue supplies either, and `t()` hands
 * back an unknown key unchanged. */
function resolveHints(
  feature: FeatureDef,
  t: (key: string) => string
): readonly FeatureHint[] {
  const raw = feature.hints;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  return raw
    .filter((hint): hint is { title?: unknown; content?: unknown } =>
      typeof hint === "object" && hint !== null
    )
    .map((hint) => ({
      title: typeof hint.title === "string" && hint.title.length > 0 ? t(hint.title) : "",
      content: typeof hint.content === "string" && hint.content.length > 0 ? t(hint.content) : "",
    }))
    .filter((hint) => hint.title.length > 0 || hint.content.length > 0);
}

/**
 * A category's features as form rows, each drawn by the ladder's winner.
 *
 * It is its OWN skin root (`SkinTheme surface="bare"`): a composer that
 * renders this on a dark page without a `ConfigProvider` above it used to get
 * antd's light algorithm — light inputs and near-invisible text on a dark
 * form. `"bare"` because these are form ROWS inset in a surface the host
 * already painted; the theme applies, the paint stays the host's. Nested
 * `SkinTheme`s cost nothing, so a host that wraps the composer too is free.
 *
 * The same root is the column whose WIDTH decides the touch floor — see
 * {@link TOUCH_FLOOR_BELOW}.
 */
export function FeatureFields(props: FeatureFieldsProps): ReactElement {
  const t = useT();
  const errors = props.errors ?? {};
  const column = useRef<HTMLDivElement>(null);
  const { below } = useElementWidth(column, {
    thresholds: { touch: TOUCH_FLOOR_BELOW },
  });

  const { features, values } = props;
  // A vocabulary-backed type with no client is undrawable at the ROW level,
  // not just inside the editor: the notice names the feature itself, so a
  // labelled row would print "Brand" twice — once as the label and once in the
  // alert, which is exactly the C-DEVCOPY defect the notice was reshaped to
  // avoid.
  const vocabularyClient = useVocabularyClient();
  // A feature whose `rules` do not parse is pulled OUT of the pre-pass rather
  // than taking it down: the other twelve rows still have to be drawn, and
  // this one is drawn as the notice.
  const broken = useMemo(() => ruleErrors(features), [features]);
  const states = useMemo(
    () => evaluateRules(features.filter((one) => broken[one.slug] === undefined), values),
    [features, values, broken]
  );

  const sections = useMemo(
    () =>
      featureSections(features).map((section) => ({
        group: section.group,
        rows: section.rows.filter(
          (feature) => (states[feature.slug] ?? VISIBLE_STATE).visible
        ),
      })),
    [features, states]
  );

  return (
    <SkinTheme surface="bare">
      <TouchFloorProvider value={below.touch ?? false}>
        <div ref={column} data-testid="attributes-fields">
          {sections.map((section) =>
            section.rows.length === 0 ? null : (
              <div
                key={section.group || " ungrouped"}
                data-attributes-group={section.group}
                data-testid={featureSectionTestId(section.group)}
              >
                {section.group.length > 0 && (
                  <>
                    <Typography.Title
                      level={5}
                      style={{ marginBottom: spacing[1] }}
                      data-testid={`${featureSectionTestId(section.group)}-heading`}
                    >
                      {/* `group` is key-or-literal, exactly like `name`. */}
                      {t(section.group)}
                    </Typography.Title>
                    <Divider style={{ marginTop: 0, marginBottom: spacing[3] }} />
                  </>
                )}
                {section.rows.map((feature) => {
                  const controlId = featureControlId(feature.slug);
                  const type = featureType(feature);
                  const state: RuleState = states[feature.slug] ?? VISIBLE_STATE;
                  // The ladder: a host's explicit registration outranks the
                  // skin's builtin, and nothing at all is a NOTICE, never an
                  // omission.
                  const Editor =
                    (type === undefined ? null : resolveValueEditor(type)) ??
                    (type === undefined ? undefined : BUILTIN_VALUE_EDITORS[type]);
                  const invalidRules = broken[feature.slug] !== undefined;
                  const noSource =
                    vocabularyClient === null &&
                    type !== undefined &&
                    VOCABULARY_BACKED_TYPES.includes(type);
                  const unsupported =
                    invalidRules || noSource || Editor === undefined || Editor === null;
                  const required = requiredRow(feature, state);
                  // The editor sees the NARROWED config plus, for the types
                  // that have a text box, the catalogue's `example` as the
                  // placeholder — so editors need to know about neither rules
                  // nor form metadata.
                  const drawn = withExample(narrowFeature(feature, state), t);
                  const control = unsupported ? (
                    <UnsupportedValueEditor
                      feature={feature}
                      {...(invalidRules
                        ? { reason: ATTRIBUTES_I18N_KEYS.invalidRules }
                        : noSource
                          ? { reason: ATTRIBUTES_I18N_KEYS.vocabularyUnavailable }
                          : {})}
                    />
                  ) : (
                    <Editor
                      id={controlId}
                      feature={drawn}
                      value={props.values[feature.slug]}
                      siblings={props.values}
                      onChange={(value) => props.onChange(feature.slug, value)}
                      error={errors[feature.slug]}
                      disabled={props.disabled === true}
                      required={required}
                    />
                  );
                  const description =
                    typeof feature.description === "string" ? feature.description.trim() : "";
                  const row: FeatureRowProps = {
                    feature: drawn,
                    stacked: below.touch ?? false,
                    controlId,
                    control,
                    error: errors[feature.slug],
                    required,
                    help: description.length > 0 ? t(description) : undefined,
                    hints: resolveHints(feature, t),
                    unsupported,
                  };
                  // The row's test id lives on the WRAPPER rather than on the
                  // field itself, so it is the same element whether the host
                  // supplied `renderRow` or not: a measurement that changed
                  // shape with the host's chrome would be measuring the chrome.
                  return (
                    <div
                      key={feature.slug}
                      data-testid={featureRowTestId(feature.slug)}
                    >
                      {props.renderRow ? (
                        <>{props.renderRow(row)}</>
                      ) : (
                        <FeatureRow {...row} />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </TouchFloorProvider>
    </SkinTheme>
  );
}

/** Requiredness for one row, from its rule state. Kept beside the renderer
 * (rather than calling `featureAnswerRequired(feature, values)` again) so the
 * row reads the SAME state object the config was narrowed from — two
 * evaluations of the same thing in one render is how a marker and a refusal
 * start disagreeing. */
function requiredRow(feature: FeatureDef, state: RuleState): boolean {
  const type = featureType(feature);
  if (type === "header" || !state.visible) return false;
  if (state.required) return true;
  // `hierarchical_select.required` defaults to true — the one type carrying
  // its own switch beside `mandatory` (see `validate.ts`).
  return type === "hierarchical_select" && featureConfig(feature)["required"] !== false;
}

/** `FeatureDef.example` → the control's `placeholder`, for the types that have
 * one. A placeholder the config already set wins: it is the more specific
 * statement, and 99.9% of imported fields carry an example that would
 * otherwise overwrite it. */
function withExample(feature: FeatureDef, t: (key: string) => string): FeatureDef {
  const type = featureType(feature);
  if (type === undefined || !EXAMPLE_TYPES.has(type)) return feature;
  const example = typeof feature.example === "string" ? feature.example.trim() : "";
  if (example.length === 0) return feature;
  const config = featureConfig(feature);
  if (typeof config["placeholder"] === "string" && config["placeholder"].length > 0) {
    return feature;
  }
  return { ...feature, config: { ...config, placeholder: t(example) } };
}
