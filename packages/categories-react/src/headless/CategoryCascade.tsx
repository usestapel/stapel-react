/**
 * The cascading child selector, headless — ONE primitive, two surfaces.
 *
 * The owner's catalogue model gives levels 1-2 of the tree to tiles and every
 * level below them to "a characteristic, chosen through cascading child
 * selectors", on the RESULT LIST and in the COMPOSER alike. "Alike" is the
 * requirement, not a convenience: a person who narrows `Cars > New` while
 * browsing and then posts a listing must make the same gesture in the same
 * control, or the two halves of the site disagree about what a category is.
 *
 * So the ladder, the cursor, the commit rule and the load state live here, and
 * the two skins over it are presentation only. `catalog/cascade.ts` explains
 * the ladder itself and why it is derived rather than accumulated.
 *
 * ── The cursor, and the one piece of state this hook actually owns ─────────
 *
 * The ladder is a function of `value` — except while the person is halfway
 * down it. In `commit: "leaf"` mode (the composer) a non-leaf choice is
 * deliberately NOT reported to the host: filing a listing under `Cars` instead
 * of `Cars > New` inherits the wrong feature set and the form then asks the
 * wrong questions. But the control still has to show that level as answered
 * and offer the next one. That halfway position is the cursor, and it is the
 * only state here.
 *
 * It is reconciled with `value` WITHOUT an effect: the hook remembers which
 * value the cursor was derived from, and an incoming value that differs (the
 * browser's Back button, a chip cleared elsewhere, a host resetting the form)
 * wins. An effect would have rendered one frame of the old ladder against the
 * new value first — briefly showing a category the URL no longer names.
 *
 * ── What it costs ─────────────────────────────────────────────────────────
 *
 * One `useCategoryCatalog` — which is the catalogue every other surface on the
 * page already mounts, so in practice nothing. No request per level, no
 * request per keystroke, and the whole ladder works offline once the catalogue
 * has synced. The alternative — `GET {id}/children/` per level — would put a
 * spinner between every rung of a control whose entire value is that it feels
 * like one.
 *
 * ── Counts are a SEAM, and deliberately empty by default ──────────────────
 *
 * A child selector wants "New (1 240)" beside each option, and this hook will
 * render it the moment somebody can supply it. It does not supply it itself,
 * because nothing can: `stapel-search` counts no category buckets (there is no
 * category facet and the index has no read path for one), `/suggest`'s counts
 * are driven by typed TEXT rather than by a subtree, and `GET {id}/children/`
 * answers rows with no counts at all. The only client-side way to fill this
 * column is one search request per option, which is 130 requests at the top of
 * a live catalogue.
 *
 * A number nobody can check is worse than no number, so the column is a host
 * prop and it is unfilled until a server can answer it. See MODULE.md for the
 * exact shape asked for upstream.
 */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  buildCategoryCascade,
  cascadeReachedLeaf,
  cascadeSelection,
  cascadeTrail,
} from "../catalog/cascade.js";
import type { CategoryCascadeLevel } from "../catalog/cascade.js";
import { categoryLabel } from "../catalog/labels.js";
import type { CategoryLabel } from "../catalog/labels.js";
import type { CategoryNode } from "../catalog/tree.js";
import { useCategoryCatalog } from "../model/queries.js";
import type { UseCategoryCatalogOptions } from "../model/queries.js";

/** One option of one level, with everything a skin needs to draw a row. */
export interface CategoryCascadeOption {
  readonly node: CategoryNode;
  readonly label: CategoryLabel;
  /** Nothing lives under it — choosing it ends the ladder. */
  readonly isLeaf: boolean;
  /**
   * Live results under this option, or `null` when nobody counted.
   *
   * `null` and `0` are different sentences and both reach the screen as
   * themselves: "we did not count this" is not "there are none". See this
   * file's header for why the default is `null` everywhere.
   */
  readonly count: number | null;
}

/** One rung, resolved for a skin. */
export interface CategoryCascadeStep {
  /** 0 for the children of the cascade's root. */
  readonly depth: number;
  /** Whose children these are — `null` at the top of a rootless cascade. */
  readonly parent: CategoryNode | null;
  /** The parent's name, for a skin that labels each select. `null` at the
   * top of a rootless cascade, where the label belongs to the host's form. */
  readonly parentLabel: CategoryLabel | null;
  readonly options: readonly CategoryCascadeOption[];
  readonly chosen: CategoryNode | null;
  readonly chosenLabel: CategoryLabel | null;
}

export interface CategoryCascadeBag {
  /**
   * The ladder. `empty` is a real answer and means the cascade's root has no
   * children — the tiles arrived at a leaf and there is nothing to narrow.
   */
  readonly state: LoadState<readonly CategoryCascadeStep[]>;
  /** The deepest answered node, or `null`. */
  readonly selected: CategoryNode | null;
  /** Root -> selected, for the poppable trail. Excludes the cascade's own
   * root, which is where the person already was. */
  readonly trail: readonly CategoryNode[];
  /** The ladder finished on a category nothing lives under. */
  readonly atLeaf: boolean;
  /** Why the cascade will not hand a value back yet, or `null`. */
  readonly blockedReason: CategoryCascadeBlockedReason | null;
  /** Answer one level. `null` un-answers it, dropping every level below. */
  choose(depth: number, node: CategoryNode | null): void;
  /** Un-answer everything from this depth down — what popping a trail chip
   * does. `clearFrom(0)` empties the cascade. */
  clearFrom(depth: number): void;
  refetch(): void;
}

