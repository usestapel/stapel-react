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
 *  - REQUIRED comes from the evaluated state, never from `mandatory` alone —
 *    literally the same function call the mirror refuses with
 *    (`featureRequiredUnder`), so the asterisk and the refusal cannot drift
 *    apart, and a `require` rule whose condition is not met draws no marker
 *    and demands nothing;
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
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Divider, Form, Tag, Typography } from "antd";
import { useFormatFlowError, useT } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import { SkinTheme, useElementWidth } from "@stapel/tokens-antd/skin";
import { spacing } from "@stapel/tokens";
import type { FeatureDef } from "../types.js";
import { featureConfig, featureName, featureType } from "../types.js";
import type { FeatureVisibility } from "../visibility.js";
import { featureVisibility } from "../visibility.js";
import type { RuleState } from "../rules.js";
import {
  VISIBLE_STATE,
  evaluateRules,
  narrowFeature,
  ruleErrors,
  stringify,
} from "../rules.js";
import {
  dependencyParentOf,
  sameAnswer,
  soleAllowedValue,
  undisclosedSlugs,
} from "../disclosure.js";
import { featureRequiredUnder } from "../validate.js";
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

/**
 * The test id of the DISCLOSURE NOTICE on a non-public field — the line that
 * names who does see what the seller is about to type. The tag beside the
 * label is the same id suffixed `-tag`, following the section builder's
 * `${featureSectionTestId(group)}-heading` convention.
 *
 * Absent on a `public` field, which is every field a catalogue has today
 * unless someone deliberately marked one otherwise.
 */
export function featureVisibilityTestId(slug: string): string {
  return `attributes-visibility-${slug}`;
}

/** The value types whose control has a text box an `example` can sit in. A
 * `select` has no placeholder an example would mean anything in, and putting
 * one on a `Switch` is nonsense. */
const EXAMPLE_TYPES = new Set(["string", "int", "float"]);

/**
 * Whether the named sections open and close, and what they do on the first
 * frame.
 *
 *  - `"none"` (default) — every section is drawn open, headings and all. What
 *    this component has always done, and what a filter panel or an admin
 *    preview wants: a section nobody can see is a section nobody can read.
 *  - `"auto"` — every named section is a disclosure, and it starts OPEN when
 *    it asks something the person MUST answer or something they already have
 *    (see {@link sectionOpensByDefault}). An imported catalogue is mostly
 *    plumbing — a phone leaf carries 32 fields across seven groups, of which
 *    four are parcel dimensions and three are wholesale terms — and a form
 *    that asks all of it at full height is a form nobody reaches the bottom
 *    of. Every heading stays on screen; only the answers behind the optional
 *    ones are one tap away.
 */
export type FeatureGroupCollapse = "none" | "auto";

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
  /** Whether the named sections collapse, and what they do on the first
   * frame. Default `"none"` — see {@link FeatureGroupCollapse}. */
  readonly groupCollapse?: FeatureGroupCollapse;
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
  /**
   * Who may READ this value once it is stored (`FeatureDef.visibility`), and
   * therefore what the seller has to be told BEFORE they type it.
   *
   * Orthogonal to {@link required}: a `mandatory` VIN with `visibility:
   * "owner"` is still required, still validated, still stored and still
   * moderated — it is simply never handed to a buyer. `public` for every
   * field a catalogue has unless someone marked one otherwise, so a host's
   * `renderRow` that ignores this prop keeps behaving exactly as it did.
   */
  readonly visibility: FeatureVisibility;
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

/**
 * Above this many characters the catalogue's help text is a DISCLOSURE rather
 * than a line.
 *
 * 99.9% of imported fields carry a `description`, and most of them are one
 * short sentence that belongs under the box unfolded. A handful are three:
 * measuring instructions, what counts as a defect, which document a number is
 * copied from. Stacked at full height under every field they push the next
 * question off a phone screen, and a form nobody scrolls to the bottom of is
 * a form with unanswered fields at the end of it. The number is the length at
 * which a help line stops being a caption and starts being a paragraph —
 * roughly two lines at the phone body size.
 */
const HELP_COLLAPSE_ABOVE = 140;

/**
 * The field's help: the catalogue's sentence, or a disclosure holding it.
 *
 * A native `<details>`, so the keyboard, the screen reader and find-in-page
 * all work without this component owning any of it — the same reason the
 * section headings are one. Collapsed by default and never for a short help,
 * because a disclosure over one sentence is a tap charged for nothing.
 */
