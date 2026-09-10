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
 *
 * ── The two variants are two CONTROLS, and each one is real ───────────────
 *
 * `chips` is this file's own row of `role="radio"` buttons — pills that wrap,
 * the phone's shape.
 *
 * `segmented` is antd's `Segmented`, and it used to be this same row with a
 * shared border drawn round it. That was a claim nothing backed: the walker
 * read `data-variant="segmented"` with `role="radiogroup"` and found
 * `.ant-segmented` zero times, `input[type=radio]` zero times, and plain
 * `ant-btn` inside — on both axes of two categories (D304). A row that names
 * a control it does not render sends the next reader looking for a bug in the
 * wrong place, and hand-rolling the joined look was ~30 lines re-deciding
 * geometry the design system already owns.
 *
 * So the segmented arm IS the design system's control now, and its radiogroup
 * is the browser's rather than ours: real `input[type=radio]` sharing one
 * `name`, so the selected state is the radio's own `checked` (`aria-checked`
 * is how a BUTTON fakes what a radio has), the arrow keys are the control's,
 * and one Tab stop is the platform's doing. The per-cell test ids stay where
 * they were, plus `data-checked`, so a probe that reads a snapshot still has
 * the chosen cell without asking the accessibility tree.
 */
import { useEffect, useRef } from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  ReactElement,
  ReactNode,
} from "react";
import { Button, Segmented, Typography } from "antd";
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
  /**
   * How many listings this section holds, drawn by the chip itself in the
   * muted style every other counted control on the page uses.
   *
   * A host that has the number had to concatenate it into `name` — the only
   * string this row accepted — which is how a count ends up in the same
   * weight and colour as the word beside it, and how one storefront was
   * joining the name and the total by hand. Passing the number instead lets
   * the chip render it the way the facet rows render theirs, and keeps the
   * label a label (a `Segmented` cell can lay the two out, and the name is not
   * a string with an integer welded onto its end).
   *
   * Omit it and nothing is drawn — an absent count is not a zero, and a
   * section whose total nobody asked for must not be captioned "0".
   *
   * Ignored on a POINTER — see {@link linked}.
   */
  readonly count?: number;
  /**
   * This entry is a POINTER to another category, not a section of THIS
   * template (`CategoryChild.linked`, stapel-categories 0.22.0).
   *
   * A partition is one template split by a value its children's names express
   * — new / used / for rent. A pointer is a different branch of the catalogue
   * that an operator drew among these children so a person can reach it from
   * here. It is not one of the halves, it does not narrow this feed, and it
   * has NO count of its own: the number beside it is the number of listings in
   * somebody else's category, which is why the storefront's
   * `/c/transport-avtomobili` read `All | New 0 | Used 3 | Car rental 0`
   * — two of those zeroes were a partition's real emptiness and one was a
   * question nobody had asked.
   *
   * So a linked entry never becomes a radio, never carries a count, and never
   * matches {@link PartitionChipsProps.value} — a stale address naming one
   * leaves the row on its parent chip rather than lighting a pointer up as the
   * chosen section. It is drawn AFTER the partitions as a link, or not at all:
   * see {@link PartitionChipsProps.linkedChildren}.
   */
  readonly linked?: boolean;
  /**
   * WHERE a pointer leads — the target's own address, as the host builds it
   * (`/c/<slug>`). Read only on a {@link linked} entry.
   *
   * The pointer's `path` is an id path into the CATALOGUE, and following it
   * as a `category` filter is exactly the confusion this shape exists to end:
   * a pointer is a destination, so the chip is a real `<a href>` that
   * navigates, with no `f=` and no state change on this page. A linked entry
   * with no `href` is not drawn — a link with no address is not a link.
   */
  readonly href?: string;
}

/** What the row does with a POINTER among its children — see
 * {@link PartitionChipsProps.linkedChildren}. */
