/**
 * The CSV half of the stapel-forms surface — hand-authored api/ carve-out
 * (the docs-react `api/content.ts` / recordings-react `uploadRecordingBlob`
 * precedent, the one legal home of `fetch` per `stapel/no-raw-fetch`).
 *
 * `GET /forms/<id>/submissions/export` is not a JSON operation and cannot ride
 * core's `StapelClient` for two independent reasons:
 *
 *  1. the body is a CSV file, and `StapelClient.request` parses/returns a
 *     decoded JSON value;
 *  2. the CONTINUATION CURSOR rides a response header,
 *     `X-Forms-Next-Before` — which `StapelClient` does not surface at all.
 *
 * Backend delta note 6 explains why the cursor is a header rather than a
 * trailing body field: the body is a spreadsheet, and a cursor appended to it
 * lands as a row in somebody's export. The same note records why the value is
 * **Z-suffixed** rather than isoformat — a bare `+00:00` in a query string
 * decodes to a space, which made the second page a silent 400. This module
 * therefore round-trips the header value VERBATIM into the next `?before=`
 * and never re-formats it.
 *
 * Auth: the runtime's `credentials` / `defaultHeaders` are forwarded here, so
 * a cookie-mode host works unchanged. The bearer-refresh and verification-403
 * seams of `createStapelClient` do NOT run on this raw surface (the same v1
 * limitation docs-react's raw transport documents); a 401 here throws like any
 * other error status rather than triggering a refresh-and-retry.
 */
import { parseErrorEnvelope } from "@stapel/core";

/**
 * Raw-transport binding forwarded from the runtime. Declared here rather than
 * in `formsApi.ts` so the two modules do not import each other's types in a
 * cycle — `formsApi.ts` re-exports it as part of its public surface.
 */
export interface FormsApiOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Record<string, string>;
}

/**
 * Response header carrying the keyset cursor for the NEXT export page.
 * Absent (or empty) means this was the last page.
 */
export const FORMS_NEXT_BEFORE_HEADER = "X-Forms-Next-Before";

/** The raw-transport binding `createFormsApi` closes over. */
export interface FormsRawTransport {
  /** e.g. `/forms/api/v1` — the same base the pair's `StapelClient` uses. */
  readonly baseUrl: string;
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw request (e.g. a tenant id / auth header). */
  readonly headers?: Record<string, string>;
}

/** One page of the CSV export. */
export interface CsvExportPage {
  /** The page's CSV text, header row included. */
  readonly csv: string;
  /**
   * The cursor to pass as the next call's `before`, or `null` when the export
   * is complete. Opaque — pass it back verbatim (see the module header).
   */
  readonly nextBefore: string | null;
}

/** Build the transport from the runtime options, dropping absent keys so
 * `exactOptionalPropertyTypes` stays satisfied. */
export function createExportTransport(
  baseUrl: string,
  options: FormsApiOptions
): FormsRawTransport {
  return {
    baseUrl,
    ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
    ...(options.credentials !== undefined
      ? { credentials: options.credentials }
      : {}),
    ...(options.defaultHeaders !== undefined
      ? { headers: options.defaultHeaders }
      : {}),
  };
}

function exportUrl(
  transport: FormsRawTransport,
  formId: string,
  query: Readonly<Record<string, string | number | undefined>>
): string {
  const base = transport.baseUrl.endsWith("/")
    ? transport.baseUrl.slice(0, -1)
    : transport.baseUrl;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return (
    `${base}/forms/${encodeURIComponent(formId)}/submissions/export` +
    (qs.length > 0 ? `?${qs}` : "")
  );
}

async function throwEnvelope(response: Response): Promise<never> {
  const text = await response.text();
  let body: unknown = text.length > 0 ? text : undefined;
  if (text.length > 0) {
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      /* a non-JSON error body stays the raw text */
    }
  }
  throw parseErrorEnvelope(response.status, body);
}

/**
 * Fetch one page of a form's CSV export.
 *
 * Drive it to completion by feeding {@link CsvExportPage.nextBefore} back in
 * as `before` until it is `null`, concatenating the pages MINUS the repeated
 * header row (see `useCsvExport`, which does exactly that).
 */
export async function exportSubmissionsCsv(
  transport: FormsRawTransport,
  params: {
    readonly workspaceId: string;
    readonly formId: string;
    readonly before?: string;
    readonly version?: number;
    readonly signal?: AbortSignal;
  }
): Promise<CsvExportPage> {
  const fetchImpl = transport.fetch ?? globalThis.fetch.bind(globalThis);
  const headers = new Headers({ Accept: "text/csv" });
  if (transport.headers) {
    for (const [key, value] of Object.entries(transport.headers)) {
      if (!headers.has(key)) headers.set(key, value);
    }
  }

  const init: RequestInit = { method: "GET", headers };
  if (transport.credentials !== undefined) init.credentials = transport.credentials;
  if (params.signal) init.signal = params.signal;

  const response = await fetchImpl(
    exportUrl(transport, params.formId, {
      workspace_id: params.workspaceId,
      ...(params.before !== undefined ? { before: params.before } : {}),
      ...(params.version !== undefined ? { version: params.version } : {}),
    }),
    init
  );

  if (!response.ok) return throwEnvelope(response);

  const raw = response.headers.get(FORMS_NEXT_BEFORE_HEADER);
  return {
    csv: await response.text(),
    // An empty header is "no more pages", not a cursor of "".
    nextBefore: raw !== null && raw.length > 0 ? raw : null,
  };
}

/**
 * Concatenate export pages into one CSV, keeping the header row exactly once.
 *
 * Every page the server streams carries its own header row (it is a standalone
 * CSV file); pasting the pages verbatim would sprinkle header rows through the
 * middle of the spreadsheet. Splitting on the first newline is safe here
 * because a stapel-forms header row is a list of field slugs — slugs cannot
 * contain a newline, so the first line is always exactly the header.
 *
 * Each retained chunk is newline-terminated before the join: a page whose last
 * row has no trailing newline would otherwise be glued to the next page's
 * first row, silently producing one corrupt record per page boundary.
 */
export function concatCsvPages(pages: readonly string[]): string {
  const nonEmpty = pages.filter((page) => page.length > 0);
  const first = nonEmpty[0];
  if (first === undefined) return "";
  const chunks = [
    first,
    ...nonEmpty.slice(1).map((page) => {
      const newline = page.indexOf("\n");
      return newline === -1 ? "" : page.slice(newline + 1);
    }),
  ].filter((chunk) => chunk.length > 0);
  return chunks
    .map((chunk, index) =>
      index === chunks.length - 1 || chunk.endsWith("\n") ? chunk : `${chunk}\n`
    )
    .join("");
}
