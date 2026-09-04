/**
 * `GET {id}/features/`'s response HEADER, off a raw carve-out.
 *
 * `StapelClient.get` parses and returns the JSON body only — it does not
 * surface response headers at all — and `X-Effective-From`
 * (stapel-categories 0.20.1) rides the header, not the body. Same precedent
 * as docs-react's `api/content.ts` (`X-Docs-Head-Seq`) and forms-react's
 * `api/export.ts` (`X-Forms-Next-Before`): the ONE legal home of `fetch` for
 * a header the JSON client cannot answer (`stapel/no-raw-fetch`).
 *
 * The bearer-refresh and verification-403 seams of `createStapelClient` do
 * NOT run on this raw surface (the same v1 limitation the two precedents
 * document) — moot here anyway, since every read this pair makes is
 * anonymous-safe (`ReadOnlyOrStaff`).
 */
import { parseErrorEnvelope } from "@stapel/core";
import type { CategoryFeature, CategoryFeaturesResult } from "./types.js";

/** `own` — read off this node. `children` — a `chips` parent with no
 * features of its own; the list is the intersection of its children's. */
export const EFFECTIVE_FROM_HEADER = "X-Effective-From";

/** Raw-transport binding forwarded from the runtime — the same fetch /
 * credentials / headers the JSON client carries, since this carve-out exists
 * only to read the one header that client drops. */
export interface CategoriesRawTransport {
  /** e.g. `/categories/api/v1` — the same base the pair's `StapelClient` uses. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw request. */
  readonly headers?: Record<string, string>;
}

function rawUrl(transport: CategoriesRawTransport, path: string): string {
  const base = transport.baseUrl.endsWith("/")
    ? transport.baseUrl.slice(0, -1)
    : transport.baseUrl;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

async function parseJsonBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/** Any value other than the literal `"children"` reads as `"own"` — an
 * absent header (a server predating 0.20.1) included. */
function effectiveFromOf(response: Response): "own" | "children" {
  return response.headers.get(EFFECTIVE_FROM_HEADER) === "children"
    ? "children"
    : "own";
}

/**
 * `GET {id}/features/` plus the header the JSON client drops.
 *
 * See `api/types.ts`'s {@link CategoryFeaturesResult} for the shape and
 * `catalog labels/visibleFeatures` for what a caller does with `divergent`
 * rows once it knows which schema this is.
 */
export async function fetchCategoryFeatures(
  transport: CategoriesRawTransport,
  id: number,
  options?: { readonly signal?: AbortSignal }
): Promise<CategoryFeaturesResult> {
  const fetchImpl = transport.fetch ?? globalThis.fetch.bind(globalThis);
  const headers = new Headers(transport.headers);
  const init: RequestInit = { method: "GET", headers };
  if (transport.credentials !== undefined) init.credentials = transport.credentials;
  if (options?.signal !== undefined) init.signal = options.signal;

  const response = await fetchImpl(
    rawUrl(transport, `/categories/${String(id)}/features/`),
    init
  );
  if (!response.ok) {
    throw parseErrorEnvelope(response.status, await parseJsonBody(response));
  }
  const body = await parseJsonBody(response);
  return {
    features: (Array.isArray(body) ? body : []) as readonly CategoryFeature[],
    effectiveFrom: effectiveFromOf(response),
  };
}
