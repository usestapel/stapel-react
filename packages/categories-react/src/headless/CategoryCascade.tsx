/**
 * The cascading child selector, headless — ONE primitive, two surfaces, and
 * ONE SMALL REQUEST PER RUNG.
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
 * ── What it costs, and what it used to cost ────────────────────────────────
 *
 * The first version of this hook read the DELTA-SYNCED CATALOGUE, on the
 * reasoning that the tree is already in memory and a request per level would
 * put a spinner between every rung. On a live classified deployment that
 * reasoning was measured and it was wrong in both halves:
 *
 *   whole catalogue, `?page_size=100`    36 requests   1453 KB   20.2 s
 *   ONE rung, `GET {id}/children/`        1 request     1-4 KB   0.25-0.39 s
 *
 * The tree is only "already in memory" once somebody has waited twenty seconds
 * for it, and every surface that mounted this control paid that before drawing
 * its FIRST select. A rung costs a third of a second, and the rungs above it
 * stay on screen while it lands — so the ladder never blanks, and the control
 * is answerable a whole catalogue-sync sooner.
 *
 * ── The one rung the server cannot answer ──────────────────────────────────
 *
 * A ROOTLESS ladder — the composer's, and the filter's when nothing is chosen
 * — opens on the catalogue's top level, and `stapel-categories` has no roots
 * endpoint and no `tn_parent` filter on the list. Reading the whole table for
 * that ONE rung is what made the composer unusable on a phone: 36 requests,
 * 1.4 MB, and 19.9 seconds before the first select existed.
 *
 * So the rung is answered by `GET /categories/carousel/` — one cached
 * request — projected to the rows with no ancestors, which is what a root IS.
 * A deployment that curates no carousel gets an empty projection and falls
 * through to the catalogue sync, exactly as before.
 * {@link UseCategoryCascadeOptions.roots} remains the escape hatch for a host
 * that knows its own top level and wants neither read. MODULE.md carries the
 * upstream ask for a real roots endpoint, which is what would retire both.
 *
 * A ROOTED ladder — the one a category landing mounts, which is where the
 * owner's model says the tiles hand over — never mounts the sync at all.
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
 * ── Where the CHAIN comes from, now that there is no tree ──────────────────
 *
 * `tn_ancestors_pks` on the cursor's own row: the server's ancestry, which is
 * the only complete one available without the catalogue. So a deep link
 * (`?category=165` arriving cold) costs one 300-byte `GET {id}/` and then one
 * `children/` per rung it draws — four small requests for a four-level ladder,
 * against 1.4 MB for the tree that answers the same question.
 *
 * A row the person just CLICKED is already in hand, so it is written into the
 * per-id cache on the way past (`queryClient.setQueryData`) and the extra read never
 * happens. Clicking down a ladder therefore costs exactly one request per
 * rung, and nothing else.
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
import { useQueryClient } from "@tanstack/react-query";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { Category } from "../api/types.js";
import { browsableCategories } from "../catalog/browse.js";
import {
  buildCategoryCascade,
  cascadeChainIds,
  cascadeParentIds,
  cascadeReachedLeaf,
  cascadeSelection,
  cascadeTrail,
  categoryAncestorChain,
} from "../catalog/cascade.js";
import type {
  CategoryCascadeLevel,
  CategoryCascadeSource,
} from "../catalog/cascade.js";
import { categoryLabel } from "../catalog/labels.js";
import { childControl, hasChildren } from "../catalog/stage.js";
import type { CategoryLabel } from "../catalog/labels.js";
import { categoryChildIds } from "../catalog/tree.js";
import {
  browseChildren,
  isTransparentNode,
  isTransparentWrapper,
} from "../catalog/wrapper.js";
import {
  useCategory,
  useCategoryCarousel,
  useCategoryCatalog,
  useCategoryLevels,
} from "../model/queries.js";
import type {
  CategoryBrowseOptions,
  UseCategoryCatalogOptions,
} from "../model/queries.js";
import { categoriesQueryKeys } from "../model/queryKeys.js";

/** One option of one level, with everything a skin needs to draw a row. */
export interface CategoryCascadeOption {
  readonly category: Category;
  readonly label: CategoryLabel;
  /**
   * The server's own `tn_children_pks` is empty — nothing at all lives under
   * this row, so choosing it ends the ladder.
   *
   * A HINT, and the one place this hook reports something it has not verified.
   * The column is maintained by django-treenode, which knows nothing about
   * `active` or `deleted`, so `false` can still lead to a rung with no
   * browsable options. The authoritative verdict is
   * {@link CategoryCascadeBag.atLeaf}, which is the absence of a further rung
   * — i.e. the server's own empty answer. This is here so a skin can mark an
   * option as terminal before it is chosen, never so it can skip a request.
   */
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
  readonly parent: Category | null;
  /** The parent's name, for a skin that labels each select. `null` at the
   * top of a rootless cascade, where the label belongs to the host's form. */
  readonly parentLabel: CategoryLabel | null;
  readonly options: readonly CategoryCascadeOption[];
  readonly chosen: Category | null;
  readonly chosenLabel: CategoryLabel | null;
}

