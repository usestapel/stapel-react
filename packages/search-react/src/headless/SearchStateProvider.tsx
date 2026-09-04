import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactElement, ReactNode } from "react";
import type {
  FacetLabelsMap,
  SearchGeo,
  SearchQueryState,
  SearchRange,
} from "../api/types.js";
import {
  EMPTY_FACET_KEYS,
  activeFilterCount,
  clearFilters,
  facetKeyMapFromLabels,
  parseSearchState,
  patchSearchState,
  setFilterValues,
  setRangeValue,
  toggleFilterValue,
  writeSearchState,
} from "../state/urlState.js";
import type {
  FacetKeyMap,
  ParseSearchStateOptions,
  SearchStateIssue,
  SearchStatePatch,
} from "../state/urlState.js";

/**
 * THE ROUTER SEAM.
 *
 * Two members, and they are exactly the shape react-router v7's
 * `useSearchParams()` returns — so binding one is a one-liner (`./router`
 * ships it). The seam exists so the main entry carries no router: a Next.js
 * host, a hash-router host, or a server-rendered page that reads
 * `new URL(request.url).searchParams` all satisfy it, and the pair stays
 * honest about the fact that URL state is a ROUTER concern it does not own.
 */
export interface SearchParamsAdapter {
  readonly params: URLSearchParams;
  /**
   * Write the next query string.
   *
   * `replace` is meaningful, not decorative: a FILTER change pushes (so Back
   * removes exactly the last filter — the spec's §4.2 acceptance), while a
   * correction that the person did not perform replaces. Callers below pass
   * it deliberately, following {@link DEFAULT_HISTORY_MODE} — see that table
   * for which change gets which. An adapter that ignores `replace` breaks the
   * Back button.
   */
  setParams(next: URLSearchParams, options?: { readonly replace?: boolean }): void;
}

/** One kind of change a control can make to the search — the unit
 * {@link DEFAULT_HISTORY_MODE} assigns a history mode to. */
export type SearchHistoryKind =
  | "text"
  | "sort"
  | "category"
  | "language"
  | "filter"
  | "range"
  | "geo"
  | "limit"
  | "clear"
  | "page"
  | "patch";

/** `"push"` opens a new history entry; `"replace"` overwrites the current one. */
export type HistoryMode = "push" | "replace";

/**
 * THE HISTORY POLICY — one place stating which change gets its own Back step.
 *
 * `"push"` is what makes Back undo exactly one thing: choosing or removing a
 * facet value (`filter`), narrowing or widening a range (`range`), picking a
 * partition or another category (`category` — `<PartitionChips>` and
 * `<OtherCategoriesLine>` both go through `setCategory`), applying a place
 * (`geo`) or a sort (`sort`) are all decisions a person can want to take back
 * one press at a time, so each one opens its own entry — this is the
 * behaviour spec §4.2 tests: "press Back and lose exactly the last filter".
 *
 * `"replace"` is for a change too fine-grained, or too incidental, to be a
 * Back-able step of its own:
 *
 *  - `text` — one history entry per keystroke would make Back useless long
 *    before it reached the filter underneath;
 *  - `limit` — a page-size preference, not a narrowing;
 *  - `page` — a keyset cursor move is SCROLLING, not a decision. Back from
 *    page 3 has to land where the visitor WAS (off the pager, before they
 *    started paging), not quietly on page 2 with the pager still showing —
 *    the reference behaves the first way, and a mutator that pushed here used
 *    to make Back page backwards forever instead of leaving the results.
 *
 * Every mutator {@link SearchStateBag} ships follows this table; `clear` and
 * the `patch` escape hatch push by default like any other applied change. A
 * host that disagrees can still call {@link SearchStateBag.patch} directly
 * with its own `replace` — the table governs this pair's own controls, not
 * every possible call.
 */
export const DEFAULT_HISTORY_MODE: Readonly<Record<SearchHistoryKind, HistoryMode>> = {
  text: "replace",
  sort: "push",
  category: "push",
  language: "push",
  filter: "push",
  range: "push",
  geo: "push",
  limit: "replace",
  clear: "push",
  page: "replace",
  patch: "push",
};

/** {@link DEFAULT_HISTORY_MODE} as the `setParams` options it produces. */
function historyOptions(kind: SearchHistoryKind): { readonly replace?: boolean } {
  return DEFAULT_HISTORY_MODE[kind] === "replace" ? { replace: true } : {};
}