/**
 * Why the cascade has no value for its host.
 *
 * `not_a_leaf` can only occur in `commit: "any"` mode; under `commit: "leaf"`
 * a non-leaf is never reported in the first place, so the reason there is
 * always that the ladder is unfinished.
 */
export type CategoryCascadeBlockedReason =
  | "nothing_selected"
  | "not_a_leaf";

/**
 * What a cascade reports to its host.
 *
 * `"any"` — every choice, leaf or not. The FILTER's rule: "show me everything
 * under Cars" is the commonest narrowing there is, and the search index
 * matches a category path as a prefix precisely so a parent finds its
 * descendants.
 *
 * `"leaf"` — only a leaf, and `null` for every step on the way. The
 * COMPOSER's rule: a listing lives in exactly one category, and a non-leaf
 * inherits the wrong feature set. The intermediate steps still show as
 * answered — they are the cursor, not a value.
 */
export type CategoryCascadeCommit = "any" | "leaf";

export interface UseCategoryCascadeOptions extends UseCategoryCatalogOptions {
  /**
   * Where the ladder starts. Absent/`null` starts at the catalogue's roots.
   *
   * On a category landing, pass the category the TILES arrived at: the two
   * mechanisms then meet at exactly one boundary instead of both offering the
   * same level.
   */
  readonly rootId?: number | null;
  /** The host's current answer. */
  readonly value?: number | null;
  readonly onChange?: (id: number | null, node: CategoryNode | null) => void;
  /** Default `"any"`. See {@link CategoryCascadeCommit}. */
  readonly commit?: CategoryCascadeCommit;
  /**
   * Live results per category id. Unfilled by default and unfillable by this
   * package — see this file's header.
   */
  readonly counts?: ReadonlyMap<number, number>;
}

/**
 * The ladder, its cursor and its commit rule.
 *
 * Renderless callers use {@link CategoryCascade}; the antd control over this
 * is `<CategoryCascadeField>` in the `/default` entry.
 */
export function useCategoryCascade(
  options: UseCategoryCascadeOptions = {}
): CategoryCascadeBag {
  const {
    rootId,
    value,
    onChange,
    commit,
    counts,
    ...catalogOptions
  } = options;
  const commitRule = commit ?? "any";
  // Controlled-ness is read from the PRESENCE of the prop, not from its value:
  // an uncontrolled host and a controlled host holding `null` are the same
  // `null` here, and only the first of them owns its own cursor.
  const controlled = value !== undefined;
  const incoming = value ?? null;

  const query = useCategoryCatalog(catalogOptions);
  const catalog = loadStateFromQuery(query);
  const index = catalog.status === "ready" ? catalog.data.index : null;

  // The cursor, and the value it was derived from. One state, so the two can
  // never be reconciled in the wrong order — see this file's header for why
  // this is not an effect.
  const [cursorState, setCursorState] = useState<{
    readonly cursor: number | null;
    readonly from: number | null;
  }>({ cursor: incoming, from: incoming });
  const cursorId = !controlled
    ? cursorState.cursor
    : cursorState.from === incoming
      ? cursorState.cursor
      : incoming;

  const levels = useMemo<readonly CategoryCascadeLevel[]>(
    () =>
      index === null
        ? []
        : buildCategoryCascade(index, {
            rootId: rootId ?? null,
            cursorId,
          }),
    [index, rootId, cursorId]
  );

  const steps = useMemo<readonly CategoryCascadeStep[]>(
    () =>
      levels.map((level) => ({
        depth: level.depth,
        parent: level.parent,
        parentLabel:
          level.parent === null ? null : categoryLabel(level.parent.category),
        options: level.options.map((node) => ({
          node,
          label: categoryLabel(node.category),
          isLeaf: node.children.length === 0,
          count: counts?.get(node.id) ?? null,
        })),
        chosen: level.chosen,
        chosenLabel:
          level.chosen === null ? null : categoryLabel(level.chosen.category),
      })),
    [levels, counts]
  );

  const selected = cascadeSelection(levels);
  const atLeaf = cascadeReachedLeaf(levels);

  /**
   * Move the cursor and report whatever the commit rule allows, in ONE state
   * write. Both halves have to land together: reporting first and moving the
   * cursor after would let a controlled host re-render against the old cursor
   * and rebuild the ladder the person just left.
   */
  const moveTo = (node: CategoryNode | null): void => {
    const committed =
      node === null
        ? null
        : commitRule === "any" || node.children.length === 0
          ? node
          : null;
    setCursorState({ cursor: node?.id ?? null, from: committed?.id ?? null });
    onChange?.(committed?.id ?? null, committed);
  };

  return {
    state: mapLoad(catalog, () => steps),
    selected,
    trail: cascadeTrail(levels),
    atLeaf,
    blockedReason:
      selected === null
        ? "nothing_selected"
        : commitRule === "leaf" && !atLeaf
          ? "not_a_leaf"
          : null,
    choose: (depth, node) => {
      if (node !== null) {
        moveTo(node);
        return;
      }
      // Un-answering a level goes back to whatever that level hangs off —
      // its parent, or nothing at the top.
      moveTo(levels[depth]?.parent ?? null);
    },
    clearFrom: (depth) => {
      moveTo(levels[depth]?.parent ?? null);
    },
    refetch: () => {
      void query.refetch();
    },
  };
}

export interface CategoryCascadeProps extends UseCategoryCascadeOptions {
  children: (bag: CategoryCascadeBag) => ReactNode;
}

/** {@link useCategoryCascade} as a renderless component. */
export function CategoryCascade(props: CategoryCascadeProps): ReactNode {
  const { children, ...options } = props;
  const bag = useCategoryCascade(options);
  return children(bag);
}