export interface CategoryCascadeBag {
  /**
   * The ladder. `empty` is a real answer and means the cascade's root has no
   * children — the tiles arrived at a leaf and there is nothing to narrow.
   *
   * `ready` as soon as the TOP rung is known. A rung still in flight below it
   * is simply not built yet, so the ladder grows downward instead of blanking
   * — which is the whole reason a request per rung is affordable.
   */
  readonly state: LoadState<readonly CategoryCascadeStep[]>;
  /** The deepest answered row, or `null`. */
  readonly selected: Category | null;
  /** Root -> selected, for the poppable trail. Excludes the cascade's own
   * root, which is where the person already was. */
  readonly trail: readonly Category[];
  /** The ladder finished on a category nothing lives under. */
  readonly atLeaf: boolean;
  /** The host's {@link UseCategoryCascadeOptions.partitionChild}, echoed back
   * — see there. */
  readonly partitionChild: Category | null;
  /** A rung below the ones on screen is still in flight. */
  readonly isFetching: boolean;
  /** Why the cascade will not hand a value back yet, or `null`. */
  readonly blockedReason: CategoryCascadeBlockedReason | null;
  /** Answer one level. `null` un-answers it, dropping every level below. */
  choose(depth: number, category: Category | null): void;
  /** Un-answer everything from this depth down — what popping a trail chip
   * does. `clearFrom(0)` empties the cascade. */
  clearFrom(depth: number): void;
  refetch(): void;
}

/**
 * Why the cascade has no value for its host.
 *
 * `not_a_leaf` is the `commit: "leaf"` refusal — the ladder has not reached a
 * category nothing lives under. `has_subcategories` is the `commit: "stage"`
 * one: the chosen category still divides into a LEVEL of subcategories, which
 * is a rung the person has not answered rather than a partition the host
 * offers. Both say the same thing to a person ("this one has subcategories"),
 * and they are separate values because the rules that produced them differ —
 * a `chips` parent is refused by the first and accepted by the second.
 */
export type CategoryCascadeBlockedReason =
  | "nothing_selected"
  | "not_a_leaf"
  | "has_subcategories";

/**
 * What a cascade reports to its host.
 *
 * `"any"` — every choice, leaf or not. The FILTER's rule: "show me everything
 * under Cars" is the commonest narrowing there is, and the search index
 * matches a category path as a prefix precisely so a parent finds its
 * descendants.
 *
 * `"leaf"` — only a leaf, and `null` for every step on the way. The
 * COMPOSER's rule as the tree alone states it: a listing lives in exactly one
 * category, and a non-leaf inherits the wrong feature set. The intermediate
 * steps still show as answered — they are the cursor, not a value.
 *
 * `"stage"` — the COMPOSER's rule as the BROWSE CONTRACT states it, and the
 * one a composer should use where the server resolves `children_as`. The
 * ladder ends where {@link childControl} would put no LIST filter on a feed
 * page — i.e. a leaf (`"none"`) OR a `chips` parent (`"segmented"`) — and
 * offers no rung below it. (Not {@link browseStage}: that answers a different
 * question now — whether a ROOT's page is tiles — and a non-root `chips`
 * parent three levels down is `"feed"` under it, same as everything else.)
 *
 * The difference is a partition. Under `"leaf"` a `chips` parent (`Cars`, with
 * `New` and `Used` under it) is refused and the cascade goes on asking for one
 * of the two, which files the person's listing through a control that presents
 * a FILTER as a level of the tree — and the two halves of the site then
 * disagree about what a category is, which is exactly what the browse contract
 * settled. Under `"stage"` the cascade commits `Cars` and stops; the partition
 * child is a required select the host draws beside it, out of the same rows,
 * where it reads as the choice it is.
 */
