/**
 * A SEARCH QUERY MUST BE ABLE TO REACH A CATEGORY.
 *
 * The complaint this closes is not "there is no picker" — the navigation model
 * deliberately has none (`catalog/tiles.ts`). It is that typing a category's
 * name into the search field lands a person in results and never in the
 * CATEGORY, so the one word they know about what they want cannot be used to
 * get there.
 *
 * This is the matching half, pure: rows in, ranked hits out. No React, no
 * fetch, no request per keystroke — the tree is already in memory (the whole
 * point of the delta-synced catalogue), and the hook that wraps this
 * (`headless/useCategorySearch.ts`) reads that same snapshot.
 *
 * ── What "matches" means, and why each half is here ────────────────────────
 *
 *  - The CAPTION, not the key. Category names arrive as translation KEYS
 *    (`catalog/labels.ts`), so a person typing "phones" is typing what they
 *    SEE — `Phones` — while the row says `category.phones`. Without the host's
 *    translator this matches the key, which is the honest fallback and is
 *    exactly what the picker already does.
 *  - The SLUG too. It is what the URL says and what an operator, a support
 *    agent and a bookmark all use.
 *  - Case- and diacritic-insensitive. "Moviles" and "Móviles" are the same
 *    word to the person typing, and so are the two spellings of a Russian
 *    category whose name carries a diaeresis that most keyboards omit. Which
 *    accents a visitor's keyboard produces is not this library's business.
 *
 * ── Why ranked, and why capped ─────────────────────────────────────────────
 *
 * Substring matching over a real catalogue is not a shortlist: this deployment
 * has 3444 rows and "a" matches most of them. Ranking puts the answer the
 * person meant first — an exact name beats a prefix beats a substring — and
 * the cap keeps the surface a LIST OF LINKS rather than a typeahead dropdown
 * over the whole tree, which is the thing the model rules out.
 */
import { categoryLabel, renderCategoryLabel } from "./labels.js";
import type { CategoryLabel } from "./labels.js";
import type { CategoryNode } from "./tree.js";

/**
 * How well a row answered the query. The ORDER of these three is the ranking
 * (see {@link MATCH_RANK}), which is why they are named rather than scored:
 * a number invites tuning nobody can explain.
 */
export type CategoryMatchKind = "exact" | "prefix" | "substring";

/** One category the query reached. */
export interface CategorySearchHit {
  readonly node: CategoryNode;
  /** The row's display string and what to do with it — `kind: "key"` means
   * run it through the host's `t`, exactly as everywhere else in this pair. */
  readonly label: CategoryLabel;
  /** The caption this hit was MATCHED against: translated when a translator
   * was supplied, the raw key otherwise. Handed back so a skin highlights the
   * same string the match was made on. */
  readonly caption: string;
  /** Why it matched, strongest first — see {@link CategoryMatchKind}. */
  readonly match: CategoryMatchKind;
  /** The storefront path for the hit, `basePath`-prefixed. */
  readonly href: string;
}

/**
 * How many hits a query may return.
 *
 * Small on purpose. This surface is a short list of category links above the
 * results, not a browsable index — a person scanning twenty entries is doing
 * the tree's job by hand, and a catalogue with 3444 rows can supply twenty
 * matches for almost any two letters.
 */
export const CATEGORY_SEARCH_LIMIT = 6;

/** Rank order. Lower sorts first. */
const MATCH_RANK: Readonly<Record<CategoryMatchKind, number>> = {
  exact: 0,
  prefix: 1,
  substring: 2,
};

/**
 * Case- and diacritic-insensitive comparison form.
 *
 * NFD splits a letter from its accents, the property escape drops the accents,
 * and `toLocaleLowerCase` folds case under the LABEL's own rules rather than
 * the invariant ones — a Turkish dotted capital must not become an `i` that
 * matches a different word.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

/** The strongest way `needle` occurs in `haystack`, or `null`. */
function matchOf(haystack: string, needle: string): CategoryMatchKind | null {
  if (haystack === "") return null;
  if (haystack === needle) return "exact";
  if (haystack.startsWith(needle)) return "prefix";
  if (haystack.includes(needle)) return "substring";
  return null;
}

/** The stronger of two answers, either of which may be absent. */
function strongest(
  a: CategoryMatchKind | null,
  b: CategoryMatchKind | null
): CategoryMatchKind | null {
  if (a === null) return b;
  if (b === null) return a;
  return MATCH_RANK[a] <= MATCH_RANK[b] ? a : b;
}

export interface RankCategoryMatchesOptions {
  /** Resolve a translation key to the caption a person can actually read.
   * Without it, matching runs against the raw key — see this file's header. */
  readonly translate?: (key: string) => string;
  /** Path prefix for a hit's link. Default `/c` — the spec's `/c/:slug`. */
  readonly basePath?: string;
  /** Cap on the number of hits. Default {@link CATEGORY_SEARCH_LIMIT}. */
  readonly limit?: number;
}

/**
 * Rank `nodes` against `query` and return the best few.
 *
 * `nodes` is expected in DISPLAY ORDER (what `flattenCategoryNodes` gives),
 * because that is the tie-break: within one match kind the catalogue's own
 * priority order decides, so two equally good hits do not swap places between
 * renders.
 *
 * A blank query returns nothing rather than the whole catalogue: "the person
 * has not asked yet" and "the person asked and everything matched" are
 * different, and only the first one is true here.
 */
export function rankCategoryMatches(
  nodes: readonly CategoryNode[],
  query: string,
  options: RankCategoryMatchesOptions = {}
): readonly CategorySearchHit[] {
  const needle = foldForSearch(query);
  if (needle === "") return [];

  const base = options.basePath ?? "/c";
  const limit = options.limit ?? CATEGORY_SEARCH_LIMIT;
  if (limit <= 0) return [];
  const translate = options.translate;

  const scored: { readonly hit: CategorySearchHit; readonly order: number }[] =
    [];

  nodes.forEach((node, order) => {
    const label = categoryLabel(node.category);
    const caption =
      translate === undefined ? label.value : renderCategoryLabel(label, translate);
    const match = strongest(
      matchOf(foldForSearch(caption), needle),
      matchOf(foldForSearch(node.category.slug), needle)
    );
    if (match === null) return;
    scored.push({
      hit: {
        node,
        label,
        caption,
        match,
        href: `${base}/${node.category.slug}`,
      },
      order,
    });
  });

  // Sorted on the ENTRY, carrying the traversal index, rather than relying on
  // `Array.prototype.sort` being stable for a comparator that returns 0: the
  // stability is specified, but the tie-break is a decision worth writing down
  // where the next reader can see it.
  scored.sort((a, b) => {
    const rank = MATCH_RANK[a.hit.match] - MATCH_RANK[b.hit.match];
    return rank !== 0 ? rank : a.order - b.order;
  });

  return scored.slice(0, limit).map((entry) => entry.hit);
}
