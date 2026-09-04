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
import { useState } from "react";
import type { CSSProperties, ReactElement } from "react";
import { Button, Checkbox, Flex, Input, Typography } from "antd";
import { useT } from "@stapel/core";
import { controls, cssVar, radii, spacing } from "@stapel/tokens";
import {
  VOCABULARY_BACKED_TYPES,
  featureConfig,
  featureType,
} from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
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
 * Is this group a DICTIONARY — a vocabulary's level, too long to scroll?
 *
 * Two ways to be one, because the schema is an optional slot and the live
 * case is the one where it is empty:
 *
 *  - the def types the slug `ref_select`/`ref_hierarchical_select`, i.e. its
 *    config is a POINTER into a vocabulary and there was never an option
 *    table to draw;
 *  - there is NO def at all and the answer came back with more values than a
 *    fold. At a live classified's cars branch the storefront passed an empty
 *    feature list, so the 418 makes arrived as an unnamed, untyped group of
 *    418 checkboxes behind "Show all (418)". A box is the only control that
 *    answers that, and refusing to draw one because the schema is missing
 *    punishes the buyer for the wiring.
 *
 * Either way it takes more than {@link FACET_DICTIONARY_THRESHOLD} EVIDENCE
 * buckets — values the answer actually counted. A zero-filled option table or
 * a schema-only tail is a list a person can already read, and a box over it
 * would search for values no document carries.
 */
export function isDictionaryFacet(group: FacetGroup): boolean {
  const buckets = group.options.filter(
    (option) => option.count !== null && option.count > 0
  ).length;
  if (buckets <= FACET_DICTIONARY_THRESHOLD) return false;
  const feature = group.feature;
  if (feature === undefined) return true;
  const type = featureType(feature);
  return type !== undefined && VOCABULARY_BACKED_TYPES.includes(type);
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
 *    is a search box, whether or not they may tick two; below it,
 *    single-choice still means pills, because `isDictionaryFacet` requires
 *    more than {@link FACET_DICTIONARY_THRESHOLD} counted buckets;
 *  - and a dictionary is a dictionary before it is a checkbox list, because
 *    the checkbox list is the shape it was drawn as when nobody could pick a
 *    make.
 */
export function facetGroupShape(group: FacetGroup): FacetGroupShape {
  const feature = group.feature;
  if (feature !== undefined && featureType(feature) === "hierarchical_select") {
    return "nested";
  }
  if (isDictionaryFacet(group)) return "dictionary";
  return singleChoice(feature) ? "segmented" : "checkbox";
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
   * How a `"dictionary"` group is drawn. `"field"` is the desktop shape — a
   * select-style field reading its chosen values or "Any", which opens the
   * searchable list; `"inline"` (the default) keeps the list open, the shape
   * a phone sheet wants because the sheet is already the disclosure.
   * Meaningless for the other three shapes.
   */
  readonly dictionaryMode?: "field" | "inline";
}

export function FacetGroupControl(props: FacetGroupControlProps): ReactElement {
  const t = useT();
  const { group } = props;
  const [expanded, setExpanded] = useState(false);
  const [openState, setOpenState] = useState(props.defaultOpen !== false);
  const shape = facetGroupShape(group);
  const nodes = facetOptionNodes(group);

  const disclosure = props.collapsible === true && props.heading !== false;
  const open = !disclosure || openState;

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
      {open &&
        shape === "dictionary" &&
        (props.dictionaryMode === "field" ? (
          <DictionaryField
            group={group}
            onToggle={props.onToggle}
            visible={limit ?? FACET_VISIBLE_OPTIONS}
          />
        ) : (
          <DictionaryBody
            group={group}
            onToggle={props.onToggle}
            visible={limit ?? FACET_VISIBLE_OPTIONS}
          />
        ))}

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
