/**
 * `<PartitionChips>` — the children of a `chips` category, as one row of
 * single-select chips.
 *
 * A partition is a category whose children are not subcategories but one
 * template split by a value their names express: buy / sell / let / rent,
 * new / used, for boys / for girls. They keep their
 * ids, their paths and their URLs — a listing still lands on a child — and
 * only the PRESENTATION changes: the parent draws a feed, and the children
 * are a choice above it rather than a grid of tiles the visitor has to pass
 * through.
 *
 * Which categories are a partition is not decided here and not decided by
 * this pair: `children_as` is a stored, derivable field on the category, and
 * the storefront hands this component the children it resolved. What this
 * component owns is that the choice is SINGLE-select and that "all" — the
 * parent, unnarrowed — is one of the options rather than a way of clearing
 * the others.
 *
 * ── Why a radiogroup and not a row of toggles ─────────────────────────────
 *
 * Because exactly one of them is true at a time, and `aria-pressed` buttons
 * say the opposite: they announce a set of independent switches, so a screen
 * reader user hears no reason why pressing one released another. A radiogroup
 * with roving tabindex is the pattern for "one of these": Tab reaches the row
 * once and lands on the chosen chip, the arrow keys move along it, and the
 * group's own name says what is being chosen.
 */
import { useRef } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";
import { Button } from "antd";
import { useT } from "@stapel/core";
import { cssVar, radii, spacing } from "@stapel/tokens";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";

/** One child of a partitioned category. `path` is the slash-joined id path
 * the `category` parameter takes — the same string `SearchQueryState.category`
 * carries, so a host never rebuilds it from ids. */
export interface PartitionChild {
  readonly id: number | string;
  readonly path: string;
  readonly name: string;
}

export interface PartitionChipsProps {
  /** The children, in the order the catalogue declares them. */
  readonly items: readonly PartitionChild[];
  /** The chosen child's `path`, or `null` for the parent itself. CONTROLLED:
   * this row keeps no state, because the choice is a `category` in the URL. */
  readonly value: string | null;
  readonly onChange: (path: string | null) => void;
  /** The first chip's label. Defaults to `search.partition.all`. */
  readonly allLabel?: ReactNode;
  /** The row's accessible name. Defaults to `search.partition.label`. */
  readonly label?: string;
  /**
   * Which shape the row takes. `"chips"` (the default) is the phone's: a
   * wrapping row of rounded pills above the feed. `"segmented"` is the
   * desktop RAIL's — one joined control under the axis's own label, which is
   * how the reference classified draws the same choice (a car-type row:
   * all, used, new) and what a 280px column has room for.
   *
   * The SEMANTICS do not vary with it. Both are the same `radiogroup` with
   * the same roving tabindex and the same arrow keys — a segmented look is a
   * border-radius decision, and swapping in a component that draws joined
   * cells by giving up "exactly one of these is true" would trade the
   * accessible half of this control for the visible half.
   */
  readonly variant?: "chips" | "segmented";
}

const CHIP: CSSProperties = { borderRadius: radii.full };

const ROW: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing[2],
};

/**
 * The segmented row: one joined control, no gaps, the group's own outline.
 *
 * `gap: 0` plus a shared border is what makes three buttons read as one
 * control — the thing a rail needs, because a wrapping pill row in a 280px
 * column is two ragged lines. `overflow: hidden` clips the cells' own corners
 * to the group's radius so the ends are round and the joins are square.
 */
const SEGMENTED_ROW: CSSProperties = {
  display: "flex",
  gap: 0,
  inlineSize: "100%",
  border: `1px solid ${cssVar("border")}`,
  borderRadius: cssVar("radius-md"),
  overflow: "hidden",
};

/** One cell of the segmented row: an equal share of the width, square joins,
 * no border of its own — the group draws the outline. */
const SEGMENTED_CELL: CSSProperties = {
  flex: "1 1 0",
  minInlineSize: 0,
  borderRadius: 0,
  borderInline: "none",
  borderBlock: "none",
};

/** The row's cells, as `[value, label]` — the parent first, then the
 * children in catalogue order. */
function cells(
  items: readonly PartitionChild[],
  allLabel: ReactNode
): readonly (readonly [string | null, ReactNode])[] {
  return [
    [null, allLabel] as const,
    ...items.map((item) => [item.path, item.name] as const),
  ];
}

export function PartitionChips(props: PartitionChipsProps): ReactElement {
  const t = useT();
  const row = useRef<HTMLDivElement>(null);
  const options = cells(
    props.items,
    props.allLabel ?? t(SEARCH_I18N_KEYS.partitionAll)
  );

  /**
   * Arrow keys move the choice AND the focus, which is what a radiogroup
   * does: in a single-select row the focused option is the selected one, so
   * moving focus without choosing would leave the two disagreeing.
   */
  const onKeyDown =
    (index: number) =>
    (event: ReactKeyboardEvent): void => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : event.key === "Home"
            ? -index
            : event.key === "End"
              ? options.length - 1 - index
              : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (index + step + options.length) % options.length;
    const cell = options[next];
    if (cell === undefined) return;
    props.onChange(cell[0]);
    const buttons = row.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    buttons?.[next]?.focus();
  };

  // A `value` naming no cell (a link into a child that has since moved) must
  // still leave the row reachable by Tab, so the roving stop falls back to the
  // parent chip rather than vanishing.
  const active = options.findIndex(([value]) => value === props.value);
  const stop = active >= 0 ? active : 0;

  const segmented = props.variant === "segmented";
  return (
    <div
      style={segmented ? SEGMENTED_ROW : ROW}
      data-variant={segmented ? "segmented" : "chips"}
      ref={row}
      role="radiogroup"
      aria-label={props.label ?? t(SEARCH_I18N_KEYS.partitionLabel)}
      data-testid="partition-chips"
    >
      {options.map(([value, label], index) => {
        const selected = value === props.value;
        return (
          <Button
            key={value ?? "__all__"}
            size="small"
            {...(segmented ? {} : { shape: "round" as const })}
            type={selected ? "primary" : "default"}
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the row is ONE Tab stop and it lands on the
            // chosen chip, not on the first of eight.
            tabIndex={index === stop ? 0 : -1}
            style={segmented ? SEGMENTED_CELL : CHIP}
            data-testid={`partition-chip-${value ?? "all"}`}
            data-analytics="none"
            data-analytics-reason="choosing a section is a read, not a flow step"
            onKeyDown={onKeyDown(index)}
            onClick={() => {
              props.onChange(value);
            }}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}