export type PartitionLinkedChildren = "chip" | "none";

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
   * desktop RAIL's — antd's `Segmented`, one joined control under the axis's
   * own label, which is how the reference classified draws the same choice (a
   * car-type row: all, used, new) and what a 280px column has room for.
   *
   * The SEMANTICS do not vary with it: both are a `radiogroup` naming itself,
   * with one Tab stop and the arrow keys moving the choice. What varies is
   * who provides them — this file's `role="radio"` buttons in `chips`, the
   * browser's own `input[type=radio]` in `segmented`.
   */
  readonly variant?: "chips" | "segmented";
  /**
   * What the row does with a POINTER among its children. Default `"chip"`.
   *
   *  - `"chip"` — drawn AFTER the partitions as an outlined link chip: the
   *    target's name and a trailing arrow, no count, a real `<a href>` that
   *    navigates to the target rather than filtering this page. Outlined and
   *    separate on purpose — it is not one of the choices, and a control that
   *    looks like the others while doing something else is worse than one
   *    that looks different;
   *  - `"none"` — not drawn here at all, for a page whose TILE STAGE already
   *    shows the same pointer as a tile. One destination offered twice, a row
   *    apart, is a person wondering what the difference is.
   *
   * Either way a pointer is out of the partition semantics: no radio, no
   * count, never the chosen section. This prop only decides whether the link
   * is offered in this row.
   */
  readonly linkedChildren?: PartitionLinkedChildren;
}

/**
 * The `value` of the parent cell inside the segmented control. `null` is this
 * component's word for "the parent, unnarrowed" and a radio's value is a
 * string, so the sentinel exists only between here and antd — it never
 * reaches {@link PartitionChipsProps.onChange}, which still reports `null`.
 */
const ALL = "__all__";

const CHIP: CSSProperties = { borderRadius: radii.full };

const ROW: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: spacing[2],
};

/**
 * The pointer chip: the partition pill's geometry, OUTLINED — a hairline and
 * no fill, so it reads as a way out of this page rather than as one of the
 * choices on it.
 */
const POINTER_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: spacing[1],
  borderRadius: radii.full,
  border: `1px solid ${cssVar("border")}`,
  paddingBlock: spacing[1],
  paddingInline: spacing[3],
  color: cssVar("text"),
  lineHeight: 1.4,
};

/** The keys that move the choice, in both variants. */
const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"]);

/**
 * D454 — WHEN AN ARROW KEY LAST MOVED A PARTITION, AS A TIMESTAMP.
 *
 * Module-scoped, and that is the load-bearing part rather than an oversight.
 *
 * Measured on the stand: the first `ArrowRight` moved "all" -> "new" AND
 * navigated to `/c/novye` — which is what the control is FOR, the choice is a
 * `category` in the URL — and after that navigation `document.activeElement`
 * was `BODY`, so every further arrow press did nothing. The row is not the
 * same row afterwards: the storefront resolves the new category's children,
 * the rail unmounts while that is in flight and mounts again with fresh
 * `items`, and antd's `Segmented` takes a new `useId()` name and renders new
 * `input`s. A ref, a piece of state, a `useEffect` cleanup — everything that
 * lives INSIDE the component instance dies with it, so the one fact that has
 * to cross the remount cannot be kept there.
 *
 * The window is short and the flag is spent on use ({@link takeArrowMove}), so
 * this can restore focus exactly once per keypress and never steals it from a
 * page nobody was driving from the keyboard.
 */
let lastArrowMove = 0;

/** How long after an arrow press the row will still take its focus back. Long
 * enough for a navigation and a refetch, short enough that a page left alone
 * and returned to later is never grabbed. */
const FOCUS_RESTORE_WINDOW_MS = 2000;

function noteArrowMove(key: string): void {
  if (ARROW_KEYS.has(key)) lastArrowMove = Date.now();
}

/** True once, for the row that acts on it. */
function takeArrowMove(): boolean {
  const fresh = lastArrowMove !== 0 && Date.now() - lastArrowMove < FOCUS_RESTORE_WINDOW_MS;
  if (fresh) lastArrowMove = 0;
  return fresh;
}

