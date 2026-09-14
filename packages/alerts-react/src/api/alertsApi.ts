/**
 * The pair's typed operation surface over stapel-alerts (`urls_v1.py`),
 * mounted on the module base the host injects (`/alerts/api/v1/`).
 *
 * ── Four operations, and the fifth is deliberately absent ─────────────────
 *
 * The module has five routes. `POST /report` is not one of the four here, and
 * never will be: a reporter authenticates with `X-Service-Key`, that key lives
 * in every container in the fleet, and the blast radius of one leaking must
 * not include a browser. This pair READS and MANAGES the tracker; the things
 * that report to it are processes.
 *
 * ── The two reads are conditional, and the JSON client cannot do that ─────
 *
 * Both `GET`s answer an `ETag` and honour `If-None-Match` with a **304 and no
 * body** (`views._conditional`) — the module's own stated requirement, because
 * a triage screen open on a wall re-asks every minute and should not be handed
 * a page of JSON it already has.
 *
 * `@stapel/core`'s `StapelClient` cannot express that on either side: it parses
 * a JSON body and hands back nothing else (no response headers, so the `ETag`
 * is unreadable), and a 304 is not `response.ok`, so it would be THROWN as a
 * `StapelApiError` instead of read as "still what you have". So the two reads
 * speak `fetch` directly (the `@stapel/docs-react` precedent for the same
 * class of problem), bound to the runtime's base URL / credentials / headers.
 *
 * **One dialect out of both transports.** Every non-2xx from the raw reads is
 * folded through core's own `parseErrorEnvelope`, so a caller catches a
 * `StapelApiError` with a `.code` whether the failure came from the raw read
 * or from the JSON client — the rethrown-body dialect CONTRIBUTING.md's "Mock
 * the wire, not the module" section is about never exists here.
 *
 * Auth: the standard pair seams apply to the two WRITES (bearer refresh,
 * verification-403) because they ride `StapelClient`. The raw reads carry the
 * runtime's `credentials` and `defaultHeaders` — which is a session cookie for
 * a cookie-mode host, and the header a bearer host passes as
 * `defaultHeaders` — but not the 401-refresh retry. A 401 on a read surfaces
 * as `error.401.unauthorized`, and the screen says so.
 */
import { parseErrorEnvelope } from "@stapel/core";
import type { StapelClient } from "@stapel/core";
import type {
  Issue,
  IssueDetail,
  IssueFix,
  IssueLevel,
  IssuePage,
  IssuePatch,
  IssueStatus,
} from "./types.js";

/** Query for `GET /issues` — every parameter `IssueListView` reads. */
export interface IssueFilters {
  readonly status?: IssueStatus;
  readonly level?: IssueLevel;
  /** The reporting service's name, exactly as the tracker stores it. */
  readonly service?: string;
  /** ISO-8601; `last_seen >= since`. */
  readonly since?: string;
  /** Only `new` + `regressed` — the module's own definition of open. */
  readonly open?: boolean;
  /** Row offset. The page SIZE is the server's and is not a parameter. */
  readonly offset?: number;
}

/**
 * The answer to a conditional read.
 *
 * `"unchanged"` is a RESULT, not an error and not an absence: the server
 * confirmed the rows on screen are current. A caller that folded it into
 * `undefined` would blank a triage table every time nothing had happened,
 * which is most of the time.
 */
export type ConditionalRead<T> =
  | {
      readonly outcome: "modified";
      /** The validator to send next time. `null` if the server sent none. */
      readonly etag: string | null;
      readonly data: T;
    }
  | {
      readonly outcome: "unchanged";
      readonly etag: string;
    };

/** Per-read options: the validator to offer, and the abort signal. */
export interface ConditionalReadOptions {
  /** The `ETag` from the previous read of this exact query, if any. */
  readonly etag?: string | null | undefined;
  readonly signal?: AbortSignal | undefined;
}

export interface AlertsApi {
  readonly client: StapelClient;

  /**
   * The triage list, newest activity first.
   *
   * Answers a PAGE (`{count, offset, limit, results}`), not the bare array the
   * schema declares — see `api/types.ts`, BACKEND-GAP A-1.
   */
  issues(
    filters?: IssueFilters,
    options?: ConditionalReadOptions
  ): Promise<ConditionalRead<IssuePage>>;

  /** One issue with its last 20 events, their traces and their context. */
  issue(
    issueId: string,
    options?: ConditionalReadOptions
  ): Promise<ConditionalRead<IssueDetail>>;

