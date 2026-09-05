/**
 * `<FacetGroupControl>` — ONE facet group, drawn the way its own schema says
 * it should be drawn.
 *
 * Until this release every group was the same thing: a flat column of
 * checkboxes, however many options it had and whatever the category schema
 * said about it. That is wrong in three ways a person meets on the first
 * screen of a real catalogue:
 *
 *  1. **A single-choice facet is not a checkbox list.** `maxSelected: 1` is a
 *     fact the schema already carries, and `@stapel/attributes-react`'s editor
 *     already reads it to draw a segmented control rather than a set of boxes.
 *     A filter that says "pick one" with controls that say "pick any" teaches
 *     the wrong thing before the click and surprises after it.
 *  2. **A hierarchical facet is not flat.** `hierarchical_select` carries a
 *     TREE in `config.options`; rendering its values as one alphabetical
 *     column hides that "Sedan" is under "Cars" and puts a child next to its
 *     own parent as if they were siblings.
 *  3. **A 60-option facet is not a list, it is a wall.** Every catalogue has
 *     one — brand, model, city — and printing all of it pushes every group
 *     under it off the screen.
 *  4. **A vocabulary is not a long list, it is a DICTIONARY.** 418 car makes
 *     behind "Show all (418)" is a control whose only mode is "read all of
 *     it": the busiest values, a box, and the rest reachable by typing is the
 *     only shape that answers "I want a Toyota" in one gesture. See
 *     {@link isDictionaryFacet}.
 *
 * ── The presentation is DERIVED, never configured here ────────────────────
 *
 * {@link facetGroupShape} reads the same `config` keys the attributes editor
 * reads (`maxSelected`, `type`, `options`), so a facet cannot look one way in
 * the filter and another way in the composer that produced the value. There is
 * no `presentation` prop on this component and there must not be one: a
 * per-call-site override is how the two halves drift.
 *
 * A group with NO schema (the host passed no `categoryFeatures`, or the slug
 * is not in it) is a flat checkbox list — the honest default, and the shape
 * every group had before.
 *
 * ── The group can be a disclosure, and closed it is NOT in the DOM ─────────
 *
 * Measured on a live classified deployment's cars leaf at 1440×900: the 280px
 * rail carried 5717px of content — 40 groups, 118 checkboxes, 66 fields — as
 * one flat column. No amount of per-group folding fixes forty headings' worth
 * of open controls, so the group itself can close: `collapsible` turns the
 * label into a real `<button aria-expanded>` with a chevron and, when values
 * are chosen inside, the count of them — the one fact a closed group owes its
 * header. Closed means the options are not rendered at all: a hundred
 * `display:none` checkboxes are still a hundred stops for a screen reader.
 * Both props default to today's behaviour (always open, no disclosure), so no
 * existing host changes; WHICH groups open is the panel's decision, not this
 * component's — see `FacetPanelPane`.
 *
 * ── Uncounted options are the fold's tail, not the group's face ────────────
 *
 * The same walk found "not counted" printed 100+ times down the default view.
 * The sentence is honest and it stays — but an option with no evidence behind
 * it must not stand in front of one that has some, so options with
 * `count: null` and nothing chosen sort AFTER every counted one and live
 * behind the existing "Show all (N)" fold. A group whose options are ALL
 * uncounted (a schema-only group — the server never counted the slug) keeps
 * them visible as before: folding everything would leave a heading over
 * nothing. Chosen options are always visible, wherever their count went.
 */
import { useMemo, useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Checkbox, Flex, Input, Typography } from "antd";
import { useT } from "@stapel/core";
import { SkinPickerSheet } from "@stapel/tokens-antd/skin";
import type { PickerGroup, PickerOption } from "@stapel/tokens-antd/skin";
import { controls, cssVar, radii, spacing } from "@stapel/tokens";
import { featureConfig, featureType } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import { facetGroupIsVocabularyBacked } from "../state/facets.js";
import type { FacetGroup, FacetOption } from "../state/facets.js";
import { translitPrefixMatch } from "../state/translit.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/**
 * How many options a group shows before the rest go behind "Show all".
 *
 * Eight is the count at which a group stops being readable at a glance and
 * starts being a scroll: it is two more than the six the visual pass measured
 * as the fold on a 390px phone with the sheet's own chrome above it, which
 * leaves a group of seven whole rather than truncated by one row.
 */
export const FACET_VISIBLE_OPTIONS = 8;

/**
 * From how many values a group stops being a list and becomes a DICTIONARY —
 * the same eight, because it is the same fold: past it the group is drawn as
 * its busiest values plus a box that searches the rest.
 */
export const FACET_DICTIONARY_THRESHOLD: number = FACET_VISIBLE_OPTIONS;

/** The four shapes a facet group takes. */
export type FacetGroupShape =
  | "segmented"
  | "nested"
  | "checkbox"
  | "dictionary";

/** The option rows of a group, already nested where the schema nests them. */
export interface FacetOptionNode {
  readonly option: FacetOption;
  /** 0 for a root option; 1+ for a child of a `hierarchical_select` tree. */
  readonly depth: number;
}

