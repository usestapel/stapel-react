import { createContext, useCallback, useContext, useMemo } from "react";
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
  /** Facet values + ranges + geo the person has applied. */
  readonly activeFilters: number;

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
  /** Escape hatch for a host control this pair does not ship. Goes through
   * `patchSearchState`, so it drops the cursor like every other change. */
  patch(patch: SearchStatePatch): void;
}

const StateContext = createContext<SearchStateBag | null>(null);

export interface SearchStateProviderProps extends ParseSearchStateOptions {
  readonly adapter: SearchParamsAdapter;
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
  const { adapter, children, ...parseOptions } = props;
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
      setGeo: (geo) => apply(patchSearchState(state, { geo })),
      // A page size is a preference, not a step through the results.
      setLimit: (limit) => apply(patchSearchState(state, { limit }), { replace: true }),
      clearAll: () => apply(clearFilters(state)),
      goToAnchor: (anchor, direction) =>
        apply(patchSearchState(state, { anchor, direction })),
      patch: (patch) => apply(patchSearchState(state, patch)),
    };
  }, [parsed, commit]);

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
