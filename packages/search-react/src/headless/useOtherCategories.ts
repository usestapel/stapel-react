/**
 * "The same query, in another section" — the categories THIS answer is made
 * of, read out of the answer that drew the cards.
 *
 * ## What it replaces
 *
 * A storefront drew this as a full-width block under the results: one row per
 * category, fetched from `/suggest` AFTER the page had settled, so a tall
 * panel appeared a beat late and pushed everything a person was already
 * reading. Both halves were avoidable. The block was tall where one line
 * says the same thing, and the request was a second ask for something the
 * page already had: `/query` answers with `facet_meta.categories` — `{path,
 * count}` for every category the candidate set contains — and that is
 * exactly the list the block was printing.
 *
 * So the rows come from the SEARCH response. No request of this hook's own
 * while there are results, and therefore nothing to arrive late.
 *
 * ## The one case that DOES earn a request
 *
 * An empty result set has no candidates, so `facet_meta.categories` is empty
 * too — and that is precisely the screen where "this word exists in these
 * sections" is worth the most. There, and only there, `/suggest` is asked.
 * The bag says so through {@link OtherCategoriesBag.reserving}, so a surface
 * can hold the row's height from the first frame instead of letting the
 * answer push the page a second time.
 *
 * ## Names come from the cache, not from a request
 *
 * `facet_meta.categories` carries id PATHS and counts, never names — the
 * catalogue belongs to `categories-react`. Three sources are tried, in order:
 *
 *  1. the host's resolver (a surface prop), which is the only one that can
 *     name an id path with certainty;
 *  2. the `/suggest` answer ALREADY IN THE QUERY CACHE — the type-ahead asked
 *     about this same word a keystroke earlier, and its rows carry the
 *     server's own names. `useSuggest` with `enabled: false` hands back a
 *     cached answer and fires nothing, so this costs no request;
 *  3. the path's last segment, when it is a slug rather than a number.
 *
 * A row none of the three can name is DROPPED rather than printed as "163" —
 * the same rule `categoryLeaf` states for the category chip.
 */
import type { SearchResponse, SuggestCategory } from "../api/types.js";
import { useSearchQuery, useSuggest } from "../model/queries.js";
import { offerableCategories } from "./useSearchBox.js";
import { useSearchState } from "./SearchStateProvider.js";

/** How many entries the line prints before it folds the rest. */
export const OTHER_CATEGORIES_LIMIT = 8;

/**
 * The phone's cap.
 *
 * Half the desktop's, because the requirement is a LINE and at 390px eight
 * entries are not one — they are the block this replaces, wearing a comma.
 * Four short section names plus the fold marker are the two rows a phone can
 * spend on a navigation aid above a list of cards.
 */
export const OTHER_CATEGORIES_PHONE_LIMIT = 4;

/** One category the current answer reached, with the count that answer gives it. */
export interface OtherCategoryRow {
  /** The slash-joined id path — the same string the `category` filter takes,
   * so narrowing to it needs no translation and no tree. */
  readonly category: string;
  /** Documents matching THIS query that live there. Scoped to the query, which
   * is why narrowing the search is the honest destination and the bare
   * category feed is not: the feed would show a different number. */
  readonly count: number;
  /** The server's own name, when this row came from `/suggest` or when a
   * cached suggest answer named the same path. */
  readonly name?: string;
  /** Display names root→leaf, when the server sent them. */
  readonly path?: readonly string[];
}

export interface OtherCategoriesBag {
  /** Every row, uncapped and in the order the line should print them. Capping
   * is a decision about the SURFACE (a phone takes fewer), so it is not made
   * here. */
  readonly rows: readonly OtherCategoryRow[];
  /**
   * Where the rows came from. `"results"` — the search response itself, drawn
   * in the same frame as the cards. `"suggest"` — the empty-result path, the
   * only one with a request behind it. `"none"` — nothing to offer.
   */
  readonly source: "results" | "suggest" | "none";
  /**
   * The empty-result path is active, so a row is coming from a request that
   * has not landed (or landed empty). A surface keeps the height either way:
   * space reserved from the first frame is space nothing can push.
   */
  readonly reserving: boolean;
  /** That request is in flight right now. */
  readonly pending: boolean;
}

const NO_ROWS: readonly OtherCategoryRow[] = [];

/** The path's last segment, when it names something — never a bare id. */
export function otherCategoryLeaf(category: string): string | undefined {
  const parts = category.split("/").filter((part) => part.length > 0);
  const leaf = parts[parts.length - 1];
  if (leaf === undefined || /^\d+$/.test(leaf)) return undefined;
  return leaf;
}

/** The rows the ANSWER carries, busiest first and without the section the
 * search is already in. */
function rowsFromResponse(
  answer: SearchResponse | undefined,
  applied: string | undefined,
  named: ReadonlyMap<string, SuggestCategory>
): readonly OtherCategoryRow[] {
  const meta = answer?.facet_meta.categories ?? [];
  const rows = meta
    // "Other" than the one the search is in. Descendants stay: narrowing from
    // a branch to one of its leaves is a different section and the move this
    // line exists for.
    .filter((row) => row.category !== applied)
    .map((row) => {
      const match = named.get(row.category);
      return {
        category: row.category,
        count: row.count,
        ...(match !== undefined ? { name: match.name, path: match.path } : {}),
      };
    });
  // The server documents "busiest first" and the cap has to take the busiest
  // eight; asserting the order here is cheaper than trusting it and being
  // wrong about which eight a person sees.
  return [...rows].sort((a, b) =>
    b.count === a.count ? a.category.localeCompare(b.category) : b.count - a.count
  );
}

export function useOtherCategories(
  options: { readonly enabled?: boolean } = {}
): OtherCategoriesBag {
  const { state } = useSearchState();
  const enabled = options.enabled ?? true;

  // The SAME query the results pane runs: identical key, identical cache
  // entry, no second request. This hook can therefore be mounted anywhere
  // under the provider without the envelope having to be threaded to it.
  const query = useSearchQuery(state, { enabled });
  const answer = query.data;

  // Ready AND empty. `answer === undefined` is "still loading", which is not
  // an empty result and must not spend a request.
  const resultsEmpty = enabled && answer !== undefined && answer.items.length === 0;

  // `enabled: false` still returns whatever the box already put in the cache
  // and asks nothing — which is how a page WITH results gets the server's
  // names for free. A page WITHOUT results turns the same hook into the one
  // request this feature ever makes.
  const suggest = useSuggest({ type: state.type, q: state.q, enabled: resultsEmpty });
  // Through the pair's own reader, which is where "this server sent no
  // categories key at all" is already distinguished from "nothing matched".
  const suggested = offerableCategories(suggest.data);
  const named = new Map(suggested.map((row) => [row.category, row]));

  const fromResults = rowsFromResponse(answer, state.category, named);

  const pending = resultsEmpty && suggest.isLoading && suggest.fetchStatus === "fetching";

  if (fromResults.length > 0) {
    return { rows: fromResults, source: "results", reserving: false, pending: false };
  }

  if (resultsEmpty) {
    // The server's rank order is kept as sent: `/suggest` ranks by match grade
    // and stock before count, and re-sorting by count here would throw that
    // away for a number that is not what ranked them.
    const rows = suggested
      .filter((row) => row.category !== state.category)
      .map((row) => ({
        category: row.category,
        count: row.count,
        name: row.name,
        path: row.path,
      }));
    return {
      rows,
      source: rows.length > 0 ? "suggest" : "none",
      reserving: true,
      pending,
    };
  }

  return { rows: NO_ROWS, source: "none", reserving: false, pending: false };
}