export type CategoryCascadeCommit = "any" | "leaf" | "stage";

/**
 * May this row be reported to the host under this rule? The commit rule in
 * one place, so the value the cascade hands over and the reason it withholds
 * one cannot drift apart.
 *
 * `"leaf"` reads `tn_children_pks` here rather than {@link CategoryCascadeBag.atLeaf}
 * because a click has to answer in its own render; `atLeaf` is the
 * server-verified verdict the blocked reason still hangs on.
 */
function commits(category: Category, rule: CategoryCascadeCommit): boolean {
  if (rule === "any") return true;
  if (rule === "stage") return childControl(category) !== "list";
  return categoryChildIds(category).length === 0;
}

/**
 * Merge every TRANSPARENT rung out of the fetched rungs — see
 * `catalog/wrapper.ts`. The ladder still FETCHES every real rung (nothing
 * here changes what `parentIds` asks the server for); this reshapes what a
 * skin is SHOWN, so a transparent child — a structural one-child wrapper OR
 * an authored `children_as: "transparent"` sibling among several — is never
 * presented as its own selectable option.
 *
 * One pass over `sources`: each rung's `options` runs through
 * {@link browseChildren} against `childrenById` (the eager fallback — see
 * below) and against the NEXT fetched rung when that rung really is the
 * transparent child's own children (`next.parentId` matches — true exactly
 * when the person's real ancestor chain already runs through it). A rung
 * consumed that way is dropped from the visible ladder and its `chainIds`
 * slot is dropped with it, so `choose`/`clearFrom` (which index into the
 * VISIBLE ladder) stay aligned. Nothing here re-chases a spliced-in row —
 * {@link browseChildren} is still one hop, so a rung can be consumed at most
 * once per pass.
 *
 * `childrenById` is the eager fallback for a ladder that has NOT been
 * navigated past a given transparent child yet — the common case, since one
 * is never chosen by a click. A candidate missing from the map (not fetched
 * yet) leaves that ONE child's own tile in place rather than merging into an
 * empty rung — the same "falls back, does not hide" contract `browseChildren`
 * documents.
 */
function collapseWrapperRung(
  sources: readonly CategoryCascadeSource[],
  chainIds: readonly number[],
  childrenById: ReadonlyMap<number, readonly Category[] | undefined>
): {
  readonly sources: readonly CategoryCascadeSource[];
  readonly chainIds: readonly number[];
} {
  // Pass 1: independently decide, for every rung, whether it merges and
  // (when it does by consuming the NEXT fetched rung) which two index sets
  // that consumption touches. Independent per rung — `next.options` is
  // always the RAW rung, never an already-merged one — so a further
  // transparent child two rungs deep is not chased across a consumed
  // boundary; the same one-hop-per-splice rule `browseChildren` keeps.
  const mergedOptions = new Map<number, readonly Category[]>();
  // Source index that gets folded into the rung before it and dropped.
  const droppedSourceIndex = new Set<number>();
  // chainIds index that named the now-hidden transparent child — dropped
  // along with the rung it used to point at; the entry that named the
  // CHOSEN option among the folded-in rows (old `chainIds[i + 1]`) is left
  // alone and lands at position `i` once this one is filtered out.
  const droppedChainIndex = new Set<number>();

  for (let i = 0; i < sources.length; i += 1) {
    const source = sources[i];
    if (source === undefined) continue;
    const next = sources[i + 1];
    let consumedId: number | null = null;
    const merged = browseChildren(source.options, (child) => {
      if (next !== undefined && next.parentId === child.id) {
        consumedId = child.id;
        return next.options;
      }
      return childrenById.get(child.id);
    });
    if (merged === source.options) continue;
    mergedOptions.set(i, merged);
    if (consumedId !== null) {
      droppedSourceIndex.add(i + 1);
      droppedChainIndex.add(i);
    }
  }

  if (mergedOptions.size === 0) return { sources, chainIds };

  const outSources = sources
    .map((source, i) => {
      const merged = mergedOptions.get(i);
      return merged === undefined ? source : { ...source, options: merged };
    })
    .filter((_source, i) => !droppedSourceIndex.has(i));
  const outChainIds = chainIds.filter((_id, i) => !droppedChainIndex.has(i));
  return { sources: outSources, chainIds: outChainIds };
}

