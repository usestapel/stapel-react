/**
 * `useTermSearch` — a typeahead over ONE vocabulary level.
 *
 * The level is the wrong size to hold (529 phone vendors is fine, 14 962
 * models is not), so the options ARE the answer to the current query and the
 * hook's whole job is to make sure the answer on screen belongs to the query
 * on screen:
 *
 *  - a keystroke DEBOUNCES (250 ms by default) — one request per pause, not
 *    per character;
 *  - a keystroke ALSO blanks the list, on the keystroke: see below;
 *  - every request carries its query, and a response is dropped unless that
 *    query is still the one in the box — the abort is kept as well, but it is
 *    a courtesy to the network and never the correctness boundary;
 *  - opening is not typing: the first page is fetched immediately (a spinner
 *    that starts a quarter second after the click reads as a dead control),
 *    ONCE per (vocabulary, level, parent) — antd reports the dropdown as
 *    opening on every keystroke, so a naive `open()` is a request storm nobody
 *    can see in a screenshot;
 *  - a parent CHANGE empties the list: what is listed are the previous
 *    parent's children and must not stay pickable.
 *
 * ── Why the list blanks on the keystroke (defect C23) ──────────────────────
 *
 * This hook used to abort the previous request and leave the previous ANSWER
 * on screen until a new one landed. Measured on the live stand that was 400 to
 * 640 ms per field — the debounce plus the round trip — during which the
 * dropdown listed the previous query's terms and every row was pickable. A
 * person who types three letters and taps the first row wrote somebody else's
 * code into the field, silently.
 *
 * So the hook holds the query the terms ANSWER beside the terms, and reports
 * them only while it equals the query the box holds. {@link
 * TermSearchState.matched} is that comparison, and a control uses it to make
 * whatever is still on screen unpickable.
 *
 * The client is a PARAMETER, not a context read: this hook is one half of the
 * seam `@stapel/attributes-react` declares, and a host wires the client at its
 * composition root. Passing `null` is a supported state (the control draws its
 * unavailable notice) rather than a crash.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  VocabularyClient,
  VocabularyTerm,
  VocabularyTermAnswer,
} from "../client.js";

/** The pause after the last keystroke before a query goes to the server. Long
 * enough that typing a word is one request, short enough that it still feels
 * like the control answered. Mirrors the ref editors in attributes-react. */
export const TERM_SEARCH_DEBOUNCE_MS = 250;

/** The list a control shows when it has no answer to the question in its box.
 * One frozen instance, so "no answer" is a stable identity across renders. */
const EMPTY_TERMS: readonly VocabularyTerm[] = Object.freeze([]);

/** How many rows at the HEAD of a list carry `band: "popular"`. */
function leadingPopular(terms: readonly VocabularyTerm[]): number {
  let count = 0;
  for (const term of terms) {
    if (term.band !== "popular") break;
    count += 1;
  }
  return count;
}

/**
 * A search answer as the rows plus the size of their popular band.
 *
 * **The page's `popular_count` is the authority and a row's own `band` is only
 * the fallback.** The server ranks a `q` search by prefix FIRST and the band
 * second, so a page can legitimately read
 * `[popular+prefix, all+prefix, popular, all]` — two rows tagged `popular` of
 * which only the first LEADS. The band is therefore a SLICE at the count, and
 * never a filter on the tag: filtering would lift row three over row two and
 * destroy the ranking the server just computed.
 *
 * With no count (an array answer, a service older than 0.2.0) the fallback is
 * the LEADING RUN, whose worst case is zero — one plain list.
 */
function answerOf(answer: VocabularyTermAnswer): {
  readonly terms: readonly VocabularyTerm[];
  readonly popularCount: number;
} {
  if (Array.isArray(answer)) {
    const rows = answer as readonly VocabularyTerm[];
    return { terms: rows, popularCount: leadingPopular(rows) };
  }
  const page = answer as { results?: readonly VocabularyTerm[]; popular_count?: number };
  const terms = Array.isArray(page.results) ? page.results : EMPTY_TERMS;
  const declared = page.popular_count;
  if (declared === undefined) return { terms, popularCount: leadingPopular(terms) };
  if (!Number.isInteger(declared) || declared <= 0) return { terms, popularCount: 0 };
  return { terms, popularCount: Math.min(declared, terms.length) };
}

