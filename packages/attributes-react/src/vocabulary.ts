/**
 * The VOCABULARY seam — how a `ref_select` reaches fourteen thousand phone
 * models without any of them being in the category schema.
 *
 * `stapel-attributes` 0.5.0 added two vocabulary-backed value types whose
 * config carries a POINTER (`optionsRef {vocabulary, level, parentFeature?}`)
 * rather than an options list, because the lists are the wrong size to inline:
 * a real phone catalogue is 529 vendors → 14 962 models, and a car
 * catalogue 107 049 modifications. `GET /categories/{id}/features` sends
 * the pointer as-is and never inlines a vocabulary.
 *
 * So the terms arrive over a SECOND wire, and this file is the shape of it.
 *
 * ── Why the interface lives here and the implementation does not ───────────
 *
 * `@stapel/vocabularies-react` implements this interface **structurally** —
 * it does not import it, and this package does not import that one. L2 pairs
 * never depend on each other, and an L0 vocabulary of types is exactly what
 * makes the two independently releasable: the container (a storefront) calls
 * `createVocabularyClient({baseUrl})` from the pair and hands the result to
 * {@link VocabularyClientProvider} here.
 *
 * A host with no vocabularies module at all supplies its own two functions —
 * an in-memory table, an existing search endpoint — and every ref editor
 * works. That is the whole reason this is two methods and not a client.
 *
 * ── No provider is a LOUD state, not a quiet one ───────────────────────────
 *
 * `useVocabularyClient()` returns `null` rather than throwing, and the ref
 * editors draw the same unsupported notice a missing editor draws, with the
 * submit blocked through the SAME channel (`unsupportedTypes` /
 * `unsupportedTypeGate`). A ref field drawn as an empty dropdown would be a
 * mandatory attribute a person cannot answer and is not told about.
 */
import { createContext, useContext } from "react";
import type { Context, Provider } from "react";

/** One term of a vocabulary level — the row `GET /vocabularies/{slug}/terms/`
 * returns. `has_children` and `band` are snake_case/wire-spelled because they
 * are the wire's own names. */
export interface VocabularyTerm {
  readonly code: string;
  readonly label: string;
  readonly has_children?: boolean;
  /**
   * Which band this row belongs to (`stapel-vocabularies` 0.2.0): `popular`
   * for the short band a level opens on, `all` for the alphabet under it.
   *
   * Optional, because a level nobody has ranked and a service older than
   * 0.2.0 both send nothing. It is a HINT and not the boundary — see
   * {@link termPageOf} for why the page's `popular_count` outranks it.
   */
  readonly band?: "popular" | "all";
}

/**
 * One page of a level, as the terms endpoint answers it.
 *
 * The seam takes this OR a bare array, because the page carries a fact no row
 * can: where the popular band ends. A host with an in-memory table keeps
 * returning an array and gets today's plain list.
 */
export interface VocabularyTermPage {
  readonly results: readonly VocabularyTerm[];
  /**
   * How many LEADING rows of {@link results} are in the popular band — the
   * server's own word for the boundary. `0` means this page has none.
   */
  readonly popular_count?: number;
  /** Rows matching the query before paging. Unread here; carried so a host
   * can hand the endpoint's body through unchanged. */
  readonly total?: number;
}

/** What a {@link VocabularyClient.search} may answer with. */
export type VocabularyTermAnswer = readonly VocabularyTerm[] | VocabularyTermPage;

/** Is this row tagged as part of the popular band? Strictly the wire's own
 * literal, so an unknown value is "no" rather than a promotion. */
export function isPopularTerm(term: VocabularyTerm): boolean {
  return term.band === "popular";
}

/** A whole number in `[0, max]`, or 0 — the shape a count off the wire has to
 * be forced into before it can index anything. */
function boundedCount(value: unknown, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return 0;
  return Math.min(value, max);
}

/**
 * A search answer, normalized to the rows and the size of their popular band.
 *
 * **`popular_count` is the authority, and the rows' own `band` is only a
 * fallback.** The server ranks a `q` search by prefix FIRST and the band
 * second, so a page can legitimately read
 * `[popular+prefix, all+prefix, popular, all]` — four rows of which two are
 * tagged `popular` and only the first LEADS. Filtering on the tag there would
 * lift row three over row two and destroy the typeahead ranking, which is
 * exactly why the endpoint publishes the count and tells clients not to scan.
 *
 * When the count is absent (an array answer, a service older than 0.2.0) the
 * fallback is the LEADING RUN of `band === "popular"` — the server's own
 * algorithm, whose worst case is a run of zero and therefore one plain list.
 * It can under-report a band; it can never reorder one.
 */
export function termPageOf(answer: VocabularyTermAnswer): {
  readonly terms: readonly VocabularyTerm[];
  readonly popularCount: number;
} {
  if (Array.isArray(answer)) {
    return { terms: answer, popularCount: leadingPopular(answer) };
  }
  const page = answer as VocabularyTermPage;
  const terms = Array.isArray(page.results) ? page.results : [];
  const declared = page.popular_count;
  return {
    terms,
    popularCount:
      declared === undefined
        ? leadingPopular(terms)
        : boundedCount(declared, terms.length),
  };
}

