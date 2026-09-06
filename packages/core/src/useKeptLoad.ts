import { useEffect, useRef } from "react";
import { keepPreviousLoad } from "./loadState.js";
import type { KeepPreviousOption, LoadState } from "./loadState.js";

/**
 * The memory behind {@link KeepPreviousOption.keepPrevious}: the last data a
 * screen actually showed, held while the next answer is in flight.
 *
 * `loadStateFromQuery(query, { keepPrevious: true })` covers the case TanStack
 * itself remembers — ONE query, configured with
 * `placeholderData: keepPreviousData`. This covers the other two, which is
 * most screens:
 *
 *  * a state composed of SEVERAL reads (a category page is gated on `GET
 *    {id}/` **and** `GET {id}/children/`; the composed answer is `loading`
 *    the moment either is), and
 *  * a state built from hooks that are shared with surfaces which must NOT
 *    see a stale rung — a cascade drawing the previous level's children under
 *    the new parent is a wrong page, not a refreshing one. Turning
 *    `placeholderData` on inside the hook would hand that behaviour to every
 *    caller of it; this hands it to the one screen that asked.
 *
 * The memory is a ref written in an EFFECT, deliberately: during the render
 * where the key has just changed, the ref still holds the answer that is on
 * the glass — which is the answer this hook must return. Nothing is written
 * during render, so the hook is safe to re-run and cannot loop on a `data`
 * whose identity changes every render (a composed object, which is exactly
 * what a multi-read screen builds).
 *
 * ```tsx
 * const state = useKeptLoad(composed, { keepPrevious: props.keepPrevious });
 * <LoadBoundary state={state}>{(page) => <Page {...page} />}</LoadBoundary>
 * ```
 *
 * `keepPrevious` is an OPTION rather than "don't call the hook", because a
 * hook cannot be called conditionally: a host that wants the old behaviour
 * passes `false` and gets `state` back untouched, refreshing flag and all
 * absent.
 */
export function useKeptLoad<T>(
  state: LoadState<T>,
  options?: KeepPreviousOption
): LoadState<T> {
  const previous = useRef<T | undefined>(undefined);
  const keep = options?.keepPrevious === true;
  const kept = keep ? keepPreviousLoad(state, previous.current) : state;
  useEffect(() => {
    if (state.status === "ready") previous.current = state.data;
  }, [state]);
  return kept;
}