/**
 * One cell's label: the section's name, and its count beside it in the muted
 * weight — the same `Typography.Text type="secondary"` a facet option's count
 * is drawn in, so the two counted controls on one page read as one system.
 */
function ChildLabel(props: { readonly child: PartitionChild }): ReactElement {
  const { child } = props;
  if (child.count === undefined) return <>{child.name}</>;
  return (
    <>
      {child.name}{" "}
      <Typography.Text
        type="secondary"
        data-testid={`partition-count-${child.path}`}
      >
        {child.count}
      </Typography.Text>
    </>
  );
}

/**
 * The pointer chip's trailing mark — an arrow leaving to the right, the one
 * glyph that says "this goes somewhere else" rather than "this narrows what
 * is here".
 *
 * Drawn inline in `currentColor`, like every other glyph in this skin
 * (`ChevronGlyph`, `PinGlyph`, `SlidersGlyph`): this package ships no icon set
 * and one arrow is not the reason to take one. `aria-hidden`, because the
 * chip's accessible name is the target's own — a screen reader announcing an
 * arrow after it would be reading the decoration.
 */
function PointerGlyph(): ReactElement {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      style={{ flex: "0 0 auto" }}
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The pointers, after the partitions and outside the radiogroup.
 *
 * OUTSIDE is not a layout preference: a `role="radiogroup"` whose children
 * include a link announces a choice that has an option you cannot choose. The
 * pointers are their own row, and each one is an ordinary anchor — a
 * middle-click, a ctrl/cmd-click and "open in a new tab" all work, which is
 * the whole difference between a destination and a filter.
 */
function PointerChips(props: {
  readonly items: readonly PartitionChild[];
}): ReactElement {
  return (
    <div style={ROW} data-testid="partition-links">
      {props.items.map((item) => (
        <a
          key={item.path}
          href={item.href}
          style={POINTER_CHIP}
          data-testid={`partition-link-${item.path}`}
        >
          {item.name}
          <PointerGlyph />
        </a>
      ))}
    </div>
  );
}

/** The row's cells, as `[value, label]` — the parent first, then the
 * children in catalogue order. */
function cells(
  items: readonly PartitionChild[],
  allLabel: ReactNode
): readonly (readonly [string | null, ReactNode])[] {
  return [
    [null, allLabel] as const,
    ...items.map(
      (item) => [item.path, <ChildLabel key={item.path} child={item} />] as const
    ),
  ];
}

export function PartitionChips(props: PartitionChipsProps): ReactElement {
  const t = useT();
  const row = useRef<HTMLDivElement>(null);
  /* THE TWO KINDS OF CHILD, SPLIT ONCE. Everything below the split — the
     cells, the roving stop, the value lookup, the arrow keys — sees only the
     SECTIONS, which is what keeps a pointer out of the partition's semantics
     rather than out of one rendering of them. */
  const sections = props.items.filter((item) => item.linked !== true);
  const pointers =
    props.linkedChildren === "none"
      ? []
      : props.items.filter(
          (item) => item.linked === true && item.href !== undefined
        );
  const options = cells(
    sections,
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
    noteArrowMove(event.key);
    props.onChange(cell[0]);
    const buttons = row.current?.querySelectorAll<HTMLElement>('[role="radio"]');
    buttons?.[next]?.focus();
  };

  // A `value` naming no cell (a link into a child that has since moved) must
  // still leave the row reachable by Tab, so the roving stop falls back to the
  // parent chip rather than vanishing.
  const active = options.findIndex(([value]) => value === props.value);
  const stop = active >= 0 ? active : 0;

  /**
   * D454 — after an arrow press, the CHOSEN cell holds the focus.
   *
   * Two different things are repaired by one effect, and the second is the one
   * the stand measured:
   *
   *  - within one mount, `Segmented`'s own handler moves the VALUE and leaves
   *    the focus on the cell it started from, so the focused radio and the
   *    checked radio disagree — and the control paints its focus ring on the
   *    checked one, which is not where the keyboard is;
   *  - across a REMOUNT — the choice is a `category`, so choosing navigates,
   *    and the rail comes back as new elements — the focus is on `<body>` and
   *    the row is unreachable by every further arrow press without a Tab.
   *
   * Keyed on `props.value` and on mount, gated by {@link takeArrowMove}, so a
   * page loaded, clicked, or scrolled is never grabbed: only the row whose
   * arrow key started this takes the focus, and it takes it once.
   */
  useEffect(() => {
    const root = row.current;
    if (root === null) return;
    if (!takeArrowMove()) return;
    const focused = document.activeElement;
    // Somewhere else on purpose — a dialog, a field the person tabbed into
    // while the answer was in flight — is not ours to overrule. `<body>` is
    // what a remount leaves behind, and inside the row is the intra-mount case
    // where focus and selection have to be brought back together.
    if (focused !== null && focused !== document.body && !root.contains(focused)) return;
    const cells_ = root.querySelectorAll<HTMLElement>(
      'input[type="radio"], [role="radio"]'
    );
    cells_[stop]?.focus();
  }, [props.value, stop]);

  const name = props.label ?? t(SEARCH_I18N_KEYS.partitionLabel);

  /* The pointers ride BESIDE whichever control was drawn, never inside it —
     see `PointerChips`. A fragment rather than a wrapper element: this row is
     mounted in a vertical `<Flex>` that already spaces its children, and an
     extra box here would take that gap away from the row it wraps. */
  const withPointers = (control: ReactElement): ReactElement =>
    pointers.length === 0 ? (
      control
    ) : (
      <>
        {control}
        <PointerChips items={pointers} />
      </>
    );

  if (props.variant === "segmented") {
    // antd's own control: `.ant-segmented`, one `input[type=radio]` per cell
    // under a shared `name`, the selected cell's `checked`, and the arrow keys
    // — the radiogroup this variant used to only claim to be. `role` and
    // `aria-label` reach the root because the component spreads what it is
    // given over its own defaults (which are `radiogroup` and the string
    // "segmented control").
    return withPointers(
      <Segmented
        block
        size="small"
        ref={row}
        role="radiogroup"
        aria-label={name}
        data-variant="segmented"
        data-testid="partition-chips"
        /* The keypress is noted where it HAPPENS, before antd's own handler
           turns it into a value change and the host turns that into a
           navigation. Capture, because the cell's `input` is where the event
           lands and the row is only its ancestor — and note only, so the
           control's own arrow handling is untouched. */
        onKeyDownCapture={(event) => {
          noteArrowMove(event.key);
        }}
        value={props.value ?? ALL}
        options={options.map(([value, label]) => ({
          value: value ?? ALL,
          label: (
            // The cell's test id and its chosen state, on the one node inside
            // a cell this component owns — antd names the cells itself, and a
            // label a radio is bound to is what a click has to land on.
            <span
              data-testid={`partition-chip-${value ?? "all"}`}
              data-checked={value === props.value ? "true" : "false"}
            >
              {label}
            </span>
          ),
        }))}
        onChange={(next) => {
          props.onChange(next === ALL ? null : String(next));
        }}
      />
    );
  }

  return withPointers(
    <div
      style={ROW}
      data-variant="chips"
      ref={row}
      role="radiogroup"
      aria-label={name}
      data-testid="partition-chips"
    >
      {options.map(([value, label], index) => {
        const selected = value === props.value;
        return (
          <Button
            key={value ?? ALL}
            size="small"
            shape="round"
            type={selected ? "primary" : "default"}
            role="radio"
            aria-checked={selected}
            // Roving tabindex: the row is ONE Tab stop and it lands on the
            // chosen chip, not on the first of eight.
            tabIndex={index === stop ? 0 : -1}
            style={CHIP}
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
