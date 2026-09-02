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
import { Button, Checkbox, Flex, Typography } from "antd";
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import { featureConfig, featureType } from "@stapel/attributes-react";
import type { FeatureDef } from "@stapel/attributes-react";
import type { FacetGroup, FacetOption } from "../state/facets.js";
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

/** The three shapes a facet group takes. */
export type FacetGroupShape = "segmented" | "nested" | "checkbox";

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
 * Which of the three shapes a group takes.
 *
 * Order matters: a hierarchical facet is nested even when it is single-choice,
 * because losing the tree costs more than losing the pills.
 */
export function facetGroupShape(group: FacetGroup): FacetGroupShape {
  const feature = group.feature;
  if (feature !== undefined && featureType(feature) === "hierarchical_select") {
    return "nested";
  }
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
      {open && (
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
