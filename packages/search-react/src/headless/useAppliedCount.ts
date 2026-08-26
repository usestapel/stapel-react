/**
 * How many results the page currently in cache holds, and whether that number
 * may be spoken as a number.
 *
 * The same trick as {@link useAppliedSort}: `enabled: false` on the key
 * `<SearchResults>` populates, so a control that wants to SAY the count
 * subscribes to the answer already on screen instead of issuing a second
 * search of its own. A filter sheet whose button reads "Show 25 results" is
 * the difference between committing to a change and guessing at one, and it
 * must not cost a request to know that.
 *
 * Not exported from the package entry: it is the shape `<SearchPage>` needs to
 * label one button, and a public hook would be a second, thinner way to ask
 * what `<SearchResults>` already answers in full.
 */
import { useSearchQuery } from "../model/queries.js";
import { countKind, parseDegradations } from "../state/degradations.js";
import type { SearchCountKind } from "../state/degradations.js";
import { useSearchState } from "./SearchStateProvider.js";

export interface AppliedCount {
  /** `null` when the engine cannot say — never rendered as `0`. */
  readonly count: number | null;
  readonly kind: SearchCountKind;
}

export function useAppliedCount(): AppliedCount {
  const { state } = useSearchState();
  const query = useSearchQuery(state, { enabled: false });
  const data = query.data;
  if (data === undefined) return { count: null, kind: "unknown" };
  return {
    count: data.count,
    kind: countKind(
      data.count,
      data.count_is_lower_bound,
      data.exact_total,
      parseDegradations(data.degraded)
    ),
  };
}