/** How many rows at the HEAD of a list carry `band: "popular"`. */
function leadingPopular(terms: readonly VocabularyTerm[]): number {
  let count = 0;
  for (const term of terms) {
    if (!isPopularTerm(term)) break;
    count += 1;
  }
  return count;
}

/**
 * A level's rows cut into the two bands a picker draws — by SLICE, never by
 * filter, so neither band's order is this file's opinion.
 *
 * `popular` is empty whenever the count is 0, which is the signal a caller
 * reads as "draw one plain list".
 */
export function splitPopularBand(
  terms: readonly VocabularyTerm[],
  popularCount: number
): {
  readonly popular: readonly VocabularyTerm[];
  readonly rest: readonly VocabularyTerm[];
} {
  const at = boundedCount(popularCount, terms.length);
  return { popular: terms.slice(0, at), rest: terms.slice(at) };
}

/**
 * The two reads a ref editor needs. Both are `async` and neither is a query:
 * caching, retries and deduplication belong to whatever implements this
 * (vocabularies-react uses the fleet's query layer), not to the seam.
 */
export interface VocabularyClient {
  /**
   * Terms of one level, narrowed by a search string and — when the feature
   * declares a `parentFeature` that currently holds a value — by the parent
   * term's code. An empty `query` means "the first page of this level", which
   * is what a dropdown opens on.
   *
   * `signal` is honoured: the editors supersede an in-flight search when a
   * person keeps typing, and an implementation that abandons the request early
   * saves the round trip.
   *
   * It is a COURTESY, not the correctness boundary. The editors tag every
   * request with its query and drop an answer whose query is no longer the one
   * in the box, so a client that ignores `signal` costs bandwidth and cannot
   * put the wrong list under somebody's finger.
   *
   * `offset` is how the sheet pages: scrolled to the end, it asks again with
   * the count it already holds. An implementation that ignores it returns
   * page one again — the editors de-duplicate by code and read "nothing new"
   * as "no more pages", so an un-paged client degrades to the first page
   * rather than to an endless loop.
   *
   * The answer is the endpoint's PAGE ({@link VocabularyTermPage}) or a bare
   * array. The page shape exists for one fact a row cannot carry —
   * `popular_count`, where the popular band ends — and an implementation that
   * keeps answering with an array keeps drawing one plain list.
   */
  search(
    vocabulary: string,
    level: string,
    query: string,
    parent?: string,
    signal?: AbortSignal,
    offset?: number
  ): Promise<VocabularyTermAnswer>;
  /** `{code: label}` for codes already stored on a listing — the labels a
   * reopened draft shows before anything is searched. Unknown codes are
   * omitted, so a caller falls back to the code itself. */
  resolve(
    vocabulary: string,
    level: string,
    codes: readonly string[]
  ): Promise<Readonly<Record<string, string>>>;
}

const VocabularyClientContext: Context<VocabularyClient | null> =
  createContext<VocabularyClient | null>(null);

/**
 * Put a client in scope for every ref editor below it.
 *
 * ```tsx
 * <VocabularyClientProvider value={createVocabularyClient({ baseUrl })}>
 *   <ListingComposerPage … />
 * </VocabularyClientProvider>
 * ```
 */
export const VocabularyClientProvider: Provider<VocabularyClient | null> =
  VocabularyClientContext.Provider;

/** The client in scope, or `null` — see this module's header on why the
 * absence is a state and not an exception. */
export function useVocabularyClient(): VocabularyClient | null {
  return useContext(VocabularyClientContext);
}

/** The value types that cannot be drawn without a client, sorted. Exported so
 * the renderability helpers and the editors read ONE list. */
export const VOCABULARY_BACKED_TYPES: readonly string[] = [
  "ref_hierarchical_select",
  "ref_select",
];

/** The `optionsRef` a `ref_select` config carries, or `undefined` when the
 * config is malformed — the pointer is the whole config, so a missing one is
 * an undrawable field rather than an empty list. */
export function optionsRefOf(
  config: Readonly<Record<string, unknown>>
): { vocabulary: string; level: string; parentFeature?: string } | undefined {
  const raw = config["optionsRef"];
  if (typeof raw !== "object" || raw === null) return undefined;
  const entry = raw as { vocabulary?: unknown; level?: unknown; parentFeature?: unknown };
  if (typeof entry.vocabulary !== "string" || entry.vocabulary.length === 0) return undefined;
  if (typeof entry.level !== "string" || entry.level.length === 0) return undefined;
  return {
    vocabulary: entry.vocabulary,
    level: entry.level,
    ...(typeof entry.parentFeature === "string" && entry.parentFeature.length > 0
      ? { parentFeature: entry.parentFeature }
      : {}),
  };
}

/** The first code a sibling's answer carries, canonicalized — a `ref_select`'s
 * value is a LIST, and a parent narrows by one term. */
export function firstCode(value: unknown): string | undefined {
  if (typeof value === "string") return value.length > 0 ? value : undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const code = firstCode(item);
      if (code !== undefined) return code;
    }
  }
  return undefined;
}
