/**
 * `useSearchCount(state)` — how many results a search state WOULD return,
 * without showing any of them.
 *
 * A quick-search panel's button ("Show 128 listings") has to know the total
 * for a state that is not on screen and not in the URL: the person is still
 * composing it. `<SearchResults>` cannot answer that — it reads the committed
 * URL state — and `useAppliedCount` deliberately reads the page already in
 * cache. So this is a read of its own, over a state the caller hands in.
 *
 * ── THE GAP THIS HOOK RIDES OVER, STATED ──────────────────────────────────
 *
 * **stapel-search has no count-only endpoint.** `SearchApi` is `query`,
 * `suggest` and `ranking`; nothing answers "how many" without also assembling
 * a page. So this hook issues the ORDINARY query with the smallest page the
 * endpoint will serve ({@link SEARCH_COUNT_PAGE_SIZE}) and facet counting
 * switched off, and reads `count` out of the envelope it gets back. That is a
 * deliberate choice with a cost: the engine still ranks the candidate set and
 * the backend still serializes one row, so a count is roughly as expensive as
 * a search. It is not a bug to be worked around client-side — a debounce is
 * the mitigation, not a fix.
 *
 * FOLLOW-UP (stapel-search): a `GET /count` verb that answers the envelope's
 * three count fields (`count`, `count_is_lower_bound`, `exact_total`) plus
 * `degraded[]` and nothing else. When it lands, this hook's body changes and
 * its signature does not.
 *
 * ── What it asks, and what it deliberately does not ───────────────────────
 *
 * The state is normalized before it goes out, and each removal is a rule:
 *
 *  - `facets: "off"` — a count does not draw a facet panel, and counting
 *    facets is the expensive half of the request.
 *  - `limit: 1` — the smallest page. Zero is not a page size the endpoint
 *    documents, and asking for the default 24 would serialize 24 cards nobody
 *    renders.
 *  - `anchor` / `direction` dropped — a cursor asks about a PAGE, and the
 *    count is about the whole result set. Keeping one would also cache the
 *    same total once per page a person walked through.
 *  - `sort` dropped — the total does not depend on the order, and keeping it
 *    would miss the cache every time somebody changed the sort.
 *
 * Everything else — `q`, `category`, `owner`, filters, ranges, geo, `lang` —
 * is exactly what a real search would carry, because those are what change the
 * answer.
 *
 * ── The count is a LoadState, and the number is not always a number ────────
 *
 * The ready value carries `countKind`: `"exact"` is a total, `"at_least"` is
 * a floor, `"unknown"` is the engine declining to say — and `count: null`
 * under `"unknown"` is never `0`. A skin that renders the floor as a total is
 * the defect `state/degradations.ts` exists to prevent, so the kind travels
 * with the number rather than beside it.
 */
import { useEffect, useRef, useState } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { searchQueryParams } from "../api/searchApi.js";
import type { SearchQueryState } from "../api/types.js";
import { useSearchQuery } from "../model/queries.js";
import {
  SEARCH_COUNT_DEBOUNCE_MS,
  SEARCH_COUNT_PAGE_SIZE,
} from "../state/limits.js";
import { countKind, parseDegradations } from "../state/degradations.js";
import type { SearchCountKind } from "../state/degradations.js";

/** What a count read answers. */
export interface SearchCount {
  /** `null` is "the engine cannot say" — a real state, and NOT zero. */
  readonly count: number | null;
  /** Whether that number may be spoken as a total, as a floor, or at all. */
  readonly kind: SearchCountKind;
}

/**
 * The state a count is asked about: a doc type plus as much or as little of a
 * search as the caller has composed. Partial on purpose — a panel holding one
 * chosen facet is a legitimate question, and making it build a full
 * {@link SearchQueryState} would mean spelling `filters: {}` and `ranges: {}`
 * at every call site.
 */
export type SearchCountState = Pick<SearchQueryState, "type"> &
  Partial<Omit<SearchQueryState, "type">>;

export interface UseSearchCountOptions {
  /**
   * Ask at all. Default `true`. `false` holds the hook at `loading` (the
   * fleet's shape for "no answer yet"), so a panel that is still resolving its
   * category does not ask about a state it has not finished building.
   */
  readonly enabled?: boolean;
  /**
   * Quiet time before a CHANGED state is asked about (default
   * {@link SEARCH_COUNT_DEBOUNCE_MS}). The first state is asked about
   * immediately — a panel that opens should not wait a quarter second to say
   * its number — and every change after that is coalesced, because a count
   * rides the full query (see this file's header) and a request per keystroke
   * is how a throttled endpoint starts answering 429.
   *
   * `0` disables it, for a caller whose state only changes on a commit.
   */
  readonly debounceMs?: number;
}

/**
 * The wire form of a count question — exported so a test (or a host building
 * its own key) can see exactly what is asked, rather than inferring it.
 */
export function countQueryState(state: SearchCountState): SearchQueryState {
  const {
    anchor: _anchor,
    direction: _direction,
    sort: _sort,
    ...rest
  } = state;
  return {
    q: "",
    filters: {},
    ranges: {},
    ...rest,
    facets: "off",
    limit: SEARCH_COUNT_PAGE_SIZE,
  };
}

/**
 * A stable string for "is this the same question". Built from the same wire
 * object the query key is built from, with the keys sorted, so two states
 * assembled in a different order are one question and not two.
 */
function questionOf(state: SearchQueryState): string {
  const params = searchQueryParams(state);
  return JSON.stringify(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b))
  );
}

export function useSearchCount(
  state: SearchCountState,
  options: UseSearchCountOptions = {}
): LoadState<SearchCount> {
  const target = countQueryState(state);
  const question = questionOf(target);
  const debounceMs = options.debounceMs ?? SEARCH_COUNT_DEBOUNCE_MS;

  // The state the timer will settle ON when it fires — always the newest one,
  // not the one that started the timer. Typing "hond" then "honda" must ask
  // about "honda" once, never about "hond" late.
  const latest = useRef(target);
  latest.current = target;

  const [settled, setSettled] = useState<{
    readonly question: string;
    readonly state: SearchQueryState;
  }>(() => ({ question, state: target }));

  useEffect(() => {
    if (settled.question === question) return undefined;
    if (debounceMs <= 0) {
      setSettled({ question, state: latest.current });
      return undefined;
    }
    const handle = setTimeout(() => {
      setSettled({ question, state: latest.current });
    }, debounceMs);
    return () => {
      clearTimeout(handle);
    };
  }, [question, settled.question, debounceMs]);

  // `useSearchQuery` keeps the previous answer on screen while the next one is
  // in flight (`keepPreviousData`), which is what a counted button wants: the
  // number belongs to the last state we actually asked about, and it does not
  // blank between two of them.
  const query = useSearchQuery(settled.state, {
    enabled: options.enabled ?? true,
  });

  return mapLoad(loadStateFromQuery(query), (data) => ({
    count: data.count,
    kind: countKind(
      data.count,
      data.count_is_lower_bound,
      data.exact_total,
      parseDegradations(data.degraded)
    ),
  }));
}
