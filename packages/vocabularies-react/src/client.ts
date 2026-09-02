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
 * A structural twin of `@stapel/attributes-react`'s `VocabularyTerm` — the same
 * three fields, `has_children` spelled the wire's way. The declaration is not
 * shared because the two packages must not import each other; the assignment
 * is proven by `test/clientShape.test.ts`. */
export interface VocabularyTerm {
  readonly code: string;
  readonly label: string;
  readonly has_children?: boolean;
}

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
   * of this level", which is what a dropdown opens on. `signal` is honoured. */
  search(
    vocabulary: string,
    level: string,
    query: string,
    parent?: string,
    signal?: AbortSignal,
    offset?: number
  ): Promise<readonly VocabularyTerm[]>;
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
      const page = (await read(url, signal)) as TermPage | undefined;
      const results: readonly Term[] = page?.results ?? [];
      return results.map((term) => ({
        code: term.code,
        label: term.label,
        has_children: term.has_children,
      }));
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
