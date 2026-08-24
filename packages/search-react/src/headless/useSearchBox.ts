/**
 * The query box, headless — the state machine behind `<SearchBox>`.
 *
 * ── The one legitimate second copy of the state ────────────────────────────
 *
 * This pair's rule is that the URL is the state and no component keeps a copy.
 * A text input is the single exception the rule has to make: what a person has
 * TYPED is not yet what they have SEARCHED for, and committing every keystroke
 * to the URL would make the address bar (and the request, and the query cache)
 * chase the keyboard. So the draft lives here, for as long as it takes to stop
 * typing, and the URL is still the only place a SEARCH is recorded.
 *
 * Two properties keep that honest:
 *
 *  1. **The URL wins whenever it moves on its own.** Back, a shared link
 *     opening, a host calling `setText` elsewhere — the draft is reset to the
 *     committed `q`. The box can never show a word the results are not about.
 *  2. **Committing REPLACES the history entry** (`setText` already does), so a
 *     ten-letter word is one entry and Back still removes the last FILTER
 *     rather than the last letter.
 *
 * The suggestion list is asked for the DEBOUNCED prefix, not the draft — one
 * request per pause, not per keystroke, on an endpoint the backend throttles.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import { useSearchState } from "./SearchStateProvider.js";
import { useSuggest } from "../model/queries.js";
import {
  SEARCH_BOX_DEBOUNCE_MS,
  SEARCH_BOX_SUGGEST_DEBOUNCE_MS,
  SEARCH_QUERY_MAX_CHARS,
  SUGGEST_MIN_CHARS,
} from "../state/limits.js";

/** What a query box needs to read and move the search text. */
export interface SearchBoxBag {
  /** What is in the input right now. */
  readonly draft: string;
  /** What the URL — and therefore the results — is about. */
  readonly committed: string;
  /** The draft has not reached the URL yet (a search is about to run). */
  readonly pending: boolean;
  /**
   * Title prefixes for the typeahead — the READY answer only.
   *
   * A typeahead has no surface for "we could not fetch suggestions": the box
   * must stay typeable and a person is mid-word. So a failed or in-flight
   * suggest shows nothing, and the three answers stay distinguishable in
   * {@link SearchBoxBag.suggestState} for a skin that wants to say more.
   */
  readonly suggestions: readonly string[];
  /** The suggest read as a state, unflattened. */
  readonly suggestState: LoadState<readonly string[]>;
  /** A suggestion request is in flight for a prefix nothing is shown for yet. */
  readonly suggestLoading: boolean;
  /** Characters a prefix needs before the index is asked. */
  readonly minSuggestChars: number;
  readonly maxLength: number;

  /** Type. Commits after {@link SEARCH_BOX_DEBOUNCE_MS} of quiet. */
  setDraft(next: string): void;
  /** Commit now — Enter, the Search button, or picking a suggestion. */
  submit(value?: string): void;
  /** Empty the box AND the search (an empty `q` is a valid browse). */
  clear(): void;
}

export interface UseSearchBoxOptions {
  readonly debounceMs?: number;
  /** Ask the index for prefixes. Default `true`. */
  readonly suggest?: boolean;
  /** Quiet time before the index is asked (default
   * {@link SEARCH_BOX_SUGGEST_DEBOUNCE_MS}). */
  readonly suggestDebounceMs?: number;
  /** How many suggestions to ask for (backend clamps to 25). Default 8. */
  readonly suggestLimit?: number;
}

/** One frozen empty list, so a render with no suggestions is a stable value. */
const NO_SUGGESTIONS: readonly string[] = [];

export function useSearchBox(options: UseSearchBoxOptions = {}): SearchBoxBag {
  const { state, setText } = useSearchState();
  const committed = state.q;
  const debounceMs = options.debounceMs ?? SEARCH_BOX_DEBOUNCE_MS;

  const [draft, setDraftState] = useState(committed);
  // What the URL said the last time we looked. When it changes underneath us
  // — Back, a shared link, a host control — the draft follows it; when it
  // changes BECAUSE we committed, `draft === committed` already and the reset
  // is a no-op.
  const lastCommitted = useRef(committed);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (lastCommitted.current !== committed) {
    lastCommitted.current = committed;
    if (draft !== committed) setDraftState(committed);
  }

  const cancel = useCallback((): void => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  // A pending commit must not fire into an unmounted tree, and a box that is
  // unmounted mid-word has not searched for that word.
  useEffect(() => cancel, [cancel]);

  const commit = useCallback(
    (value: string): void => {
      cancel();
      if (value !== committed) setText(value);
    },
    [cancel, committed, setText]
  );

  const setDraft = useCallback(
    (next: string): void => {
      const clipped = next.slice(0, SEARCH_QUERY_MAX_CHARS);
      setDraftState(clipped);
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        if (clipped !== committed) setText(clipped);
      }, debounceMs);
    },
    [cancel, committed, debounceMs, setText]
  );

  const submit = useCallback(
    (value?: string): void => {
      const next = (value ?? draft).slice(0, SEARCH_QUERY_MAX_CHARS);
      setDraftState(next);
      commit(next);
    },
    [commit, draft]
  );

  const clear = useCallback((): void => {
    setDraftState("");
    commit("");
  }, [commit]);

  // The index is asked about the SETTLED prefix, never the keystroke: one
  // request per pause on an endpoint the backend throttles. `useSuggest` then
  // refuses anything below `SUGGEST_MIN_CHARS` and keys the rest by prefix, so
  // backspacing to a prefix already asked about costs nothing.
  const suggestDebounceMs =
    options.suggestDebounceMs ?? SEARCH_BOX_SUGGEST_DEBOUNCE_MS;
  const [suggestPrefix, setSuggestPrefix] = useState(committed);
  useEffect(() => {
    const handle = setTimeout(() => {
      setSuggestPrefix(draft);
    }, suggestDebounceMs);
    return () => {
      clearTimeout(handle);
    };
  }, [draft, suggestDebounceMs]);

  const suggest = useSuggest({
    type: state.type,
    q: suggestPrefix,
    ...(options.suggestLimit !== undefined ? { limit: options.suggestLimit } : {}),
    enabled: options.suggest !== false,
  });

  const suggestState = mapLoad(
    loadStateFromQuery(suggest),
    (data) => data.items as readonly string[]
  );

  return {
    draft,
    committed,
    pending: draft !== committed,
    suggestions: suggestState.status === "ready" ? suggestState.data : NO_SUGGESTIONS,
    suggestState,
    suggestLoading: suggest.isLoading && suggest.fetchStatus === "fetching",
    minSuggestChars: SUGGEST_MIN_CHARS,
    maxLength: SEARCH_QUERY_MAX_CHARS,
    setDraft,
    submit,
    clear,
  };
}