function numberish(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * The DEPTH of every value a `hierarchical_select` config declares, walked
 * once — `{value: depth}`.
 *
 * The tree lives in `config.options[].children[]` (the same shape
 * `@stapel/attributes-react`'s `Cascader` reads). The facets themselves arrive
 * FLAT from the server, because an index term has no parent; the schema is the
 * only thing that knows one value sits under another.
 */
function optionDepths(
  raw: unknown,
  depth = 0,
  into: Map<string, number> = new Map()
): Map<string, number> {
  if (!Array.isArray(raw)) return into;
  for (const option of raw) {
    if (option === null || typeof option !== "object") continue;
    const entry = option as { value?: unknown; children?: unknown };
    if (entry.value !== undefined && entry.value !== null) {
      into.set(String(entry.value), depth);
    }
    optionDepths(entry.children, depth + 1, into);
  }
  return into;
}

/** Is this feature single-choice? The schema's own answer, not a guess. */
function singleChoice(feature: FeatureDef | undefined): boolean {
  if (feature === undefined) return false;
  // `maxSelected` ABSENT means unlimited — the engine's own default. Reading
  // an absent key as 1 would turn every unconfigured facet into a radio group.
  return numberish(featureConfig(feature)["maxSelected"]) === 1;
}

/**
 * Slugs a marketplace's own mapping conventionally normalizes an EITHER/OR
 * axis to, whatever language the printed labels end up in — a scraped
 * catalogue's own "condition" column, however it was captioned on the source
 * site, becomes one `condition` slug upstream of this component, so the slug
 * is the one part of a schemaless group that survives translation. `is_*`/
 * `has_*` catches a bare boolean the same way.
 */
const EXCLUSIVE_AXIS_SLUGS: ReadonlySet<string> = new Set([
  "condition",
  "item_condition",
  "product_condition",
  "state",
]);

function looksLikeExclusiveAxisSlug(slug: string): boolean {
  const normalized = slug.toLowerCase();
  if (/^(is|has)_/.test(normalized)) return true;
  return EXCLUSIVE_AXIS_SLUGS.has(normalized);
}

/**
 * Does a SCHEMALESS group's evidence look like a closed EITHER/OR rather
 * than an open list — "pick one of these two or three" rather than "tick any
 * of these"?
 *
 * There is no authoritative answer to read: `facet_meta` reports `skipped`,
 * `withheld`, `ranges`, `plan`, `categories` and nothing that marks an axis
 * single-valued, so a group with no `feature` (no schema, no `maxSelected`)
 * has no `single` hint to defer to today. Once the plan sends one, THIS
 * FUNCTION IS THE PLACE TO PREFER IT over the guess below.
 *
 * Until then: 2–3 counted buckets under a slug that reads as a condition or
 * a boolean ({@link looksLikeExclusiveAxisSlug}) draw as segmented pills, on
 * the same reasoning `singleChoice` already applies to a typed def — a
 * two-way "new/used" read as tick-any-of-these is the wrong control before
 * the first click. Every other schemaless small group (`color`, `size`)
 * stays checkboxes: nothing here says a person can only want one, and
 * assuming so for every short option list would turn `color` into a radio
 * button the moment nobody threaded its schema through.
 *
 * Stated honestly, this is a GUESS keyed on the slug alone — it will miss an
 * axis mapped under a slug not in {@link EXCLUSIVE_AXIS_SLUGS} and it will
 * fire wrongly if some catalogue really does mean "condition" as a
 * multi-select. Both failures draw checkboxes for a true either/or or pills
 * for a true multi-select respectively — a shape mismatch, not a filter that
 * stops working, and one a real `facet_meta` hint replaces outright.
 */
function looksSingleChoiceByEvidence(group: FacetGroup): boolean {
  if (group.feature !== undefined) return false;
  if (!looksLikeExclusiveAxisSlug(group.slug)) return false;
  const buckets = group.options.filter(
    (option) => option.count !== null && option.count > 0
  ).length;
  return buckets >= 2 && buckets <= 3;
}

/**
 * Is this group a DICTIONARY — an axis whose values live in a vocabulary?
 *
 * Two ways to be one, and only the second one counts anything:
 *
 *  - the axis is VOCABULARY-BACKED (`facetGroupIsVocabularyBacked`): the def
 *    types it `ref_select`/`ref_hierarchical_select`, so its config is a
 *    POINTER and there was never an option table to draw — or there is no def
 *    and the answer named the vocabulary itself. **However many buckets came
 *    back.** This threshold used to be counted against the answer's evidence,
 *    and on a stand holding three cars the make axis has three buckets, drew
 *    three checkboxes, and hid the other four hundred makes behind nothing at
 *    all: the founder's "what if there are hundreds of options" is a question about the DICTIONARY,
 *    and the dictionary is large whether or not this leaf has stock. The
 *    field is also the only control that can search values the answer never
 *    enumerated, which is exactly the case a thin stand produces;
 *  - there is NO def at all and the answer came back with more values than a
 *    fold. At a live classified's cars branch the storefront passed an empty
 *    feature list, so the 418 makes arrived as an unnamed, untyped group of
 *    418 checkboxes behind "Show all (418)". A box is the only control that
 *    answers that, and refusing to draw one because the schema is missing
 *    punishes the buyer for the wiring.
 *
 * An INLINE option set is never one, whatever its length: a `select` carries
 * its own table, that table is the whole of the axis, and a small one
 * (≤ {@link FACET_DICTIONARY_THRESHOLD} options) is a list a person reads at
 * a glance rather than types into.
 */
export function isDictionaryFacet(group: FacetGroup): boolean {
  if (facetGroupIsVocabularyBacked(group)) return true;
  // A typed def that is not vocabulary-backed carries its options inline:
  // checkboxes or pills, however many there are.
  if (group.feature !== undefined) return false;
  const buckets = group.options.filter(
    (option) => option.count !== null && option.count > 0
  ).length;
  return buckets > FACET_DICTIONARY_THRESHOLD;
}

/**
 * Which of the four shapes a group takes.
 *
 * Order matters, and it changed in one place after a live measurement:
 *
 *  - a hierarchical facet is nested even when it is single-choice, because
 *    losing the tree costs more than losing the pills;
 *  - a DICTIONARY outranks the pills. The make axis on the live cars leaf
 *    `maxSelected: 1` over a 418-value vocabulary, so "pick one" won and the
 *    control it produced was four hundred pills in a 280px rail — a wall
 *    with a different border radius. Above the fold the shape a person needs
 *    is a search box, whether or not they may tick two. A single-choice axis
 *    with an INLINE option table still means pills, because a dictionary is
 *    now about where the values live and not about how many came back;
 *  - and a dictionary is a dictionary before it is a checkbox list, because
 *    the checkbox list is the shape it was drawn as when nobody could pick a
 *    make.
 *
 * A group with NO schema falls to {@link looksSingleChoiceByEvidence} for the
 * segmented/checkbox call, since `singleChoice` has no `feature` to read
 * `maxSelected` off of — see that function for what it checks and why it is
 * a documented guess, not a fact read off the wire.
 */
export function facetGroupShape(group: FacetGroup): FacetGroupShape {
  const feature = group.feature;
  if (feature !== undefined && featureType(feature) === "hierarchical_select") {
    return "nested";
  }
  if (isDictionaryFacet(group)) return "dictionary";
  if (singleChoice(feature) || looksSingleChoiceByEvidence(group)) return "segmented";
  return "checkbox";
}

/**
 * Is this node in the group's uncounted tail — an option with no evidence
 * behind it AND no choice on it? Only meaningful in a group that has counted
 * evidence at all: see {@link facetOptionNodes}.
 */
function uncountedUnchosen(node: FacetOptionNode): boolean {
  return node.option.count === null && !node.option.selected;
}

/** The group's options in render order, carrying the depth the schema gives. */
export function facetOptionNodes(group: FacetGroup): readonly FacetOptionNode[] {
  let nodes: readonly FacetOptionNode[];
  if (facetGroupShape(group) !== "nested" || group.feature === undefined) {
    nodes = group.options.map((option) => ({ option, depth: 0 }));
  } else {
    const depths = optionDepths(featureConfig(group.feature)["options"]);
    // Depth alone would leave children beside strangers: the options are
    // re-ordered so each child follows its own parent, and a value the schema
    // does not know keeps depth 0 rather than being hidden under someone.
    const byValue = new Map(group.options.map((option) => [option.value, option]));
    const out: FacetOptionNode[] = [];
    const emitted = new Set<string>();
    for (const [value, depth] of depths) {
      const option = byValue.get(value);
      if (option === undefined) continue;
      out.push({ option, depth });
      emitted.add(value);
    }
    for (const option of group.options) {
      if (!emitted.has(option.value)) out.push({ option, depth: 0 });
    }
    nodes = out;
  }

  // An option nobody counted must not stand in front of one with evidence:
  // the uncounted, unchosen tail sorts after everything else (stable — both
  // halves keep their own order) and folds behind "Show all" in the
  // component below. Only in a group that HAS counted evidence: a schema-only
  // group is all `null`, and demoting all of it would reorder nothing while
  // telling the fold to hide the entire group behind its own heading.
  if (!group.options.some((option) => option.count !== null)) return nodes;
  const tail = nodes.filter(uncountedUnchosen);
  if (tail.length === 0) return nodes;
  return [...nodes.filter((node) => !uncountedUnchosen(node)), ...tail];
}

/** A count, or the honest "we did not count this". Never a zero standing in
 * for an absent answer. */
function OptionCount(props: {
  readonly group: FacetGroup;
  readonly option: FacetOption;
}): ReactElement {
  const t = useT();
  return (
    <Typography.Text
      type="secondary"
      data-testid={`facet-count-${props.group.slug}-${props.option.value}`}
    >
      {props.option.count === null
        ? t(SEARCH_I18N_KEYS.facetsNotCounted)
        : props.option.count}
    </Typography.Text>
  );
}

/** The indent one level of a hierarchical facet is drawn with. */
const NEST_STEP = spacing[5];

function CheckboxRow(props: {
  readonly group: FacetGroup;
  readonly node: FacetOptionNode;
  readonly onToggle: (slug: string, value: string) => void;
}): ReactElement {
  const { group, node } = props;
  return (
    <Flex
      justify="space-between"
      align="center"
      gap={spacing[2]}
      style={
        node.depth > 0
          ? { paddingInlineStart: node.depth * NEST_STEP }
          : undefined
      }
      data-depth={node.depth}
    >
      <Checkbox
        checked={node.option.selected}
        data-testid={`facet-option-${group.slug}-${node.option.value}`}
        data-analytics="none"
        data-analytics-reason="a filter is a read, not a flow step"
        onChange={() => {
          props.onToggle(group.slug, node.option.value);
        }}
      >
        {node.option.label}
      </Checkbox>
      <OptionCount group={group} option={node.option} />
    </Flex>
  );
}

/**
 * One pill of a single-choice group.
 *
 * A real `<button aria-pressed>` rather than antd's `Segmented`: the count has
 * to sit inside the pill (a filter without its remaining count is the
 * drill-down facet turned naive), and `Segmented` takes labels, not rows.
 * `aria-pressed` is what makes a styled button a TOGGLE to a screen reader
 * instead of a link-shaped thing that mysteriously changes the page.
 */
function OptionPill(props: {
  readonly group: FacetGroup;
  readonly option: FacetOption;
  readonly onToggle: (slug: string, value: string) => void;
}): ReactElement {
  const { group, option } = props;
  const style: CSSProperties = { borderRadius: radii.full };
  return (
    <Button
      size="small"
      shape="round"
      type={option.selected ? "primary" : "default"}
      aria-pressed={option.selected}
      style={style}
      data-testid={`facet-option-${group.slug}-${option.value}`}
      data-analytics="none"
      data-analytics-reason="a filter is a read, not a flow step"
      onClick={() => {
        props.onToggle(group.slug, option.value);
      }}
    >
      {option.count === null ? option.label : `${option.label} ${option.count}`}
    </Button>
  );
}

/**
 * The disclosure header, as a NATIVE button with the chrome stripped.
 *
 * Native rather than antd's `Button`, because this is a heading that happens
 * to toggle, not an action: it must inherit the heading's type and colour and
 * sit flush with the group's left edge, and undoing a themed button's
 * padding, border, background and hover for every surface it lands on is more
 * style than the button brings. `aria-expanded` on a real `<button>` is the
 * whole disclosure pattern; the chevron only draws what it already says.
 */
const DISCLOSURE_HEADER: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  width: "100%",
  padding: 0,
  border: "none",
  background: "none",
  color: "inherit",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
};

/** The disclosure's state, drawn. Points down over a closed group ("there is
 * more below") and flips once it is open. */
function ChevronGlyph(props: { readonly open: boolean }): ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-hidden="true"
      focusable="false"
      style={{
        marginInlineStart: "auto",
        flex: "0 0 auto",
        ...(props.open ? { transform: "rotate(180deg)" } : {}),
      }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/**
 * The list a dictionary scrolls in. A vocabulary level is 418 makes: without
 * a ceiling the group alone is longer than the rail, and the box that filters
 * it scrolls off the top of the panel while you type into it.
 */
const DICTIONARY_LIST: CSSProperties = {
  maxBlockSize: 320,
  overflowY: "auto",
  // The scroll must not clip a focus ring against the panel's edge.
  paddingInlineEnd: spacing[1],
};

/**
 * A dictionary group: what is CHOSEN, a box, and the busiest values.
 *
 * ── Why the chosen values are their own block ─────────────────────────────
 *
 * They are the only rows that are not free to leave. A person who filtered by
 * `Toyota` and then typed `bmw` must still be able to see — and undo — the
 * filter that is narrowing what they are reading; a checkbox that scrolls out
 * of the fold takes its own off-switch with it. So the chosen rows sit above
 * the box, out of the filtered list entirely, and the list below never
 * repeats them.
 *
 * ── The box filters LOCALLY, and matches across alphabets ─────────────────
 *
 * The buckets are already on the client — they arrived with the answer — so
 * the box is a filter over an array and not a request per keystroke.
 * `translitPrefixMatch` is what makes it usable in a catalogue whose values
 * are Latin and whose buyers type Cyrillic: a Cyrillic "timberlend" finds
 * `Timberland`.
 * It is presentation, exactly like the panel's own search: nothing here
 * touches the URL, because what a person typed to FIND a filter is not part
 * of the search they would share.
 */
function DictionaryBody(props: {
  readonly group: FacetGroup;
  readonly onToggle: (slug: string, value: string) => void;
  /** How many values before the box has to be used. */
  readonly visible: number;
}): ReactElement {
  const t = useT();
  const { group } = props;
  const [needle, setNeedle] = useState("");
  const [expanded, setExpanded] = useState(false);

  const chosen = group.options.filter((option) => option.selected);
  const rest = [...group.options.filter((option) => !option.selected)].sort(
    (a, b) => (b.count ?? 0) - (a.count ?? 0)
  );
  const query = needle.trim();
  const matched =
    query === ""
      ? rest
      : rest.filter(
          (option) =>
            translitPrefixMatch(query, option.label) ||
            translitPrefixMatch(query, option.value)
        );
  // The fold only exists while nothing is typed: a query has already narrowed
  // the list, and hiding its tail behind "Show all" would hide the answer.
  const folded = query === "" && !expanded && matched.length > props.visible;
  const shown = folded ? matched.slice(0, props.visible) : matched;

  return (
    <Flex vertical gap={spacing[1]} data-testid={`facet-dictionary-${group.slug}`}>
      {chosen.length > 0 && (
        <Flex
          vertical
          gap={spacing[1]}
          data-testid={`facet-dictionary-chosen-${group.slug}`}
        >
          <Typography.Text type="secondary">
            {t(SEARCH_I18N_KEYS.facetsDictionaryChosen)}
          </Typography.Text>
          {chosen.map((option) => (
            <CheckboxRow
              key={option.value}
              group={group}
              node={{ option, depth: 0 }}
              onToggle={props.onToggle}
            />
          ))}
        </Flex>
      )}
      <Input
        allowClear
        size="small"
        value={needle}
        placeholder={t(SEARCH_I18N_KEYS.facetsDictionarySearch)}
        aria-label={t(SEARCH_I18N_KEYS.facetsDictionarySearch)}
        data-testid={`facet-dictionary-search-${group.slug}`}
        onChange={(event) => {
          setNeedle(event.target.value);
        }}
      />
      {shown.length === 0 ? (
        <Typography.Text
          type="secondary"
          data-testid={`facet-dictionary-empty-${group.slug}`}
        >
          {t(SEARCH_I18N_KEYS.facetsDictionaryEmpty)}
        </Typography.Text>
      ) : (
        <Flex vertical gap={spacing[1]} style={DICTIONARY_LIST}>
          {shown.map((option) => (
            <CheckboxRow
              key={option.value}
              group={group}
              node={{ option, depth: 0 }}
              onToggle={props.onToggle}
            />
          ))}
        </Flex>
      )}
      {query === "" && matched.length > props.visible && (
        <Button
          type="link"
          size="small"
          style={{ alignSelf: "flex-start", paddingInline: 0 }}
          data-testid={`facet-more-${group.slug}`}
          data-analytics="none"
          data-analytics-reason="expanding a filter group is a read, not a flow step"
          onClick={() => {
            setExpanded((was) => !was);
          }}
        >
          {expanded
            ? t(SEARCH_I18N_KEYS.facetsShowLess)
            : t(SEARCH_I18N_KEYS.facetsShowAll, { count: matched.length })}
        </Button>
      )}
    </Flex>
  );
}

/**
 * The closed face of a dictionary group on DESKTOP: a select-shaped field
 * that reads what is chosen, or "Any".
 *
 * A 418-value vocabulary rendered as a permanently-open box plus a scrolling
 * list is right in a phone sheet, where the sheet IS the disclosure and there
 * is one group on screen. In a 280px rail it is the whole rail: the reference
 * classified draws the make as a field reading "Any" that opens the
 * searchable list, and every axis under it stays reachable at a glance.
 *
 * A native `<button role="combobox">` rather than antd's `Select`, for the
 * same reason the option pills are native buttons: the list underneath is
 * this component's — it carries per-option counts, a chosen block and a fold
 * — and a `Select` that only lends its trigger is a dependency on a popup
 * layer for a border. `aria-expanded` on a real button is the disclosure
 * pattern; Escape closes, and the field keeps focus so the next Tab goes
 * where the person expects.
 */
const DICTIONARY_FIELD: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: spacing[1],
  inlineSize: "100%",
  minBlockSize: controls.height,
  paddingInline: spacing[2],
  paddingBlock: spacing[1],
  border: `1px solid ${cssVar("border")}`,
  borderRadius: cssVar("radius-md"),
  background: cssVar("surface"),
  color: "inherit",
  font: "inherit",
  textAlign: "start",
  cursor: "pointer",
};

/** The chosen values, or the word for "no constraint on this axis". Never a
 * count: "3 chosen" makes a person open the field to find out which three. */
const DICTIONARY_FIELD_TEXT: CSSProperties = {
  flex: "1 1 auto",
  minInlineSize: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

function DictionaryField(props: {
  readonly group: FacetGroup;
  readonly onToggle: (slug: string, value: string) => void;
  readonly visible: number;
}): ReactElement {
  const t = useT();
  const { group } = props;
  const [open, setOpen] = useState(false);
  const chosen = group.options.filter((option) => option.selected);
  const text =
    chosen.length > 0
      ? chosen.map((option) => option.label).join(", ")
      : t(SEARCH_I18N_KEYS.facetsDictionaryAny);
  return (
    <Flex vertical gap={spacing[1]}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={group.label}
        style={DICTIONARY_FIELD}
        data-testid={`facet-dictionary-field-${group.slug}`}
        data-chosen={chosen.length}
        data-analytics="none"
        data-analytics-reason="opening a filter group is a read, not a flow step"
        onKeyDown={(event) => {
          if (event.key === "Escape" && open) {
            event.preventDefault();
            setOpen(false);
          }
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        onClick={() => {
          setOpen((was) => !was);
        }}
      >
        <span style={DICTIONARY_FIELD_TEXT}>{text}</span>
        <ChevronGlyph open={open} />
      </button>
      {open && (
        <DictionaryBody
          group={group}
          onToggle={props.onToggle}
          visible={props.visible}
        />
      )}
    </Flex>
  );
}

/**
 * How many values the sheet's «All values» band adds per page.
 *
 * Fifty is the vocabulary endpoint's own page size, and it is the number past
 * which a phone list stops being scrolled and starts being searched. Reaching
 * the end of the list asks for the next fifty, so a 418-make level is a
 * scroll rather than 418 mounted rows.
 */
export const FACET_SHEET_PAGE = 50;

/** One facet option as the shared picker reads it. The count rides along as
 * the row's second line: a filter without its remaining count is the
 * drill-down facet turned naive, and that rule does not stop at a sheet. */
function pickerRow(option: FacetOption, notCounted: string): PickerOption {
  return {
    value: option.value,
    label: option.label,
    description: option.count === null ? notCounted : String(option.count),
  };
}

/**
 * A dictionary group on a PHONE: a trigger row, and a nested sheet.
 *
 * ── What the buyer was looking at ─────────────────────────────────────────
 *
 * The composer's own vocabulary picker (`@stapel/attributes-react`'s
 * `ref_select` editor) is a trigger that opens a sheet with a search box, a
 * recommended band and the rest — zero checkboxes. The buyer's filter sheet
 * drew the SAME axis as a wall of eight checkboxes with a "Find a value" box
 * and a "Show all (38)" under it, and no way to say "any". Two halves of one
 * product teaching two different gestures for one dictionary is the defect;
 * this mode is the half that moved.
 *
 * ── Why the shared `SkinPickerSheet` and not a local one ──────────────────
 *
 * It is the same component the composer's picker draws: the search box pinned
 * above the list, the checkmarks, the commit button above the home indicator,
 * the swipe/Esc/back dismissal, the skeleton and the empty arm. A pair that
 * re-derives that gets a near-miss of it, which is exactly how the two halves
 * drifted the first time.
 *
 * ── The two bands ─────────────────────────────────────────────────────────
 *
 * «Recommended» is the busiest values BY COUNT — the answer's own evidence,
 * capped at {@link FACET_VISIBLE_OPTIONS} — with the chosen values in front
 * of it, because a filter a person cannot see is a filter they cannot remove.
 * «All values» is everything else, alphabetically, a page at a time. Once
 * something is typed the bands collapse into one: a "Recommended" heading
 * over rows that do not answer the box is the stale-list defect wearing a
 * hat.
 *
 * The box filters LOCALLY and across alphabets (`translitPrefixMatch`, the
 * same matcher the desktop field uses), so a Cyrillic spelling of a Latin
 * make finds it. Nothing here touches the URL: what a person typed to FIND a
 * filter is not part of the search they would share. The COMMIT does — the
 * whole draft is written to the slug's URL key at once.
 */
function DictionarySheet(props: {
  readonly group: FacetGroup;
  readonly onSetValues: (slug: string, values: readonly string[]) => void;
}): ReactElement {
  const t = useT();
  const { group } = props;
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const [page, setPage] = useState(FACET_SHEET_PAGE);

  const chosen = group.options.filter((option) => option.selected);
  const query = needle.trim();

  const { groups, total } = useMemo(() => {
    const notCounted = t(SEARCH_I18N_KEYS.facetsNotCounted);
    const hit = (option: FacetOption): boolean =>
      query === "" ||
      translitPrefixMatch(query, option.label) ||
      translitPrefixMatch(query, option.value);
    const selected = group.options.filter((option) => option.selected);
    const byCount = [...group.options].sort(
      (a, b) => (b.count ?? 0) - (a.count ?? 0)
    );

    if (query !== "") {
      // One band while the box holds something: the chosen values first (they
      // are the ones with an off-switch to reach), then the evidence order.
      const hits = [
        ...selected.filter(hit),
        ...byCount.filter((option) => !option.selected && hit(option)),
      ];
      return {
        total: hits.length,
        groups: [
          {
            key: "all",
            label: t(SEARCH_I18N_KEYS.facetsDictionaryAllValues),
            options: hits.slice(0, page).map((o) => pickerRow(o, notCounted)),
          },
        ] as readonly PickerGroup[],
      };
    }

    // The band never drops a chosen value, however cold it is: its cap grows
    // to hold them rather than pushing one of them into the alphabet.
    const cap = Math.max(FACET_VISIBLE_OPTIONS, selected.length);
    const band: FacetOption[] = [];
    const banded = new Set<string>();
    for (const option of [...selected, ...byCount]) {
      if (banded.has(option.value) || band.length >= cap) continue;
      band.push(option);
      banded.add(option.value);
    }
    const rest = group.options
      .filter((option) => !banded.has(option.value))
      .sort((a, b) => a.label.localeCompare(b.label));
    return {
      total: band.length + Math.min(rest.length, page),
      groups: [
        {
          key: "band",
          label: t(SEARCH_I18N_KEYS.facetsDictionaryRecommended),
          options: band.map((o) => pickerRow(o, notCounted)),
        },
        {
          key: "all",
          label: t(SEARCH_I18N_KEYS.facetsDictionaryAllValues),
          options: rest.slice(0, page).map((o) => pickerRow(o, notCounted)),
        },
      ] as readonly PickerGroup[],
    };
  }, [group, query, page, t]);

  // How many rows exist behind the current page — what "there is more" means.
  const available = group.options.length;

  const text =
    chosen.length > 0
      ? chosen.map((option) => option.label).join(", ")
      : t(SEARCH_I18N_KEYS.facetsDictionaryAny);

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={group.label}
        style={DICTIONARY_FIELD}
        data-testid={`facet-dictionary-trigger-${group.slug}`}
        data-chosen={chosen.length}
        data-analytics="none"
        data-analytics-reason="opening a filter group is a read, not a flow step"
        onClick={() => {
          setOpen(true);
        }}
      >
        <span style={DICTIONARY_FIELD_TEXT}>{text}</span>
        {chosen.length > 0 && (
          <Typography.Text
            type="secondary"
            data-testid={`facet-dictionary-trigger-count-${group.slug}`}
          >
            {chosen.length}
          </Typography.Text>
        )}
        <ChevronGlyph open={open} />
      </button>
      <SkinPickerSheet
        mode="multi"
        open={open}
        onClose={() => {
          setOpen(false);
          setNeedle("");
          setPage(FACET_SHEET_PAGE);
        }}
        title={group.label}
        testId={`facet-dictionary-sheet-${group.slug}`}
        doneLabel={t(SEARCH_I18N_KEYS.facetsDictionaryDone)}
        searchPlaceholder={t(SEARCH_I18N_KEYS.facetsDictionarySearch)}
        emptyLabel={t(SEARCH_I18N_KEYS.facetsDictionaryEmpty)}
        // The caller owns the filtering — the sheet's own local filter matches
        // on the label only, and this axis is searched across alphabets.
        searchValue={needle}
        onSearchChange={(next) => {
          setNeedle(next);
          setPage(FACET_SHEET_PAGE);
        }}
        groups={groups}
        // Everything handed over is drawn: the paging above is this
        // component's, so the sheet's own row cap must not fold it again.
        maxRows={Math.max(1, total)}
        onEndReached={() => {
          setPage((current) =>
            current >= available ? current : current + FACET_SHEET_PAGE
          );
        }}
        values={group.selected}
        onChange={(values) => {
          props.onSetValues(group.slug, values);
        }}
      />
    </>
  );
}

/**
 * The three faces of one dictionary, chosen by mode.
 *
 * `"sheet"` without a bulk setter falls back to the FIELD rather than to the
 * inline wall: a trigger that opens a list is the shape both surfaces are
 * moving to, and the wall is the thing the pass named.
 */
function DictionaryControl(props: {
  readonly group: FacetGroup;
  readonly mode: "field" | "inline" | "sheet" | undefined;
  readonly onToggle: (slug: string, value: string) => void;
  readonly onSetValues?: (slug: string, values: readonly string[]) => void;
  readonly visible: number;
}): ReactElement {
  const { onSetValues } = props;
  if (props.mode === "sheet" && onSetValues !== undefined) {
    return <DictionarySheet group={props.group} onSetValues={onSetValues} />;
  }
  if (props.mode === "field" || props.mode === "sheet") {
    return (
      <DictionaryField
        group={props.group}
        onToggle={props.onToggle}
        visible={props.visible}
      />
    );
  }
  return (
    <DictionaryBody
      group={props.group}
      onToggle={props.onToggle}
      visible={props.visible}
    />
  );
}

export interface FacetGroupControlProps {
  readonly group: FacetGroup;
  readonly onToggle: (slug: string, value: string) => void;
  /** Draw the group's own name above its options. `false` for a surface that
   * has already said it — a per-group sheet whose title IS the group. */
  readonly heading?: boolean;
  /** How many options before "Show all". Default {@link FACET_VISIBLE_OPTIONS};
   * `null` shows every option (a sheet devoted to one group has the room). */
  readonly visibleOptions?: number | null;
  /**
   * Make the group a disclosure: the heading becomes a real button and the
   * options can leave the DOM entirely. Default `false` — today's always-open
   * group, so no existing host changes. Meaningless with `heading: false`:
   * a disclosure with no header is a group nothing can reopen.
   */
  readonly collapsible?: boolean;
  /** Whether a `collapsible` group STARTS open. Default `true`. The initial
   * value only — the person owns the state after the first click. */
  readonly defaultOpen?: boolean;
  /**
   * How a `"dictionary"` group is drawn. Meaningless for the other three
   * shapes.
   *
   *  - `"field"` — the desktop shape: a select-style field reading its chosen
   *    values or "Any", which opens the searchable list under it;
   *  - `"sheet"` — the PHONE shape: a trigger row reading the same sentence,
   *    opening a nested picker sheet with a search box, a recommended band
   *    and the rest. The same control the composer's vocabulary picker is, so
   *    one dictionary is one gesture on both halves of the product. Needs
   *    {@link FacetGroupControlProps.onSetValues} — the sheet commits a whole
   *    draft at once, and a per-value toggle cannot apply one; without it the
   *    group falls back to `"field"`;
   *  - `"inline"` (the default) keeps the list open — a group that is already
   *    the only thing on its surface, such as a per-chip sheet.
   */
  readonly dictionaryMode?: "field" | "inline" | "sheet";
  /**
   * Write a slug's chosen values in ONE go — `useFacetPanel`'s `setValues`.
   *
   * `onToggle` reads the current state to flip one value, so N toggles in one
   * tick collapse into the last one; a sheet that commits a draft of several
   * ticks needs the bulk write. Optional so no existing host changes, and
   * only `dictionaryMode: "sheet"` reads it.
   */
  readonly onSetValues?: (slug: string, values: readonly string[]) => void;
}

/**
 * Is this group a HEADING WITH NOTHING UNDER IT?
 *
 * A bucket list with no buckets draws a caption, a chevron, and an empty box
 * — a control that cannot narrow anything, taking a row of a 280px rail and a
 * stop in a screen reader's tour to say so. On a live laptops leaf that was
 * six of six groups (D249), and `facetGroupIsDrawable` now keeps most of them
 * off the rail; this is the last mile, for the group that reaches a surface
 * anyway — a host's own list, a fixture, a slug the URL constrains whose
 * options the answer never enumerated.
 *
 * A DICTIONARY group is the exemption and the only one. Its control is a
 * FIELD over a vocabulary the answer never enumerated, so it works with no
 * buckets at all — that is the whole reason the shape exists, and a make
 * picker on a leaf holding three cars must not vanish for having three.
 */
export function facetGroupIsEmptyHeading(group: FacetGroup): boolean {
  return group.options.length === 0 && facetGroupShape(group) !== "dictionary";
}

export function FacetGroupControl(
  props: FacetGroupControlProps
): ReactElement | null {
  const t = useT();
  const { group } = props;
  const [expanded, setExpanded] = useState(false);
  const [openState, setOpenState] = useState(props.defaultOpen !== false);
  const shape = facetGroupShape(group);
  const nodes = facetOptionNodes(group);

  const disclosure = props.collapsible === true && props.heading !== false;
  const open = !disclosure || openState;

  // Nothing to narrow by: no heading either. See `facetGroupIsEmptyHeading`.
  // AFTER the hooks, never before one — the group can gain buckets on the next
  // answer, and a component that stopped calling `useState` on the way there
  // would be a different component to React.
  if (facetGroupIsEmptyHeading(group)) return null;

  const limit =
    props.visibleOptions === null
      ? null
      : (props.visibleOptions ?? FACET_VISIBLE_OPTIONS);
  // The demoted tail `facetOptionNodes` sorted to the end: uncounted,
  // unchosen options in a group that has counted evidence. They are ALWAYS
  // behind the fold — the "one row over the limit" exemption below is about
  // not hiding one counted row, and these rows say "not counted".
  const demoted = group.options.some((option) => option.count !== null)
    ? nodes.filter(uncountedUnchosen).length
    : 0;
  // A group one row over the limit is not truncated: hiding a single option
  // behind "Show all (9)" costs a tap to reveal exactly one thing.
  const folded =
    limit !== null && (nodes.length > limit + 1 || demoted > 0);
  const shown =
    folded && !expanded
      ? nodes.slice(0, Math.min(limit ?? nodes.length, nodes.length - demoted))
      : nodes;

  return (
    <Flex
      vertical
      gap={shape === "segmented" ? spacing[2] : spacing[1]}
      data-testid={`facet-group-${group.slug}`}
      data-counted={group.counted ? "true" : "false"}
      data-shape={shape}
      // Who named this heading — `none` means the raw slug is on screen
      // because the answer sent no label and the schema defines none. It is
      // drawn (a heading a person cannot read still beats none) and it is
      // MARKED, so a storefront's own test can refuse to ship it.
      data-label-source={group.labelSource}
    >
      {props.heading !== false &&
        (disclosure ? (
          <button
            type="button"
            style={DISCLOSURE_HEADER}
            aria-expanded={open}
            data-testid={`facet-toggle-${group.slug}`}
            data-analytics="none"
            data-analytics-reason="opening a filter group is a read, not a flow step"
            onClick={() => {
              setOpenState((was) => !was);
            }}
          >
            <Typography.Text strong>{group.label}</Typography.Text>
            {/* The one fact a closed group owes its header: how many of its
                values are CHOSEN. Not the option count — that is what the
                fold's own "Show all (N)" answers once the group is open. */}
            {group.selected.length > 0 && (
              <Typography.Text
                type="secondary"
                data-testid={`facet-toggle-count-${group.slug}`}
              >
                {group.selected.length}
              </Typography.Text>
            )}
            <ChevronGlyph open={open} />
          </button>
        ) : (
          <Typography.Text strong>{group.label}</Typography.Text>
        ))}

      {/* Closed means NOT RENDERED, not hidden: a hundred `display:none`
          checkboxes are still a hundred stops for a screen reader, and the
          measured rail held 118 of them. */}
      {open && shape === "dictionary" && (
        <DictionaryControl
          group={group}
          mode={props.dictionaryMode}
          onToggle={props.onToggle}
          {...(props.onSetValues !== undefined
            ? { onSetValues: props.onSetValues }
            : {})}
          visible={limit ?? FACET_VISIBLE_OPTIONS}
        />
      )}

      {open && shape !== "dictionary" && (
        <>
          {shape === "segmented" ? (
            <Flex wrap gap={spacing[2]}>
              {shown.map((node) => (
                <OptionPill
                  key={node.option.value}
                  group={group}
                  option={node.option}
                  onToggle={props.onToggle}
                />
              ))}
            </Flex>
          ) : (
            shown.map((node) => (
              <CheckboxRow
                key={node.option.value}
                group={group}
                node={node}
                onToggle={props.onToggle}
              />
            ))
          )}

          {folded && (
            <Button
              type="link"
              size="small"
              style={{ alignSelf: "flex-start", paddingInline: 0 }}
              data-testid={`facet-more-${group.slug}`}
              data-analytics="none"
              data-analytics-reason="expanding a filter group is a read, not a flow step"
              onClick={() => {
                setExpanded((was) => !was);
              }}
            >
              {expanded
                ? t(SEARCH_I18N_KEYS.facetsShowLess)
                : t(SEARCH_I18N_KEYS.facetsShowAll, { count: nodes.length })}
            </Button>
          )}
        </>
      )}
    </Flex>
  );
}