/** Everything a control needs to read and move the search. */
export interface SearchStateBag {
  /** The current state, parsed from the URL. Nothing else holds a copy. */
  readonly state: SearchQueryState;
  /** What the URL carried that could not be read (see `SearchStateIssue`). */
  readonly issues: readonly SearchStateIssue[];
  /** Facet values + ranges + geo the person has applied.
   *
   * Everything counted here was chosen BY the person: this pair applies no
   * filter of its own, so the number beside "clear all" can never be one the
   * reader has to go hunting for.
   */
  readonly activeFilters: number;
  /**
   * A location the host can narrow to, which nobody has accepted yet —
   * `undefined` when the host offers none, or when the search already carries
   * a location of its own (an offer would then be a second answer to a
   * question already answered).
   *
   * Draw it as an invitation ("near me"), never as state.
   */
  readonly geoOffer: SearchGeo | undefined;
  /**
   * Whether the location this search is USING is the one the host offered —
   * i.e. the visitor pressed "near me" (or followed a link built by somebody
   * who did) and has not moved the pin since.
   *
   * A fact about provenance, and only the provider holds it: `state.geo` is a
   * centre and a radius, and every way of arriving at a centre produces the
   * same three numbers. Without it a summary line has to guess, and the guess
   * it shipped was "a chosen place on the map" — said to a person who had
   * pressed a button and never opened a map.
   *
   * `false` whenever there is no offer to compare against, which includes
   * every search on a host that offers none.
   */
  readonly geoIsOffer: boolean;

  setText(q: string): void;
  setSort(sort: string | null): void;
  setCategory(category: string | null): void;
  setLanguage(lang: string | null): void;
  toggleFilter(slug: string, value: string): void;
  setFilter(slug: string, values: readonly string[]): void;
  setRange(slug: string, range: SearchRange | null): void;
  setGeo(geo: SearchGeo | null): void;
  setLimit(limit: number | null): void;
  clearAll(): void;
  /** Move to a keyset page. The ONLY mutator that keeps a cursor. */
  goToAnchor(anchor: string | null, direction: "next" | "prev"): void;
  /** Accept {@link geoOffer}. A no-op when there is nothing on offer, so a
   * control can be pressed without first re-checking what this bag says. */
  acceptGeoOffer(): void;
  /** Escape hatch for a host control this pair does not ship. Goes through
   * `patchSearchState`, so it drops the cursor like every other change. */
  patch(patch: SearchStatePatch): void;
}

/**
 * How close two coordinates have to be to be the same place, in degrees.
 *
 * The applied location makes a round trip through the query string, so the
 * numbers that come back are the ones `String(lat)` produced rather than the
 * float the device handed over. 1e-6 degrees is ~11cm — far below any
 * position a browser reports and far above any rounding the codec introduces.
 */
const SAME_PLACE_EPSILON = 1e-6;

/** Is the applied location the offered one? See {@link SearchStateBag.geoIsOffer}. */
function sameCenter(
  applied: SearchGeo | undefined,
  offered: SearchGeo | undefined
): boolean {
  if (applied === undefined || offered === undefined) return false;
  if (applied.kind !== "center" || offered.kind !== "center") return false;
  return (
    Math.abs(applied.lat - offered.lat) < SAME_PLACE_EPSILON &&
    Math.abs(applied.lon - offered.lon) < SAME_PLACE_EPSILON
  );
}

const StateContext = createContext<SearchStateBag | null>(null);

/**
 * WHERE THE SHORT KEYS COME FROM.
 *
 * `f.make` is a fact of the ANSWER (`facet_labels[slug].url_key`, resolved by
 * the server inside the queried category's scope), and the codec that writes
 * the address runs above the query that produces it. So the map is published
 * upwards: whoever holds an answer hands it to this provider, which re-parses
 * the URL with it and writes every subsequent address through it.
 *
 * Late by construction and correct at every moment in between: before the
 * first answer the state holds whatever key the link carried, the request
 * carries the same key, and the server resolves both forms. Nothing waits and
 * nothing is rewritten behind the reader.
 */
interface FacetKeyRegistry {
  readonly keys: FacetKeyMap;
  publish(next: FacetKeyMap): void;
}

const FacetKeysContext = createContext<FacetKeyRegistry | null>(null);

/** Two maps are the same map when they write the same keys — the read side is
 * derived from the write side, so comparing one compares both. */
function sameKeys(a: FacetKeyMap, b: FacetKeyMap): boolean {
  const left = Object.keys(a.write);
  const right = Object.keys(b.write);
  if (left.length !== right.length) return false;
  return left.every((slug) => a.write[slug] === b.write[slug]);
}

