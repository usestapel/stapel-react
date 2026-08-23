/**
 * The sort the SERVER applied to the page currently in cache.
 *
 * A search with no `sort` in its URL is still sorted — the backend picks
 * relevance when there is text and newest when there is not, and says so in
 * the envelope's `sort`. A control that showed nothing in that case was not
 * being cautious: it was hiding the answer the response already carried, and
 * the live /s page rendered a sort box with no value while the results were
 * plainly in an order.
 *
 * `enabled: false` is the whole trick. The key is the one `<SearchResults>`
 * populates, so this subscribes to the SAME cache entry and re-renders when
 * the page lands — but it never issues a request of its own, which is what
 * keeps a control from turning into a second search (including on a pane
 * mounted with `enabled={false}`, where a request would be exactly the thing
 * the host switched off).
 */
import { useSearchQuery } from "../model/queries.js";
import { useSearchState } from "./SearchStateProvider.js";

export function useAppliedSort(): string | undefined {
  const { state } = useSearchState();
  const query = useSearchQuery(state, { enabled: false });
  return query.data?.sort;
}
