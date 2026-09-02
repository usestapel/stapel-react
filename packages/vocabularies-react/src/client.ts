/**
 * `createVocabularyClient` — the two reads a ref feature needs, over the
 * stapel-vocabularies wire.
 *
 * ── Why this is a bare `fetch` client and not the pair's StapelClient ───────
 *
 * A `ref_select` reaches its terms through a seam
 * (`VocabularyClient`) that `@stapel/attributes-react` DECLARES and this
 * package SATISFIES — structurally, without either importing the other, so two
 * L2 pairs stay independently releasable. The seam is two async functions and
 * nothing else: no query client, no auth runtime, no provider. Anything this
 * function returned that needed React context could not be handed to
 * `<VocabularyClientProvider value={…}>` at a container's composition root,
 * which is the one call site the seam exists for.
 *
 * Both endpoints are public reads (`ReadOnlyOrStaff`, ETag'd on the
 * vocabulary's revision, no session), so there is no token to carry and
 * nothing for the auth interceptors to do. A host that DOES need headers
 * passes its own `fetch`.
 *
 * The caching the seam deliberately leaves out lives in this package's hooks
 * (`useTermLabels` is a TanStack query; `useTermSearch` supersedes in flight),
 * not in the client — a raw client is what makes the seam testable and what
 * lets a host wrap it.
 */
import { toStapelApiError } from "@stapel/core";
import type { Term, TermPage } from "./api/types.js";

/** One term of a vocabulary level, as `GET …/terms/` returns it.
 *
 * A structural twin of `@stapel/attributes-react`'s `VocabularyTerm` —
 * `has_children` and `band` spelled the wire's way. The declaration is not
 * shared because the two packages must not import each other; the assignment
 * is proven by `test/clientShape.test.ts`. */
export interface VocabularyTerm {
  readonly code: string;
  readonly label: string;
  readonly has_children?: boolean;
  /**
   * Which band this row is in (`stapel-vocabularies` 0.2.0): `popular` for the
   * short recommended set a level opens on, `all` for the alphabet under it.
   *
   * Optional, because a level nobody has ranked and a service older than 0.2.0
   * both send nothing. It is a HINT and not the boundary — the page's
   * {@link VocabularyTermPage.popular_count} is.
   */
  readonly band?: "popular" | "all";
}

/**
 * One page of a level — the envelope, not just its rows.
 *
 * The page carries a fact no row can: `popular_count`, where the popular band
 * ENDS. A consumer draws its separator by SLICING the rows at that index; it
 * must never filter on `band`, because the server ranks a `q` search by prefix
 * FIRST and the band second, so a page can legitimately read
 * `[popular+prefix, all+prefix, popular, all]`. Filtering there would lift row
 * three over row two and destroy the typeahead ranking.
 *
 * Structurally identical to `@stapel/attributes-react`'s
 * `VocabularyTermPage`, for the same reason as {@link VocabularyTerm}.
 */
export interface VocabularyTermPage {
  readonly results: readonly VocabularyTerm[];
  /** How many LEADING rows of {@link results} are in the popular band. The
   * separator goes after index `popular_count - 1`; `0` means this page has
   * none. Absent from a service older than 0.2.0. */
  readonly popular_count?: number;
  /** Rows matching the query before `limit`/`offset`, so a control can say
   * "50 of 14 962". */
  readonly total?: number;
}

/** What a {@link VocabularyClient.search} may answer with: the endpoint's page,
 * or a bare array from a host backing the seam with an in-memory table. */
export type VocabularyTermAnswer = readonly VocabularyTerm[] | VocabularyTermPage;

/**
 * The seam `@stapel/attributes-react` declares and this package implements.
 *
 * ATTRIBUTES-REACT OWNS THIS SHAPE. The copy here exists so a host can name
 * the type without depending on the attributes pair, and
 * `test/clientShape.test.ts` holds a third, hand-transcribed copy of the
 * upstream declaration that the value returned below is assigned to — so a
 * drift in either package is a red build here rather than a runtime hole in a
 * storefront that wired the two together.
 */
export interface VocabularyClient {
  /** Terms of one level, narrowed by `query` and — when the caller has a
   * parent term — by that term's code. An empty `query` means "the first page
   * of this level", which is what a dropdown opens on. `signal` is honoured.
   *
   * The answer is the endpoint's PAGE ({@link VocabularyTermPage}) or a bare
   * array; {@link createVocabularyClient} always answers with the page, so
   * `popular_count` survives the wire. A host that hands the seam an in-memory
   * table keeps returning an array and gets one plain list. */
  search(
    vocabulary: string,
    level: string,
    query: string,
    parent?: string,
    signal?: AbortSignal,
    offset?: number
  ): Promise<VocabularyTermAnswer>;
  /** `{code: label}` for codes already stored somewhere. Unknown codes are
   * omitted by the server, so a caller falls back to the code itself. */
  resolve(
    vocabulary: string,
    level: string,
    codes: readonly string[]
  ): Promise<Readonly<Record<string, string>>>;
}

export interface CreateVocabularyClientOptions {
  /** Where stapel-vocabularies is mounted, e.g. `/vocabularies/api/v1/` or an
   * absolute origin. A missing trailing slash is added. */
  readonly baseUrl: string;
  /** Transport override — a host's authenticated/instrumented `fetch`.
   * Defaults to the global one. */
  readonly fetch?: typeof globalThis.fetch;
  /** Page size for {@link VocabularyClient.search}; the server caps it at 200
   * and defaults to 50. */
  readonly limit?: number;
}

/** The page a typeahead opens on. Matches the server's own default, so the
 * parameter is sent for explicitness rather than to change behaviour. */