function FeatureHelp(props: { readonly help: string }): ReactElement {
  const t = useT();
  if (props.help.length <= HELP_COLLAPSE_ABOVE) return <>{props.help}</>;
  return (
    <details data-testid="attributes-help-more">
      <summary style={{ cursor: "pointer" }}>{t(ATTRIBUTES_I18N_KEYS.helpMore)}</summary>
      {props.help}
    </details>
  );
}

/**
 * What a seller is owed AT THE FIELD when the answer will not be published.
 *
 * A mandatory VIN is a strange thing to be asked for, and the question a
 * person asks themselves while typing one is "who is going to see this?".
 * Answering it in a help page somewhere is not answering it: the sentence
 * belongs under the box, on the render that asks. So a non-public row gets
 * two things — a neutral tag beside the label saying the value is not
 * published, and this line naming the audience that does see it.
 *
 * `owner` and `staff` are genuinely different promises and are worded as
 * two: with `owner` the seller's own view keeps showing them the number, with
 * `staff` it does not come back at all, and being surprised by that after
 * saving is worse than being told before.
 */
function VisibilityNotice(props: { readonly visibility: FeatureVisibility; readonly slug: string }):
  | ReactElement
  | null {
  const t = useT();
  if (props.visibility === "public") return null;
  return (
    <div
      style={{ marginTop: spacing[1] }}
      data-testid={featureVisibilityTestId(props.slug)}
      data-attributes-visibility={props.visibility}
    >
      <Typography.Text type="secondary">
        {t(
          props.visibility === "staff"
            ? ATTRIBUTES_I18N_KEYS.visibilityStaff
            : ATTRIBUTES_I18N_KEYS.visibilityOwner
        )}
      </Typography.Text>
    </div>
  );
}