/**
 * Publish an answer's short keys to the state provider above.
 *
 * A no-op outside `<SearchStateProvider>` and a no-op on a server that sends
 * no `url_key`: both leave the address spelled in slugs, which is what it was
 * spelled in before this existed.
 */
export function usePublishFacetKeys(labels: FacetLabelsMap | undefined): void {
  const registry = useContext(FacetKeysContext);
  useEffect(() => {
    if (registry === null || labels === undefined) return;
    registry.publish(facetKeyMapFromLabels(labels));
  }, [registry, labels]);
}

/** The short-key map this search is currently writing its address with. */
export function useFacetKeys(): FacetKeyMap {
  return useContext(FacetKeysContext)?.keys ?? EMPTY_FACET_KEYS;
}

export interface SearchStateProviderProps extends ParseSearchStateOptions {
  readonly adapter: SearchParamsAdapter;
  /**
   * A location this search COULD be narrowed to — offered, never applied.
   *
   * The host resolves it (a granted browser prompt, the server's IP guess);
   * this provider does nothing with it except hand it back on the bag as
   * {@link SearchStateBag.geoOffer}, so a control can draw "near me" and the
   * PERSON decides. Nothing is written to the URL until they press it.
   *
   * ## Why this is an offer and not a default (defect: a silent radius)
   *
   * The previous shape of this prop (`defaultGeo`) wrote the visitor's
   * position into the query string on the first render that could, under four
   * careful rules about not overruling a person. Every rule held, and the
   * result was still a filter nobody asked for: a browser permission granted
   * once, for one map, became a permanent 25 km wall around every category
   * leaf and every result page in the deployment. Measured on a live board:
   * 48 phones became 17, and three leaves with stock became "nothing found".
   * The page looks perfectly healthy while doing it, which is what makes it
   * dangerous — the honest reading of an empty leaf is "this board is empty",
   * not "your browser told us where you are".
   *
   * There is no set of rules that fixes that, because the defect is not in
   * the rules: applying a spatial filter is a decision about what the person
   * wants to see, and only they hold it. So the prop carries the same value
   * and the provider no longer commits it. Two more defects fall out with it:
   * the URL is never rewritten behind the visitor (a hand-typed `radius_km`
   * survives), and the results are fetched ONCE instead of being fetched and
   * immediately superseded by a second, narrower query.
   */
  readonly geoOffer?: SearchGeo | undefined;
  readonly children: ReactNode;
}

/**
 * Binds the URL to the search state. Every control below reads and writes
 * through {@link useSearchState}; no component holds a second copy of a
 * filter, which is what makes "copy the link into another tab" produce the
 * same page by construction rather than by discipline.
 */