export interface TermSearchOptions {
  readonly vocabulary: string;
  readonly level: string;
  /** Code of a term at the level above; narrows the page to its children.
   * `undefined` means the whole level. */
  readonly parent?: string | undefined;
  readonly debounceMs?: number;
}

export interface TermSearchState {
  /** The terms that answer the query in the box — empty while they would not.
   * In the server's own order, popular band first; never re-sorted here. */
  readonly terms: readonly VocabularyTerm[];
  /**
   * How many LEADING rows of {@link terms} are in the popular band — the
   * endpoint's `popular_count`, or the leading run of `band: "popular"` when a
   * client answers with a bare array.
   *
   * A control draws its separator by SLICING `terms` here; filtering on `band`
   * would reorder a `q` search's ranking. `0` means "draw one plain list".
   */
  readonly popularCount: number;
  readonly loading: boolean;
  /**
   * Does {@link terms} answer the query the box holds?
   *
   * `false` means a newer query is in flight and nothing on screen is an
   * answer to it. A control MUST make its rows unpickable while this is false;
   * that is the whole of defect C23.
   */
  readonly matched: boolean;
  /** A person typed. Debounced, superseding, and it blanks the list at once. */
  search: (query: string) => void;
  /** A dropdown opened. Fetches the first page immediately, once per
   * (vocabulary, level, parent). */
  open: () => void;
}

export function useTermSearch(
  client: VocabularyClient | null,
  options: TermSearchOptions
): TermSearchState {
  const { vocabulary, level, parent, debounceMs = TERM_SEARCH_DEBOUNCE_MS } = options;
  // The answer AND the question it answers, as one value — two states could be
  // written in either order and the pair would be briefly inconsistent, which
  // is the whole defect in miniature.
  const [answer, setAnswer] = useState<{
    readonly query: string;
    readonly terms: readonly VocabularyTerm[];
    readonly popularCount: number;
  } | null>(null);
  // What the box holds right now. `null` is "nothing has been asked for yet",
  // which is neither loading nor answered.
  const [wanted, setWanted] = useState<string | null>(null);
  // The same value, readable from a promise callback.
  const current = useRef<string | null>(null);
  const inFlight = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const asked = useRef(false);

  const run = useCallback(
    (query: string): void => {
      if (client === null || vocabulary.length === 0 || level.length === 0) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      client
        .search(vocabulary, level, query, parent, controller.signal)
        .then((found) => {
          // Superseded, whether or not the client honoured the signal.
          if (controller.signal.aborted || current.current !== query) return;
          setAnswer({ query, ...answerOf(found) });
        })
        .catch(() => {
          // A failure ANSWERS with nothing rather than freezing the last list:
          // stale options next to a fresh query are pickable, and the code
          // that gets picked may not be in the level at all.
          if (controller.signal.aborted || current.current !== query) return;
          setAnswer({ query, terms: EMPTY_TERMS, popularCount: 0 });
        });
    },
    [client, vocabulary, level, parent]
  );

  useEffect(() => {
    asked.current = false;
    current.current = null;
    inFlight.current?.abort();
    setAnswer(null);
    setWanted(null);
  }, [client, vocabulary, level, parent]);

  useEffect(
    () => () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    []
  );

  const search = useCallback(
    (query: string): void => {
      asked.current = true;
      // BEFORE the debounce, not after it: the list stopped being the answer
      // the moment the query changed, and the 250 ms it would otherwise stay
      // on screen is most of the measured stale window.
      current.current = query;
      setWanted(query);
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        run(query);
      }, debounceMs);
    },
    [run, debounceMs]
  );

  const open = useCallback((): void => {
    if (asked.current) return;
    asked.current = true;
    current.current = "";
    setWanted("");
    run("");
  }, [run]);

  const matched = wanted !== null && answer !== null && answer.query === wanted;
  return {
    terms: matched && answer !== null ? answer.terms : EMPTY_TERMS,
    // A list that is not the answer has no band either: the count belongs to
    // the rows it was measured against.
    popularCount: matched && answer !== null ? answer.popularCount : 0,
    loading: wanted !== null && !matched,
    matched,
    search,
    open,
  };
}
