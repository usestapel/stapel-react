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
 *  - a new request ABORTS the one before it, and a resolved-but-superseded
 *    answer is dropped, because the network does not promise order;
 *  - opening is not typing: the first page is fetched immediately (a spinner
 *    that starts a quarter second after the click reads as a dead control),
 *    ONCE per (vocabulary, level, parent) — antd reports the dropdown as
 *    opening on every keystroke, so a naive `open()` is a request storm nobody
 *    can see in a screenshot;
 *  - a parent CHANGE empties the list: what is listed are the previous
 *    parent's children and must not stay pickable.
 *
 * The client is a PARAMETER, not a context read: this hook is one half of the
 * seam `@stapel/attributes-react` declares, and a host wires the client at its
 * composition root. Passing `null` is a supported state (the control draws its
 * unavailable notice) rather than a crash.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { VocabularyClient, VocabularyTerm } from "../client.js";

/** The pause after the last keystroke before a query goes to the server. Long
 * enough that typing a word is one request, short enough that it still feels
 * like the control answered. Mirrors the ref editors in attributes-react. */
export const TERM_SEARCH_DEBOUNCE_MS = 250;

export interface TermSearchOptions {
  readonly vocabulary: string;
  readonly level: string;
  /** Code of a term at the level above; narrows the page to its children.
   * `undefined` means the whole level. */
  readonly parent?: string | undefined;
  readonly debounceMs?: number;
}

export interface TermSearchState {
  readonly terms: readonly VocabularyTerm[];
  readonly loading: boolean;
  /** A person typed. Debounced and superseding. */
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
  const [terms, setTerms] = useState<readonly VocabularyTerm[]>([]);
  const [loading, setLoading] = useState(false);
  const inFlight = useRef<AbortController | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const asked = useRef(false);

  const run = useCallback(
    (query: string): void => {
      if (client === null || vocabulary.length === 0 || level.length === 0) return;
      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setLoading(true);
      client
        .search(vocabulary, level, query, parent, controller.signal)
        .then((found) => {
          if (controller.signal.aborted) return;
          setTerms(found);
          setLoading(false);
        })
        .catch(() => {
          // A superseded request is not a failure and must not clear the list
          // the CURRENT request is about to fill.
          if (controller.signal.aborted) return;
          setTerms([]);
          setLoading(false);
        });
    },
    [client, vocabulary, level, parent]
  );

  useEffect(() => {
    asked.current = false;
    setTerms([]);
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
      if (timer.current !== undefined) clearTimeout(timer.current);
      timer.current = setTimeout(() => run(query), debounceMs);
    },
    [run, debounceMs]
  );

  const open = useCallback((): void => {
    if (asked.current) return;
    asked.current = true;
    run("");
  }, [run]);

  return { terms, loading, search, open };
}