export function SearchStateProvider(
  props: SearchStateProviderProps
): ReactElement {
  const { adapter, children, geoOffer, ...parseOptions } = props;
  const { params, setParams } = adapter;

  // The parse options are spread into a stable dependency: a host that builds
  // the object inline (the normal way to write it) must not reparse on every
  // render and hand every consumer a new state object.
  const {
    defaultType,
    defaultQ,
    defaultSort,
    defaultLimit,
    defaultCategory,
    defaultLang,
  } = parseOptions;

  const search = params.toString();

  // The answer's short keys (`f.make`), published from below — see
  // `FacetKeysContext`. Held here because this is where both directions of
  // the codec run.
  const [facetKeys, setFacetKeys] = useState<FacetKeyMap>(EMPTY_FACET_KEYS);
  const registry = useMemo<FacetKeyRegistry>(
    () => ({
      keys: facetKeys,
      publish: (next) => {
        // Idempotent on purpose: this is called from an effect under a query
        // whose data identity is stable, and a setState that always produced
        // a new object would re-render the whole page per answer.
        setFacetKeys((was) => (sameKeys(was, next) ? was : next));
      },
    }),
    [facetKeys]
  );

  const parsed = useMemo(
    () =>
      parseSearchState(new URLSearchParams(search), {
        facetKeys,
        defaultType,
        ...(defaultQ !== undefined ? { defaultQ } : {}),
        ...(defaultSort !== undefined ? { defaultSort } : {}),
        ...(defaultLimit !== undefined ? { defaultLimit } : {}),
        ...(defaultCategory !== undefined ? { defaultCategory } : {}),
        ...(defaultLang !== undefined ? { defaultLang } : {}),
      }),
    [
      search,
      facetKeys,
      defaultType,
      defaultQ,
      defaultSort,
      defaultLimit,
      defaultCategory,
      defaultLang,
    ]
  );

  const commit = useCallback(
    (next: SearchQueryState, options?: { readonly replace?: boolean }): void => {
      setParams(
        writeSearchState(next, new URLSearchParams(search), facetKeys, {
          defaultType,
          ...(defaultSort !== undefined ? { defaultSort } : {}),
          ...(defaultLimit !== undefined ? { defaultLimit } : {}),
        }),
        options
      );
    },
    [setParams, search, facetKeys, defaultType, defaultSort, defaultLimit]
  );


  const bag = useMemo<SearchStateBag>(() => {
    const state = parsed.state;
    /**
     * The offer, carrying the radius the URL already asked for.
     *
     * `?radius_km=300` with no `lat`/`lon` narrows nothing — there is no
     * point to measure from — but it IS a number the person typed, and the
     * offer used to ignore it twice over: the button advertised the host's
     * own 25km, and pressing it wrote 25 into the address over the 300 that
     * was already there. Three things now agree, which is the whole of the
     * fix: what the link asked for, what the button says, and what pressing
     * it does. A bbox offer is left alone — a box has no radius to carry.
     */
    const offer: SearchGeo | undefined =
      geoOffer !== undefined &&
      geoOffer.kind === "center" &&
      parsed.orphanRadiusKm !== undefined
        ? { ...geoOffer, radiusKm: parsed.orphanRadiusKm }
        : geoOffer;
    const apply = (
      next: SearchQueryState,
      options?: { readonly replace?: boolean }
    ): void => {
      commit(next, options);
    };
    return {
      state,
      issues: parsed.issues,
      activeFilters: activeFilterCount(state),
      // An offer stands only while the question is open. Once the search
      // carries a place — from a link, or because somebody pressed the offer
      // — there is nothing left to offer, and a control that kept drawing
      // "near me" beside an applied location would be inviting a person to
      // re-answer a question they can already see the answer to.
      geoOffer: state.geo === undefined ? offer : undefined,
      geoIsOffer: sameCenter(state.geo, offer),

      // Every history mode below follows DEFAULT_HISTORY_MODE — see that
      // table for the reasoning behind which kind pushes and which replaces.
      setText: (q) => apply(patchSearchState(state, { q }), historyOptions("text")),
      setSort: (sort) => apply(patchSearchState(state, { sort }), historyOptions("sort")),
      setCategory: (category) =>
        apply(patchSearchState(state, { category }), historyOptions("category")),
      setLanguage: (lang) =>
        apply(patchSearchState(state, { lang }), historyOptions("language")),
      toggleFilter: (slug, value) =>
        apply(toggleFilterValue(state, slug, value), historyOptions("filter")),
      setFilter: (slug, values) =>
        apply(setFilterValues(state, slug, values), historyOptions("filter")),
      setRange: (slug, range) =>
        apply(setRangeValue(state, slug, range), historyOptions("range")),
      setGeo: (geo) => {
        apply(patchSearchState(state, { geo }), historyOptions("geo"));
      },
      acceptGeoOffer: () => {
        if (offer === undefined || state.geo !== undefined) return;
        // A PUSH, like any other filter the person applies: Back takes the
        // narrowing off again, which is the same promise every chip makes.
        apply(patchSearchState(state, { geo: offer }), historyOptions("geo"));
      },
      setLimit: (limit) =>
        apply(patchSearchState(state, { limit }), historyOptions("limit")),
      clearAll: () => apply(clearFilters(state), historyOptions("clear")),
      // A keyset move REPLACES: it is scrolling, not a decision, and a push
      // here used to make Back page backwards forever instead of leaving the
      // results where the visitor actually was.
      goToAnchor: (anchor, direction) =>
        apply(patchSearchState(state, { anchor, direction }), historyOptions("page")),
      patch: (patch) => apply(patchSearchState(state, patch), historyOptions("patch")),
    };
  }, [parsed, commit, geoOffer]);


  return (
    <FacetKeysContext.Provider value={registry}>
      <StateContext.Provider value={bag}>{children}</StateContext.Provider>
    </FacetKeysContext.Provider>
  );
}

/**
 * The search state and its mutators. Throws when used outside
 * `<SearchStateProvider>` — a control that silently rendered with an empty
 * state would look like a search with no filters rather than a wiring bug.
 */
export function useSearchState(): SearchStateBag {
  const bag = useContext(StateContext);
  if (bag === null) {
    throw new Error(
      "useSearchState must be used inside <SearchStateProvider> — the URL is the state, and there is no fallback copy of it."
    );
  }
  return bag;
}