export const DEFAULT_TERM_LIMIT = 50;

/** The server refuses more than this many codes per resolve, and silently
 * ignores the tail — so the client splits instead of losing labels. */
export const RESOLVE_BATCH = 200;

function withSlash(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/**
 * `{code: label}` out of a body typed as `Record<string, unknown>` (the
 * contract declares `additionalProperties: {}`). Non-string values are
 * dropped rather than stringified: a label that is not a string is a server
 * the caller should fall back from, and `"[object Object]"` in a dropdown is
 * worse than the code.
 */
function labelsOf(body: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof body !== "object" || body === null) return out;
  for (const [code, label] of Object.entries(body as Record<string, unknown>)) {
    if (typeof label === "string") out[code] = label;
  }
  return out;
}

/**
 * One row as a DEPLOYMENT may send it, which is not quite what the pin
 * declares: `band` arrived in stapel-vocabularies 0.2.0 and a stand still on
 * 0.1.x sends rows without it. `code`, `label` and `has_children` are in both,
 * so only the one field the pin added is loosened — and the names come from
 * the generated {@link Term}, so an upstream rename reddens this file.
 */
type WireTerm = Omit<Term, "band"> & { readonly band?: Term["band"] };

/** The same, for the envelope: `popular_count` is the field the pin added, and
 * `results` is guarded because a 200 with the wrong body is still a 200. */
type WirePage = Omit<TermPage, "results" | "popular_count"> & {
  readonly results?: readonly WireTerm[];
  readonly popular_count?: TermPage["popular_count"];
};

/** A count the page may not carry, kept only if it could actually index the
 * rows: absence is a pre-0.2.0 stand, and a fractional or negative count is a
 * server a consumer should fall back from rather than slice with. */
function countOf(value: number | undefined): number | undefined {
  return value !== undefined && Number.isInteger(value) && value >= 0 ? value : undefined;
}

/**
 * The endpoint's body as the page a consumer reads.
 *
 * VERBATIM in the only two senses that matter: the rows keep the server's
 * order, and `popular_count` is carried across untouched. This function
 * neither sorts nor re-tags — the ordering is `prefix_rank, popular_band,
 * -popularity, sort, label` and only the server knows it.
 *
 * `band` is forwarded as the contract types it. The one thing still read
 * defensively is PRESENCE: the pin declares both new fields required, and a
 * deployment older than the pin sends neither, so both are simply left off —
 * which is the "one plain list" a consumer already draws.
 */
function pageOf(body: unknown): VocabularyTermPage {
  const envelope = body as WirePage | null | undefined;
  const rows: readonly WireTerm[] = Array.isArray(envelope?.results) ? envelope.results : [];
  const results = rows.map((term) => {
    const band = term.band;
    return {
      code: term.code,
      label: term.label,
      has_children: term.has_children,
      ...(band !== undefined ? { band } : {}),
    };
  });
  const popularCount = countOf(envelope?.popular_count);
  const total = countOf(envelope?.total);
  return {
    results,
    ...(popularCount !== undefined ? { popular_count: popularCount } : {}),
    ...(total !== undefined ? { total } : {}),
  };
}

export function createVocabularyClient(
  options: CreateVocabularyClientOptions
): VocabularyClient {
  const base = withSlash(options.baseUrl);
  const doFetch = options.fetch ?? globalThis.fetch;
  const limit = options.limit ?? DEFAULT_TERM_LIMIT;

  async function read(url: string, signal?: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(url, {
        method: "GET",
        headers: { accept: "application/json" },
        ...(signal !== undefined ? { signal } : {}),
      });
    } catch (cause) {
      // An abort is the CALLER's decision, not a failure: rethrow it as-is so
      // `signal.aborted` still discriminates it. Folding it into the error
      // dialect would make a superseded keystroke look like a dead backend.
      if (signal?.aborted === true) throw cause;
      throw toStapelApiError(cause);
    }
    if (!response.ok) {
      // One dialect at the single rethrow point (core `errors.ts`): the body is
      // the backend's envelope, the status is the response's.
      const body: unknown = await response.json().catch(() => undefined);
      throw toStapelApiError(body, response.status);
    }
    return await response.json();
  }

  return {
    async search(vocabulary, level, query, parent, signal, offset) {
      const params = new URLSearchParams();
      params.set("level", level);
      // OMITTED, not empty: `parent=` would ask the server for the children of
      // a term whose code is the empty string, which is a level with nothing in
      // it — the opposite of "the whole level", which is what no parent means.
      if (parent !== undefined && parent.length > 0) params.set("parent", parent);
      params.set("q", query);
      params.set("limit", String(limit));
      // The sheet pages by asking again with the count it already holds.
      // Omitted at zero: the first page is the first page.
      if (offset !== undefined && offset > 0) params.set("offset", String(offset));
      const url = `${base}vocabularies/${encodeURIComponent(vocabulary)}/terms/?${params.toString()}`;
      return pageOf(await read(url, signal));
    },

    async resolve(vocabulary, level, codes) {
      const wanted = codes.filter((code) => code.length > 0);
      if (wanted.length === 0) return {};
      const out: Record<string, string> = {};
      for (let at = 0; at < wanted.length; at += RESOLVE_BATCH) {
        const params = new URLSearchParams();
        params.set("level", level);
        params.set("codes", wanted.slice(at, at + RESOLVE_BATCH).join(","));
        const url = `${base}vocabularies/${encodeURIComponent(vocabulary)}/terms/resolve/?${params.toString()}`;
        Object.assign(out, labelsOf(await read(url)));
      }
      return out;
    },
  };
}
