import {
  createContext,
  useCallback,
  useContext,
  useMemo,
} from "react";
import type { ReactElement, ReactNode } from "react";
import type {
  SearchGeo,
  SearchQueryState,
  SearchRange,
} from "../api/types.js";
import {
  activeFilterCount,
  clearFilters,
  parseSearchState,
  patchSearchState,
  setFilterValues,
  setRangeValue,
  toggleFilterValue,
  writeSearchState,
} from "../state/urlState.js";
import type {
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
   * it deliberately; an adapter that ignores it breaks the Back button.
   */
  setParams(next: URLSearchParams, options?: { readonly replace?: boolean }): void;
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

const StateContext = createContext<SearchStateBag | null>(null);

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

  const parsed = useMemo(
    () =>
      parseSearchState(new URLSearchParams(search), {
        defaultType,
        ...(defaultQ !== undefined ? { defaultQ } : {}),
        ...(defaultSort !== undefined ? { defaultSort } : {}),
        ...(defaultLimit !== undefined ? { defaultLimit } : {}),
        ...(defaultCategory !== undefined ? { defaultCategory } : {}),
        ...(defaultLang !== undefined ? { defaultLang } : {}),
      }),
    [search, defaultType, defaultQ, defaultSort, defaultLimit, defaultCategory, defaultLang]
  );

  const commit = useCallback(
    (next: SearchQueryState, options?: { readonly replace?: boolean }): void => {
      setParams(writeSearchState(next, new URLSearchParams(search)), options);
    },
    [setParams, search]
  );


  const bag = useMemo<SearchStateBag>(() => {
    const state = parsed.state;
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
      geoOffer: state.geo === undefined ? geoOffer : undefined,

      // Typing replaces rather than pushes: one history entry per letter
      // would make Back useless, which is the control the spec's acceptance
      // leans on for "Back removes the last filter".
      setText: (q) => apply(patchSearchState(state, { q }), { replace: true }),
      setSort: (sort) => apply(patchSearchState(state, { sort })),
      setCategory: (category) => apply(patchSearchState(state, { category })),
      setLanguage: (lang) => apply(patchSearchState(state, { lang })),
      toggleFilter: (slug, value) => apply(toggleFilterValue(state, slug, value)),
      setFilter: (slug, values) => apply(setFilterValues(state, slug, values)),
      setRange: (slug, range) => apply(setRangeValue(state, slug, range)),
      setGeo: (geo) => {
        apply(patchSearchState(state, { geo }));
      },
      acceptGeoOffer: () => {
        if (geoOffer === undefined || state.geo !== undefined) return;
        // A PUSH, like any other filter the person applies: Back takes the
        // narrowing off again, which is the same promise every chip makes.
        apply(patchSearchState(state, { geo: geoOffer }));
      },
      // A page size is a preference, not a step through the results.
      setLimit: (limit) => apply(patchSearchState(state, { limit }), { replace: true }),
      clearAll: () => apply(clearFilters(state)),
      goToAnchor: (anchor, direction) =>
        apply(patchSearchState(state, { anchor, direction })),
      patch: (patch) => apply(patchSearchState(state, patch)),
    };
  }, [parsed, commit, geoOffer]);


  return <StateContext.Provider value={bag}>{children}</StateContext.Provider>;
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
