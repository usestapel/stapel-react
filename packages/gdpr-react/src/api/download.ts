/**
 * The raw-bytes half of the stapel-gdpr surface — hand-authored `api/`
 * carve-out (the `@stapel/docs-react` `api/content.ts` precedent, itself
 * following recordings-react's `uploadRecordingBlob`: the one legal home of
 * `fetch` per `stapel/no-raw-fetch`).
 *
 * ── Why one operation cannot ride the JSON client ─────────────────────────
 *
 * `POST /user/data-export/download` answers `application/zip`: a person's
 * entire personal-data archive. Core's `StapelClient` parses every successful
 * response with `response.text()` and then tries `JSON.parse` — correct for
 * fifteen of this module's sixteen operations, and quietly destructive for
 * this one (a ZIP read as UTF-8 text is no longer a ZIP). So the download
 * speaks `fetch` directly, bound to the runtime's base URL / credentials /
 * default headers by `createGdprApi`, and folds a non-2xx through core's own
 * `parseErrorEnvelope` so a refusal here is the SAME `StapelApiError` the rest
 * of the pair raises — which is what lets `isDownloadConsumed` and
 * `isDownloadExpired` tell two 410s apart at the call site.
 *
 * Auth: standard pairs authenticate via the `stapel_jwt` cookie (build the
 * runtime with `credentials: "include"` for a cross-origin API) or via
 * `defaultHeaders` — both are forwarded here. The bearer-refresh and
 * verification-403 seams of `createStapelClient` do NOT run on this raw
 * surface (the docs-react v1 limitation, recorded rather than hidden: a 401
 * here throws like any other error status).
 *
 * ── The token is never put in a URL ───────────────────────────────────────
 *
 * It travels in the BODY, because stapel-gdpr moved it there deliberately: the
 * GET variant put a live credential to a full personal-data archive into
 * access logs, browser history, `Referer` headers and every proxy in between.
 * A helper here that accepted a `?token=` would re-open exactly that hole from
 * the client side, so no such helper exists.
 */
import { parseErrorEnvelope } from "@stapel/core";

/** The raw-transport binding `createGdprApi` closes over. */
export interface GdprRawTransport {
  /** e.g. `/gdpr/api/v1` — the same base the pair's `StapelClient` uses. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw request (e.g. a tenant id / auth header). */
  readonly headers?: Record<string, string>;
}

/** The archive, plus what the response says about how to save it. */
export interface ExportArchive {
  readonly blob: Blob;
  /** From `Content-Disposition`, when the server names the file. */
  readonly filename: string | undefined;
  readonly contentType: string | undefined;
}

function rawUrl(transport: GdprRawTransport, path: string): string {
  const base = transport.baseUrl.endsWith("/")
    ? transport.baseUrl.slice(0, -1)
    : transport.baseUrl;
  return `${base}${path}`;
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

/** `filename="stapel-export.zip"` out of a `Content-Disposition` header. */
function filenameOf(response: Response): string | undefined {
  const raw = response.headers.get("content-disposition");
  if (raw === null) return undefined;
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(raw);
  const value = match?.[1];
  if (value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Spend the single-use download token and take the archive as bytes.
 *
 * Every refusal on the way is a different situation and the codes say so —
 * 404 (no such export), 425 (still being built), 410 (the token was already
 * spent, or the link expired). Two of those share a status, which is why the
 * pair's predicates read the CODE.
 */
export async function downloadExportArchive(
  transport: GdprRawTransport,
  token: string,
  options?: { readonly signal?: AbortSignal }
): Promise<ExportArchive> {
  const doFetch = transport.fetch ?? globalThis.fetch;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (transport.headers) {
    for (const [key, value] of Object.entries(transport.headers)) {
      if (!headers.has(key)) headers.set(key, value);
    }
  }
  const init: RequestInit = {
    method: "POST",
    headers,
    body: JSON.stringify({ token }),
  };
  if (transport.credentials !== undefined) init.credentials = transport.credentials;
  if (options?.signal !== undefined) init.signal = options.signal;

  const response = await doFetch(
    rawUrl(transport, "/user/data-export/download"),
    init
  );
  if (!response.ok) {
    throw parseErrorEnvelope(response.status, await parseJsonBody(response));
  }
  return {
    blob: await response.blob(),
    filename: filenameOf(response),
    contentType: response.headers.get("content-type") ?? undefined,
  };
}