export interface UseCategoryCascadeOptions
  extends CategoryBrowseOptions,
    UseCategoryCatalogOptions {
  /**
   * Where the ladder starts. Absent/`null` starts at the catalogue's roots,
   * which is the one rung that still costs a catalogue sync — see this file's
   * header.
   *
   * On a category landing, pass the category the TILES arrived at: the two
   * mechanisms then meet at exactly one boundary instead of both offering the
   * same level, and the whole control becomes one `children/` per rung.
   */
  readonly rootId?: number | null;
  /** The host's current answer. */
  readonly value?: number | null;
  readonly onChange?: (id: number | null, category: Category | null) => void;
  /** Default `"any"`. See {@link CategoryCascadeCommit}. */
  readonly commit?: CategoryCascadeCommit;
  /**
   * The top rung of a ROOTLESS ladder, supplied by the host.
   *
   * The escape hatch for the one question the server cannot answer. A host
   * that already knows its top-level categories — a small catalogue, a
   * navigation config, a carousel it has just drawn — hands them over and the
   * catalogue sync is never mounted. Ignored when `rootId` is given, because
   * then there is no rootless rung to fill.
   */
  readonly roots?: readonly Category[];
  /**
   * Live results per category id. Unfilled by default and unfillable by this
   * package — see this file's header.
   */
  readonly counts?: ReadonlyMap<number, number>;
  /**
   * The chip picked on a `commit: "stage"` stop's OWN partition select — the
   * one the host draws beside this cascade, out of the stopped category's own
   * children (see this file's header: it is a required select, not a rung of
   * the ladder, so this hook never fetches or chooses it itself).
   *
   * Echoed back unchanged as {@link CategoryCascadeBag.partitionChild}, so one
   * bag tells a composer or a facet rail whether a chip is picked — which is
   * exactly what `visibleFeatures`'s `chipPicked` needs
   * (`bag.partitionChild !== null`) — instead of the host keeping that fact in
   * a second piece of state that can drift from this one. `null`/absent: no
   * chip picked yet (or the ladder is not stopped on a partition at all).
   */
  readonly partitionChild?: Category | null;
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
    rootId: rootIdOption,
    value,
    onChange,
    commit,
    counts,
    roots,
    partitionChild = null,
    includeDeleted,
    includeInactive,
    includeTest,
    ...catalogOptions
  } = options;
  const rootId = rootIdOption ?? null;
  const commitRule = commit ?? "any";
  // Controlled-ness is read from the PRESENCE of the prop, not from its value:
  // an uncontrolled host and a controlled host holding `null` are the same
  // `null` here, and only the first of them owns its own cursor.
  const controlled = value !== undefined;
  const incoming = value ?? null;

  const queryClient = useQueryClient();
  const visibility = useMemo<CategoryBrowseOptions>(
    () => ({
      ...(includeDeleted !== undefined ? { includeDeleted } : {}),
      ...(includeInactive !== undefined ? { includeInactive } : {}),
      ...(includeTest !== undefined ? { includeTest } : {}),
    }),
    [includeDeleted, includeInactive, includeTest]
  );

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

  // ── The three reads ───────────────────────────────────────────────────────
  //
  // 1. the cursor's own row, for `tn_ancestors_pks` — the chain;
  // 2. the root's own row, for the top rung's heading;
  // 3. one `children/` per rung the chain implies.
  //
  // Plus the catalogue, and ONLY when the ladder is rootless and the host
  // supplied no roots of its own. `enabled: false` is not a disabled request,
  // it is no request: nothing is mounted, nothing is stored, nothing is read.
  const enabled = options.enabled ?? true;
  const cursorQuery = useCategory(cursorId, { enabled });
  const rootQuery = useCategory(rootId, { enabled });
  const needsRoots = rootId === null && roots === undefined;

  /*
   * ── The top rung, and the twenty seconds it used to cost ──────────────────
   *
   * A rootless ladder opens on the catalogue's top level, and the list
   * endpoint has no roots filter — so this rung read the whole table. Measured
   * on a live classified deployment (3583 categories): 36 requests, 1.4 MB,
   * and the composer's FIRST select appeared 19.9 seconds after the screen
   * did. Everything below it costs one `children/` per rung, 0.25-0.39 s, so
   * the entire cost of the control was this one question.
   *
   * `GET /categories/carousel/` answers it in one cached request. It is not a
   * substitute tree and it is not being read as one: the rows are projected to
   * those with NO ancestors, which is the definition of a root, so what comes
   * back is either the deployment's own top level or nothing. Nothing falls
   * through to the catalogue sync, unchanged — a deployment that curates no
   * carousel behaves exactly as it did.
   *
   * It also makes the two halves of the owner's navigation model agree: the
   * tiles a storefront draws from this endpoint and the cascade's first select
   * now offer the same roots, and the handover between them stops being a
   * place where the catalogue changes shape.
   */
  const carouselQuery = useCategoryCarousel({
    ...visibility,
    enabled: needsRoots && enabled,
  });
  const carouselRoots = useMemo<readonly Category[] | null>(() => {
    const rows = carouselQuery.data;
    if (rows === undefined) return null;
    return rows.filter((row) => categoryAncestorChain(row).length === 0);
  }, [carouselQuery.data]);
  // Only once the carousel has ANSWERED: mounting the sync beside it would pay
  // both costs on every cold start, which is the cost this exists to remove.
  const carouselSettled = carouselQuery.isSuccess || carouselQuery.isError;
  const needsCatalogRoots =
    needsRoots && carouselSettled && (carouselRoots?.length ?? 0) === 0;
  const catalogQuery = useCategoryCatalog({
    ...catalogOptions,
    ...visibility,
    enabled: needsCatalogRoots && enabled,
  });

  const chainIds = useMemo(
    () =>
      cascadeChainIds(
        categoryAncestorChain(cursorQuery.data),
        cursorId,
        rootId
      ),
    [cursorQuery.data, cursorId, rootId]
  );
  /**
   * Does the ladder END at the cursor?
   *
   * Only under `commit: "stage"`, and only for a PARTITION — a row that has
   * children and says they are `chips`. Its children are a filter on the
   * cursor's own feed, so offering them as a rung would present a filter as a
   * level of the tree; the host draws them as its own required select instead
   * (see {@link CategoryCascadeCommit}).
   *
   * A LEAF is deliberately not this case, even though {@link childControl}
   * calls it `"none"` under the same "not a list" test `commits` uses. Its
   * speculative rung comes back empty, which is the server VERIFYING the
   * leaf — the evidence `atLeaf` is made of — and an empty rung is never
   * built into a select anyway. Skipping it would save one small request and
   * cost the bag's only honest answer to "did the ladder finish".
   *
   * The cursor's row is the one row this hook already reads for its ancestry,
   * and a row the person just clicked was seeded into that cache on the way
   * past — so the stop is known in the same render the choice is made, and no
   * rung flashes on screen before being withdrawn.
   */
  const stageStop =
    commitRule === "stage" &&
    cursorQuery.data !== undefined &&
    categoryChildIds(cursorQuery.data).length > 0 &&
    childControl(cursorQuery.data) === "segmented";
  /**
   * One entry per rung that could exist. Under a stage stop the LAST one —
   * the speculative rung whose empty answer would discover a leaf — is
   * dropped: its request is not made, and `buildCategoryCascade` therefore
   * builds no select for it. The rung above still shows the cursor as chosen.
   */
  const parentIds = useMemo(() => {
    const ids = cascadeParentIds(rootId, chainIds);
    // Never the TOP rung: a ladder with no rungs at all is not a stop, it is
    // an empty control.
    return stageStop && ids.length > 1 ? ids.slice(0, -1) : ids;
  }, [rootId, chainIds, stageStop]);
  const levelOptions = useMemo<CategoryBrowseOptions>(
    () => ({ ...visibility, enabled }),
    [visibility, enabled]
  );
  const levelQueries = useCategoryLevels(parentIds, levelOptions);

  /**
   * The top rung's options.
   *
   * Rooted: the root's children, straight off `children/`. Rootless: whatever
   * the host handed over, or the catalogue's roots — projected through the
   * SAME browse predicate either way, so a host that passes raw rows cannot
   * accidentally offer a tombstone the rest of the pair filters.
   */
  const topOptions = useMemo<readonly Category[] | null>(() => {
    if (rootId !== null) return levelQueries.rows[0] ?? null;
    if (roots !== undefined) return browsableCategories(roots, visibility);
    if (carouselRoots !== null && carouselRoots.length > 0) return carouselRoots;
    return catalogQuery.data?.index.roots.map((node) => node.category) ?? null;
  }, [
    rootId,
    roots,
    visibility,
    levelQueries.rows,
    carouselRoots,
    catalogQuery.data,
  ]);

  /**
   * The fetched rungs, assembled top-down.
   *
   * A rung's PARENT is the option chosen at the rung above it — already in
   * hand — so only the top rung ever needs a row fetched for its heading.
   */
  const sources = useMemo<readonly CategoryCascadeSource[]>(() => {
    if (topOptions === null) return [];
    const out: CategoryCascadeSource[] = [
      { parentId: rootId, parent: rootQuery.data ?? null, options: topOptions },
    ];
    for (let depth = 1; depth < parentIds.length; depth += 1) {
      const parentId = parentIds[depth] ?? null;
      const rows = levelQueries.rows[depth];
      // Not answered yet: the ladder simply stops here this render and grows
      // when the rung lands. It is never a blank screen, because everything
      // above it is already built.
      if (rows === undefined || rows === null) break;
      const previous = out[depth - 1];
      out.push({
        parentId,
        parent:
          previous?.options.find((row) => row.id === parentId) ?? null,
        options: rows,
      });
    }
    return out;
  }, [topOptions, rootId, rootQuery.data, parentIds, levelQueries.rows]);

  /**
   * The extra rungs a transparent child needs BEFORE anyone has clicked
   * through it — see {@link collapseWrapperRung}. `sources` already carries
   * a transparent child's own children when the real ancestor chain runs
   * through it (an ordinary rung, no extra request); this fan-out is only
   * what a COLD ladder — nothing chosen yet — is missing to reveal them
   * eagerly. One candidate per structural one-child wrapper (unchanged from
   * before) PLUS one per authored `children_as: "transparent"` sibling found
   * anywhere in the fetched rungs — `[]` (no request at all) once there is
   * none to follow.
   */
  const transparentChildIds = useMemo(() => {
    const ids = new Set<number>();
    for (const source of sources) {
      if (isTransparentWrapper(source.options)) {
        const only = source.options[0];
        if (only !== undefined) ids.add(only.id);
      }
      for (const option of source.options) {
        if (isTransparentNode(option) && hasChildren(option)) ids.add(option.id);
      }
    }
    return [...ids];
  }, [sources]);
  const transparentChildQueries = useCategoryLevels(transparentChildIds, levelOptions);
  const transparentChildrenById = useMemo(() => {
    const map = new Map<number, readonly Category[] | undefined>();
    transparentChildIds.forEach((id, index) => {
      map.set(id, transparentChildQueries.rows[index] ?? undefined);
    });
    return map;
  }, [transparentChildIds, transparentChildQueries.rows]);

  const collapsed = useMemo(
    () => collapseWrapperRung(sources, chainIds, transparentChildrenById),
    [sources, chainIds, transparentChildrenById]
  );

  const levels = useMemo<readonly CategoryCascadeLevel[]>(
    () => buildCategoryCascade(collapsed.sources, collapsed.chainIds),
    [collapsed]
  );

  const steps = useMemo<readonly CategoryCascadeStep[]>(
    () =>
      levels.map((level) => ({
        depth: level.depth,
        parent: level.parent,
        parentLabel: level.parent === null ? null : categoryLabel(level.parent),
        options: level.options.map((row) => ({
          category: row,
          label: categoryLabel(row),
          isLeaf: categoryChildIds(row).length === 0,
          count: counts?.get(row.id) ?? null,
        })),
        chosen: level.chosen,
        chosenLabel:
          level.chosen === null ? null : categoryLabel(level.chosen),
      })),
    [levels, counts]
  );

  const selected = cascadeSelection(levels);
  // The VISIBLE pair, not the raw fetch: a wrapper merged away here must not
  // reappear as "the rung under the deepest answer" when it is the rung this
  // hook chose not to show at all.
  const atLeaf = cascadeReachedLeaf(collapsed.sources, collapsed.chainIds);

  /**
   * The ladder's own load state, composed from the reads that produce the TOP
   * rung and nothing else.
   *
   * A rung below it that is still in flight is `isFetching`, never `loading`:
   * turning the whole control back into a skeleton because its fourth select
   * is arriving is precisely the spinner-per-rung this design exists to avoid.
   */
  const state = useMemo<LoadState<readonly CategoryCascadeStep[]>>(() => {
    const failure =
      levelQueries.error ??
      (needsCatalogRoots ? catalogQuery.error : null) ??
      (rootId !== null ? rootQuery.error : null) ??
      cursorQuery.error;
    if (topOptions === null) {
      return failure != null ? loadFailed(failure) : loadLoading();
    }
    return loadReady(steps);
  }, [
    topOptions,
    steps,
    levelQueries.error,
    needsCatalogRoots,
    catalogQuery.error,
    rootId,
    rootQuery.error,
    cursorQuery.error,
  ]);

  /**
   * Move the cursor and report whatever the commit rule allows, in ONE state
   * write. Both halves have to land together: reporting first and moving the
   * cursor after would let a controlled host re-render against the old cursor
   * and rebuild the ladder the person just left.
   *
   * The chosen ROW is written into the per-id cache on the way past. It is the
   * same row `GET {id}/` would answer with, and seeding it is what keeps a
   * click from costing a second request just to learn the ancestry of a
   * category the person picked from a list this hook drew.
   */
  const moveTo = (category: Category | null): void => {
    if (category !== null) {
      queryClient.setQueryData(
        categoriesQueryKeys.category(category.id),
        category
      );
    }
    const committed =
      category === null || !commits(category, commitRule) ? null : category;
    setCursorState({
      cursor: category?.id ?? null,
      from: committed?.id ?? null,
    });
    onChange?.(committed?.id ?? null, committed);
  };

  return {
    state,
    selected,
    trail: cascadeTrail(levels),
    atLeaf,
    partitionChild,
    isFetching:
      (levelQueries.isPending || transparentChildQueries.isPending) &&
      levels.length > 0,
    blockedReason:
      selected === null
        ? "nothing_selected"
        : commitRule === "leaf" && !atLeaf
          ? "not_a_leaf"
          : commitRule === "stage" && !commits(selected, commitRule)
            ? "has_subcategories"
            : null,
    choose: (depth, category) => {
      if (category !== null) {
        moveTo(category);
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
      void queryClient.invalidateQueries({ queryKey: categoriesQueryKeys.all });
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
