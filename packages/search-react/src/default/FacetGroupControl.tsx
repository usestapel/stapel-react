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

/** The group's options in render order, carrying the depth the schema gives. */
export function facetOptionNodes(group: FacetGroup): readonly FacetOptionNode[] {
  if (facetGroupShape(group) !== "nested" || group.feature === undefined) {
    return group.options.map((option) => ({ option, depth: 0 }));
  }
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
  return out;
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

export interface FacetGroupControlProps {
  readonly group: FacetGroup;
  readonly onToggle: (slug: string, value: string) => void;
  /** Draw the group's own name above its options. `false` for a surface that
   * has already said it — a per-group sheet whose title IS the group. */
  readonly heading?: boolean;
  /** How many options before "Show all". Default {@link FACET_VISIBLE_OPTIONS};
   * `null` shows every option (a sheet devoted to one group has the room). */
  readonly visibleOptions?: number | null;
}

export function FacetGroupControl(props: FacetGroupControlProps): ReactElement {
  const t = useT();
  const { group } = props;
  const [expanded, setExpanded] = useState(false);
  const shape = facetGroupShape(group);
  const nodes = facetOptionNodes(group);

  const limit =
    props.visibleOptions === null
      ? null
      : (props.visibleOptions ?? FACET_VISIBLE_OPTIONS);
  // A group one row over the limit is not truncated: hiding a single option
  // behind "Show all (9)" costs a tap to reveal exactly one thing.
  const collapsible = limit !== null && nodes.length > limit + 1;
  const shown = collapsible && !expanded ? nodes.slice(0, limit) : nodes;

  return (
    <Flex
      vertical
      gap={shape === "segmented" ? spacing[2] : spacing[1]}
      data-testid={`facet-group-${group.slug}`}
      data-counted={group.counted ? "true" : "false"}
      data-shape={shape}
    >
      {props.heading !== false && (
        <Typography.Text strong>{group.label}</Typography.Text>
      )}

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

      {collapsible && (
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
    </Flex>
  );
}