  /**
   * Set a status a caller is allowed to assert, and/or leave a note.
   *
   * **`muted_until` only lands together with `status: "muted"`** — the view
   * applies the mute through `services.set_status`, which is reached only when
   * the patch carries a status (BACKEND-GAP A-3). A patch of `muted_until`
   * alone is accepted with a 200 and changes nothing, which is the worst
   * possible answer, so `model/status.ts` never sends one.
   */
  patchIssue(issueId: string, patch: IssuePatch): Promise<Issue>;

  /**
   * Close an issue with the release that claims the fix.
   *
   * Idempotent by design: fixing a fixed issue overwrites the version, which
   * is what re-deploying a better fix should do. Zeroes `count_since_fix`, so
   * "has anything happened since?" stays a column rather than a query over
   * events retention may already have swept.
   */
  fixIssue(issueId: string, fix: IssueFix): Promise<Issue>;
}

/** The raw-transport knobs `createAlertsRuntime` forwards (see the header). */
export interface AlertsRawOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  /** Merged into every raw read (a tenant id, a bearer header). */
  readonly defaultHeaders?: Record<string, string>;
}

/** An id is a uuid from the server, and it is still escaped: the rule holds by
 * shape rather than by an argument about this particular type. */
const seg = (value: string): string => encodeURIComponent(value);

/** Same shape as `StapelClient`'s own URL builder: one base, no double slash. */
function buildUrl(
  baseUrl: string,
  path: string,
  query?: Readonly<Record<string, string | number | boolean | undefined>>
): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  let url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (query) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) continue;
      search.set(key, String(value));
    }
    const qs = search.toString();
    if (qs.length > 0) url += `?${qs}`;
  }
  return url;
}

/** The body of a failed raw read, parsed the way the JSON client parses it. */
async function errorBodyOf(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (text.length === 0) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * One conditional GET. The single place this package turns an HTTP answer into
 * either a {@link ConditionalRead} or a `StapelApiError` — so the two
 * transports of this pair speak ONE error dialect.
 */
async function conditionalGet<T>(
  options: AlertsRawOptions & { readonly baseUrl: string },
  path: string,
  query: Readonly<Record<string, string | number | boolean | undefined>>,
  read: ConditionalReadOptions | undefined
): Promise<ConditionalRead<T>> {
  const doFetch = options.fetch ?? globalThis.fetch;
  const headers = new Headers(options.defaultHeaders);
  headers.set("Accept", "application/json");
  if (read?.etag != null && read.etag.length > 0) {
    headers.set("If-None-Match", read.etag);
  }
  const init: RequestInit = { method: "GET", headers };
  if (options.credentials !== undefined) init.credentials = options.credentials;
  if (read?.signal !== undefined) init.signal = read.signal;

  const response = await doFetch(buildUrl(options.baseUrl, path, query), init);

  if (response.status === 304) {
    // The server echoes the validator it matched; fall back to the one we
    // sent, so the next read still carries a validator either way.
    const etag = response.headers.get("ETag") ?? read?.etag ?? "";
    return { outcome: "unchanged", etag };
  }
  if (!response.ok) {
    throw parseErrorEnvelope(response.status, await errorBodyOf(response));
  }
  return {
    outcome: "modified",
    etag: response.headers.get("ETag"),
    data: (await response.json()) as T,
  };
}

export function createAlertsApi(
  client: StapelClient,
  raw: AlertsRawOptions = {}
): AlertsApi {
  const transport = { ...raw, baseUrl: client.baseUrl };
  return {
    client,

    issues: (filters, options) =>
      conditionalGet<IssuePage>(
        transport,
        "/issues",
        {
          status: filters?.status,
          level: filters?.level,
          service: filters?.service,
          since: filters?.since,
          // The view reads `"1" | "true" | "True"`; anything else — including
          // `open=false` — means "do not filter", which is exactly what
          // omitting it means. So `false` is sent as nothing.
          open: filters?.open === true ? true : undefined,
          offset: filters?.offset,
        },
        options
      ),

    issue: (issueId, options) =>
      conditionalGet<IssueDetail>(transport, `/issues/${seg(issueId)}`, {}, options),

    patchIssue: (issueId, patch) =>
      client.patch(`/issues/${seg(issueId)}`, patch),

    fixIssue: (issueId, fix) =>
      client.post(`/issues/${seg(issueId)}/fix`, fix),
  };
}
