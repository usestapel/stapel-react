import { useCallback } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  actionBlockedByFailure,
  loadStateFromQuery,
  mapLoad,
} from "@stapel/core";
import type { ActionAvailability, LoadState, StapelApiError } from "@stapel/core";
import type {
  SearchDegradation,
  SearchItem,
  SearchResponse,
} from "../api/types.js";
import { SEARCH_I18N_KEYS } from "../i18n/keys.js";
import { useSearchQuery } from "../model/queries.js";
import {
  countIsEstimate,
  countKind,
  parseDegradations,
} from "../state/degradations.js";
import type { SearchCountKind } from "../state/degradations.js";
import { useSearchState } from "./SearchStateProvider.js";

/** What the envelope says about this page, beside the rows. */
export interface SearchPageInfo {
  /**
   * Total matches, or `null` when the engine cannot say — which is a real
   * state and NOT zero. Read it together with {@link SearchPageInfo.countKind}:
   * a `count` under `"at_least"` is a floor, not a total.
   */
  readonly count: number | null;
  readonly exactTotal: boolean;
  /** The server's own word: `count` is a floor ("at least N"), not a total. */
  readonly countIsLowerBound: boolean;
  /**
   * The one value a skin needs to choose a sentence: `"exact"` → "N",
   * `"at_least"` → "N+", `"unknown"` → no count at all.
   */
  readonly countKind: SearchCountKind;
  /**
   * `true` when `count` must not be rendered as a plain number.
   *
   * @deprecated Equivalent to `countKind !== "exact"` and blind to
   * `count: null`. Use {@link SearchPageInfo.countKind}.
   */
  readonly countIsEstimate: boolean;
  readonly hasNext: boolean;
  readonly hasPrev: boolean;
  /** The sort the SERVER applied — which may not be the one requested when
   * none was requested at all (it picks relevance with text, newest without). */
  readonly sort: string;
  readonly backend: string;
  readonly tookMs: number;
  /** How many of this page's rows are promoted (DSA Art. 26 marking). */
  readonly promotedCount: number;
}

/** The bag `<SearchResults>` hands its render prop. */
export interface SearchResultsBag {
  /**
   * The page's rows as a state a skin cannot flatten. Render with core's
   * `matchList` — its four arms are what keeps "nothing found" a sentence
   * that can only be said about a search that actually ran. The 2026-08-09
   * incident was this exact substitution.
   */
  readonly state: LoadState<readonly SearchItem[]>;
  /** The whole envelope, for a skin that needs a field this bag does not
   * lift. Same load discipline. */
  readonly envelope: LoadState<SearchResponse>;
  /** `null` until the page has landed. */
  readonly page: SearchPageInfo | null;
  /**
   * What the engine could not do for this query, de-duplicated. Rendered as a
   * banner, never swallowed: a page that hides "counts are approximate" is
   * claiming a precision the backend explicitly disclaimed.
   */
  readonly degradations: readonly SearchDegradation[];
  /** A refetch is in flight over rows already on screen. */
  readonly isFetching: boolean;
  /** The last refusal, for a skin that renders the code's own sentence.
   * `error.400.search_window_exceeded` is "narrow the search", not "nothing
   * found" — the two must not share a branch. */
  readonly error: StapelApiError | null;
  /** Blocked WITH A REASON at the last page, never a bare disabled button. */
  readonly next: ActionAvailability;
  readonly prev: ActionAvailability;
  goNext(): void;
  goPrev(): void;
  refetch(): void;
}

/**
 * Headless result page — the rows, the keyset controls, and the envelope's
 * honesty block. Renderless: it decides nothing about how any of that looks.
 *
 * Pagination is KEYSET (`anchor`/`direction`), not offset: there is no page
 * number to jump to, and depth is capped server-side by `MAX_RESULT_WINDOW`
 * (a cursor past it answers `error.400.search_window_exceeded`). Both facts
 * are the backend's, and both are surfaced rather than papered over.
 */
export function SearchResults(props: {
  /** Skip the request (e.g. while the host is still resolving a category). */
  enabled?: boolean;
  children: (bag: SearchResultsBag) => ReactNode;
}): ReactNode {
  const { state: searchState, goToAnchor } = useSearchState();
  const query = useSearchQuery(
    searchState,
    props.enabled !== undefined ? { enabled: props.enabled } : undefined
  );

  const envelope = loadStateFromQuery(query);
  const rows = mapLoad(envelope, (data) => data.items as readonly SearchItem[]);
  const data = envelope.status === "ready" ? envelope.data : null;

  const degradations = parseDegradations(data?.degraded);

  const page: SearchPageInfo | null =
    data === null
      ? null
      : {
          count: data.count,
          exactTotal: data.exact_total,
          countIsLowerBound: data.count_is_lower_bound === true,
          countKind: countKind(
            data.count,
            data.count_is_lower_bound,
            data.exact_total,
            degradations
          ),
          countIsEstimate: countIsEstimate(data.exact_total, degradations),
          hasNext: data.has_next,
          hasPrev: data.has_prev,
          sort: data.sort,
          backend: data.backend,
          tookMs: data.took_ms,
          promotedCount: data.items.filter((item) => item.promoted).length,
        };

  const blockFor = (
    hasMore: boolean,
    code: string
  ): ActionAvailability => {
    if (envelope.status === "loading") return actionBlocked("stapel.action.blocked.loading");
    if (envelope.status === "failed") return actionBlockedByFailure(envelope.error);
    return hasMore ? actionAvailable() : actionBlocked(code);
  };

  const goNext = useCallback(() => {
    if (data?.next_anchor != null) goToAnchor(data.next_anchor, "next");
  }, [data, goToAnchor]);

  const goPrev = useCallback(() => {
    // `prev_anchor` is emitted only when there IS a previous page; when the
    // person is walking back to the first one the server sends none, and
    // clearing the cursor is what "page 1" means under keyset paging.
    if (data?.has_prev === true) goToAnchor(data.prev_anchor, "prev");
  }, [data, goToAnchor]);

  return props.children({
    state: rows,
    envelope,
    page,
    degradations,
    isFetching: query.isFetching,
    error: query.error ?? null,
    next: blockFor(data?.has_next === true, SEARCH_I18N_KEYS.resultsBlockedAtEnd),
    prev: blockFor(data?.has_prev === true, SEARCH_I18N_KEYS.resultsBlockedAtStart),
    goNext,
    goPrev,
    refetch: () => {
      void query.refetch();
    },
  });
}
