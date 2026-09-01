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
 *
 * ── The box reaches the CATALOGUE, not only the titles ────────────────────
 *
 * stapel-search 0.7.0 answers `/suggest` with two halves. Until it did, typing
 * a word that names a section of the catalogue answered listing titles and
 * nothing else: on a live classified deployment the search field could not
 * reach a category at all, and the owner's own navigation canon rules out both
 * of the usual workarounds — a picker, and a client-side typeahead over the
 * whole tree.
 *
 * The server's answer is neither, and it carries the one thing a client-side
 * matcher can never have: the number of LIVE listings behind each destination,
 * computed as one aggregate over the index and equal to what `/query` reports
 * for the same category. That number is what tells "Menswear / Shorts" from
 * "Childrenswear / Shorts".
 *
 * Everything here is absent-safe. A server that predates 0.7.0 sends no
 * `categories` key, `suggestCategories` is empty, and the box behaves exactly
 * as it did — which is not a hypothetical: the key appeared mid-session on a
 * stand that was redeployed underneath a running client.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { loadStateFromQuery, mapLoad } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import {
  SUGGEST_DEGRADED_CATEGORIES,
  SUGGEST_DEGRADED_ROLLUP,
  suggestTerms,
} from "../api/types.js";
import type { SuggestAnswer, SuggestCategory } from "../api/types.js";
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
  /**
   * CATEGORY destinations for the typed prefix, server-ranked by live listing
   * count — the primary half of the answer (stapel-search 0.7.0).
   *
   * Empty on a server that sends no `categories` key, and empty when the
   * server could not reach a category provider: see
   * {@link SearchBoxBag.categoriesUnavailable} for why a surface must tell
   * those two apart from "nothing matched".
   *
   * A category with a count of `0` is already filtered out — see
   * {@link SearchBoxBag.categoryCountsUnknown}.
   */
  readonly categories: readonly SuggestCategory[];
  /**
   * The server HAS no category provider for this answer
   * (`degraded: ["category_suggestions"]`), so `categories` being empty says
   * nothing about the catalogue.
   *
   * A surface must render no group at all rather than an empty one: a heading
   * over nothing is the box telling a person the catalogue has no section by
   * that name, which is a claim this answer did not make. It is deliberately
   * NOT a banner either — the reader is mid-word, the terms half still
   * answers, and a provider being down is the operator's business, the same
   * ruling `degradationAudience` already applies to an engine shortfall.
   */
  readonly categoriesUnavailable: boolean;
  /**
   * The counts on {@link SearchBoxBag.categories} are not answers
   * (`degraded: ["category_rollup"]`): with no ancestry every stored path is
   * one segment long, so every count would read `0` for a mechanical reason.
   *
   * The rows are still real destinations and are still offered; a surface
   * prints the path and omits the number, because a catalogue of zeros is
   * worse than a list with no counts.
   */
  readonly categoryCountsUnknown: boolean;
  /** Characters a prefix needs before the index is asked. */
  readonly minSuggestChars: number;
  readonly maxLength: number;

  /** Type. Commits after {@link SEARCH_BOX_DEBOUNCE_MS} of quiet. */
  setDraft(next: string): void;
  /** Commit now — Enter, the Search button, or picking a suggestion. */
  submit(value?: string): void;
  /** Empty the box AND the search (an empty `q` is a valid browse). */
  clear(): void;
  /**
   * Follow a category suggestion: narrow the SERP to that section.
   *
   * Two decisions, both load-bearing.
   *
   * The `category` parameter is set to the server's own
   * {@link SuggestCategory.category} string, VERBATIM. The server joins the
   * ancestry itself precisely so a client cannot invent a different join and
   * silently miss, so nothing here rebuilds it from the path or the slug.
   *
   * The typed text is CLEARED in the same write. The row promised a count —
   * "Menswear / Shorts, 1 240 listings" — and that number is the
   * section's, not the section's intersected with a title search for the word
   * that found it. Keeping `q` would land a person on strictly fewer results
   * than the row they tapped had just quoted, which is the row lying about
   * where it goes. One `patch` call, so it is also one history entry: Back
   * returns to the search the person typed.
   */
  chooseCategory(category: SuggestCategory): void;
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

/** The same, for the categories half. */
const NO_CATEGORIES: readonly SuggestCategory[] = [];

/** Does this answer name a shortfall? Absent-safe on every older server. */
function degradedWith(answer: SuggestAnswer | undefined, literal: string): boolean {
  return answer?.degraded?.includes(literal) === true;
}

/**
 * The destinations worth offering out of one answer.
 *
 * **Every category the server ranked, in the order it ranked them.** Until
 * 0.15 this dropped every row whose count was `0`, on the reasoning that an
 * empty section is a dead end dressed as a destination. That reasoning holds
 * for a stocked board and inverts on a young one, which is what the live
 * measurement showed: 3036 leaves, ~100 listings, so 2924 leaves read zero
 * and the filter deleted the answer. Typing a word with six real sections behind it in
 * the catalogue produced NO PANEL AT ALL, and so did two other everyday
 * words; the type-ahead told a buyer those sections do not exist, about
 * sections that do. A catalogue you cannot navigate until somebody stocks it
 * is worse than one that admits a section is empty.
 *
 * The server already ranks stocked sections above empty ones
 * (`stapel-search` 0.8: stock, then match quality, then count) so the useful
 * rows still come first, and every row carries its own `count` for the
 * surface to print honestly — "0 listings" is a fact a person can act on,
 * an absent panel is not. Nothing is dropped here; a surface that wants a
 * shorter list slices it.
 */
export function offerableCategories(
  answer: SuggestAnswer | undefined
): readonly SuggestCategory[] {
  const categories = answer?.categories;
  if (categories === undefined || categories.length === 0) return NO_CATEGORIES;
  return categories;
}

export function useSearchBox(options: UseSearchBoxOptions = {}): SearchBoxBag {
  const { state, setText, patch } = useSearchState();
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

  const suggestState = mapLoad(loadStateFromQuery(suggest), suggestTerms);

  // The READY answer only. A category row is a navigation control, and one
  // rendered out of a stale answer would send a person somewhere the current
  // prefix never named.
  const answer = suggest.data;
  const categories = offerableCategories(answer);

  const chooseCategory = (category: SuggestCategory): void => {
    setDraftState("");
    cancel();
    // One write, so one history entry — see `SearchBoxBag.chooseCategory` for
    // why the text goes with it.
    patch({ q: "", category: category.category });
  };

  return {
    draft,
    committed,
    pending: draft !== committed,
    suggestions: suggestState.status === "ready" ? suggestState.data : NO_SUGGESTIONS,
    suggestState,
    suggestLoading: suggest.isLoading && suggest.fetchStatus === "fetching",
    categories,
    categoriesUnavailable: degradedWith(answer, SUGGEST_DEGRADED_CATEGORIES),
    categoryCountsUnknown: degradedWith(answer, SUGGEST_DEGRADED_ROLLUP),
    minSuggestChars: SUGGEST_MIN_CHARS,
    maxLength: SEARCH_QUERY_MAX_CHARS,
    setDraft,
    submit,
    clear,
    chooseCategory,
  };
}