function FeatureRow(props: FeatureRowProps): ReactElement {
  const format = useFormatFlowError();
  const t = useT();
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
  //
  // The disclosure notice joins them, LAST: help says what to type, hints say
  // what not to, and this says where the answer goes. It is not folded into
  // `help` because it is not the catalogue's sentence — it is a consequence
  // of the definition, and a category that writes no `description` still owes
  // the seller this line.
  // Kept `null` rather than an always-rendered component that returns null
  // internally: `extra` is an antd SLOT, and handing it an empty fragment
  // paints an empty box under every public field on the form.
  const notice =
    props.visibility === "public" ? null : (
      <VisibilityNotice visibility={props.visibility} slug={props.feature.slug} />
    );
  const extra =
    props.help === undefined && props.hints.length === 0 && notice === null ? undefined : (
      <>
        {props.help !== undefined && <FeatureHelp help={props.help} />}
        <FeatureHints hints={props.hints} />
        {notice}
      </>
    );
  return (
    <Form.Item
      label={
        props.visibility === "public" ? (
          featureName(props.feature)
        ) : (
          <>
            {featureName(props.feature)}
            <Tag
              style={{ marginInlineStart: spacing[1] }}
              data-testid={`${featureVisibilityTestId(props.feature.slug)}-tag`}
            >
              {t(ATTRIBUTES_I18N_KEYS.visibilityNotPublished)}
            </Tag>
          </>
        )
      }
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

/** Has this field been answered? An empty string and an empty table are the
 * same absence as `undefined` — the shape `toFeaturesDto` drops. */
function answered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Does a collapsing section start open?
 *
 * Yes when it asks something the person MUST answer, or something they have
 * already answered. Otherwise it is optional and untouched, and it starts
 * closed with its heading still on screen.
 *
 * The rule is the schema's, not a list of group NAMES. A catalogue's groups
 * are admin-authored text in the deployment's own language, and a library that
 * recognised "Delivery" by spelling would sort one deployment and mis-sort
 * every other one it was translated for. Requiredness is the
 * one thing every catalogue states in a machine-readable way, and it happens
 * to draw the line where a person would: what a listing cannot be published
 * without is what identifies the thing; the parcel's width is not.
 *
 * It is a DEFAULT and not a rule about visibility: the heading is always
 * drawn, the disclosure is native, and a rule that turns a hidden row required
 * (`condition = used` → "screen condition") re-opens its section on the render
 * that does it.
 */
function sectionOpensByDefault(
  rows: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>>,
  states: Readonly<Record<string, RuleState>>
): boolean {
  return rows.some(
    (feature) =>
      featureRequiredUnder(feature, states[feature.slug] ?? VISIBLE_STATE) ||
      answered(values[feature.slug])
  );
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

  // What the PERSON has decided about a section, keyed by group. Absent means
  // "they have not touched this one", and the default still speaks.
  const collapsing = props.groupCollapse === "auto";
  const [openState, setOpenState] = useState<Readonly<Record<string, boolean>>>({});

  // Progressive disclosure: a field whose allowed set is scoped by a sibling
  // (`optionsRef.parentFeature`) is not DRAWN until that sibling is answered.
  // The second visibility gate, composed with the rules' — see disclosure.ts.
  const gated = useMemo(() => undisclosedSlugs(features, values), [features, values]);

  const sections = useMemo(
    () =>
      featureSections(features).map((section) => ({
        group: section.group,
        rows: section.rows.filter(
          (feature) =>
            (states[feature.slug] ?? VISIBLE_STATE).visible &&
            !gated.has(feature.slug)
        ),
      })),
    [features, states, gated]
  );

  // ── the two write-backs this component performs ──────────────────────────
  //
  // It is otherwise stateless, so both are stated in full:
  //
  //  1. RESET a dependent field when its parent MOVES (or empties). The
  //     child's answer belonged to the old parent, and the row itself may be
  //     unmounted by the disclosure gate — so an editor-level effect could
  //     never fire. Guarded by a previous-parent map so a mount does not
  //     clear a seeded draft.
  //  2. BAKE the sole allowed value (the bake rule): when the narrowed config
  //     leaves exactly one answer, commit it through the SAME `onChange` a
  //     user pick takes, and remember doing so — so that when the collapse
  //     stops holding, the baked (never-chosen) value is RESET rather than
  //     left standing as if the person had picked it. A value the person
  //     picked themselves is never in the baked map and is never cleared.
  const onChange = props.onChange;
  const seenParents = useRef(new Map<string, string>());
  const bakedValues = useRef(new Map<string, unknown>());
  useEffect(() => {
    const defined = new Set(features.map((one) => one.slug));
    for (const feature of features) {
      const parent = dependencyParentOf(feature);
      if (parent === undefined || !defined.has(parent)) continue;
      const canon = stringify(values[parent]).join(" ");
      const seen = seenParents.current.get(feature.slug);
      seenParents.current.set(feature.slug, canon);
      if (seen === undefined || seen === canon) continue;
      if (stringify(values[feature.slug]).length > 0) {
        bakedValues.current.delete(feature.slug);
        onChange(feature.slug, undefined);
      }
    }
    for (const feature of features) {
      if (broken[feature.slug] !== undefined) continue;
      const state = states[feature.slug] ?? VISIBLE_STATE;
      const sole =
        state.visible && !gated.has(feature.slug)
          ? soleAllowedValue(narrowFeature(feature, state))
          : undefined;
      const current = values[feature.slug];
      if (sole !== undefined) {
        bakedValues.current.set(feature.slug, sole);
        if (!sameAnswer(current, sole)) onChange(feature.slug, sole);
        continue;
      }
      const prior = bakedValues.current.get(feature.slug);
      if (prior === undefined) continue;
      bakedValues.current.delete(feature.slug);
      if (sameAnswer(current, prior)) onChange(feature.slug, undefined);
    }
  }, [features, values, states, gated, broken, onChange]);

  return (
    <SkinTheme surface="bare">
      <TouchFloorProvider value={below.touch ?? false}>
        <div ref={column} data-testid="attributes-fields">
          {sections.map((section) => {
            if (section.rows.length === 0) return null;
            // The ungrouped rows are "the questions before the first heading":
            // there is no heading to press, so there is nothing to collapse.
            const collapsible = collapsing && section.group.length > 0;
            const open =
              openState[section.group] ??
              sectionOpensByDefault(section.rows, values, states);
            const heading =
              section.group.length === 0 ? null : (
                <Typography.Title
                  level={5}
                  style={
                    collapsible
                      ? { marginBottom: 0, display: "inline-block" }
                      : { marginBottom: spacing[1] }
                  }
                  data-testid={`${featureSectionTestId(section.group)}-heading`}
                >
                  {/* `group` is key-or-literal, exactly like `name`. */}
                  {t(section.group)}
                </Typography.Title>
              );
            const rows = section.rows.map((feature) => {
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
                  const required = featureRequiredUnder(feature, state);
                  // The editor sees the NARROWED config plus, for the types
                  // that have a text box, the catalogue's `example` as the
                  // placeholder — so editors need to know about neither rules
                  // nor form metadata.
                  const drawn = withExample(narrowFeature(feature, state), t);
                  // Baked (the bake rule): the narrowed config leaves one answer
                  // and the write-back above has committed it — the control
                  // greys out and the reason stands beside it, per the house
                  // rule that nothing is switched off silently. Async
                  // collapses (a chained ref rung, a vocabulary-backed int)
                  // render the same notice from inside their editors, which
                  // are the only holders of the fetched terms.
                  // On `sole` alone, not on the value having landed: the
                  // write-back commits it within the same tick, and a control
                  // that flickered live in between would accept a pick the
                  // form is about to overwrite.
                  const baked = !unsupported && soleAllowedValue(drawn) !== undefined;
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
                    <>
                      <Editor
                        id={controlId}
                        feature={drawn}
                        value={props.values[feature.slug]}
                        siblings={props.values}
                        onChange={(value) => props.onChange(feature.slug, value)}
                        error={errors[feature.slug]}
                        disabled={props.disabled === true || baked}
                        required={required}
                      />
                      {baked && (
                        <Typography.Text
                          type="secondary"
                          style={{ display: "block", marginTop: spacing[1] }}
                          data-testid={`attributes-baked-${feature.slug}`}
                        >
                          {t(ATTRIBUTES_I18N_KEYS.bakedByConstraint)}
                        </Typography.Text>
                      )}
                    </>
                  );
                  const description =
                    typeof feature.description === "string" ? feature.description.trim() : "";
                  // A description that merely restates the label is noise, not
                  // help (D54): live imports stamp `description == name` on
                  // nearly every field, which drew a grey echo of the label
                  // under each box. Compared RESOLVED, since both members are
                  // key-or-literal and either may be the catalogue key of the
                  // other's text.
                  const resolvedHelp =
                    description.length > 0 ? t(description) : undefined;
                  const help =
                    resolvedHelp !== undefined &&
                    resolvedHelp !== featureName(feature) &&
                    resolvedHelp !== t(featureName(feature))
                      ? resolvedHelp
                      : undefined;
                  const row: FeatureRowProps = {
                    feature: drawn,
                    stacked: below.touch ?? false,
                    controlId,
                    control,
                    error: errors[feature.slug],
                    required,
                    help,
                    hints: resolveHints(feature, t),
                    unsupported,
                    // Read off the ORIGINAL definition, not the narrowed one:
                    // rules narrow a config, they never move a value between
                    // audiences, and taking it from the row the catalogue
                    // sent keeps that impossible to get wrong.
                    visibility: featureVisibility(feature),
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
            });
            const inside = (
              <>
                {collapsible ? (
                  <summary
                    style={{ cursor: "pointer", marginBottom: spacing[1] }}
                    data-testid={`${featureSectionTestId(section.group)}-summary`}
                  >
                    {heading}
                  </summary>
                ) : (
                  heading
                )}
                {heading === null ? null : (
                  <Divider style={{ marginTop: 0, marginBottom: spacing[3] }} />
                )}
                {rows}
              </>
            );
            // A native disclosure, so the keyboard, the screen reader and
            // find-in-page all behave without this component owning any of it.
            // `open` is held here rather than left to the DOM because the
            // DEFAULT can legitimately change under a rule ("screen condition"
            // becomes required once the condition is `used`), and a browser
            // will not re-read an attribute it has already applied.
            return collapsible ? (
              <details
                key={section.group}
                data-attributes-group={section.group}
                data-testid={featureSectionTestId(section.group)}
                style={{ marginBottom: spacing[3] }}
                open={open}
                onToggle={(event) => {
                  const next = event.currentTarget.open;
                  setOpenState((current) =>
                    current[section.group] === next
                      ? current
                      : { ...current, [section.group]: next }
                  );
                }}
              >
                {inside}
              </details>
            ) : (
              <div
                key={section.group || " ungrouped"}
                data-attributes-group={section.group}
                data-testid={featureSectionTestId(section.group)}
              >
                {inside}
              </div>
            );
          })}
        </div>
      </TouchFloorProvider>
    </SkinTheme>
  );
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
