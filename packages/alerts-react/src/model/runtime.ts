import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createAlertsApi } from "../api/alertsApi.js";
import type { AlertsApi } from "../api/alertsApi.js";

/**
 * The wired alerts runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2) — plus the two facts about this deployment that the
 * module genuinely knows and its HTTP surface genuinely does not serve.
 *
 * The runtime's `fetch`/`credentials`/`defaultHeaders` are forwarded to the
 * pair's RAW read surface as well, because the conditional (`ETag`) reads
 * cannot ride the JSON client — see `api/alertsApi.ts`.
 *
 * ── `pollIntervalMs`: there is no stream ──────────────────────────────────
 *
 * stapel-alerts pushes nothing. An issue opens when a process somewhere fails,
 * which is precisely when nobody is looking at the tracker; a feed that never
 * re-read would show a green screen through an outage. The re-read is
 * conditional, so the cost of asking is a 304 and a header — which is the
 * whole reason the backend put an `ETag` on these two routes.
 *
 * ── `commitRefUrl`: where a sha goes when you click it ────────────────────
 *
 * A fixed issue carries `fixed_in_sha`, and the only useful thing to do with a
 * sha is open the commit. WHERE that is is the host's repository, which this
 * package cannot know and will not guess: unset, the sha renders as text and
 * not as a dead link.
 */
export type AlertsRuntime = ModuleRuntime<AlertsApi> & {
  /** How often an open feed re-asks, conditionally. `0` disables the poll. */
  readonly pollIntervalMs: number;
  /** `(sha) => href` for the host's repository browser. Omit for plain text. */
  readonly commitRefUrl: ((sha: string) => string) | undefined;
};

/** The module's canonical mount (`urls.py` + `urls_v1.py`). */
export const DEFAULT_ALERTS_BASE_URL = "/alerts/api/v1/";

/**
 * 60 seconds — the interval the module's own API doc names ("a poller that
 * asks every minute should get a 304, not a page of JSON it already has").
 * Fast enough that an operator watching a deploy sees a regression while it is
 * still their deploy; slow enough that the answer is almost always 304.
 */
export const DEFAULT_ALERTS_POLL_INTERVAL_MS = 60_000;

export interface CreateAlertsRuntimeOptions
  extends Omit<CreateModuleRuntimeOptions, "baseUrl"> {
  /** Default {@link DEFAULT_ALERTS_BASE_URL}. */
  readonly baseUrl?: string;
  /** Default {@link DEFAULT_ALERTS_POLL_INTERVAL_MS}; `0` disables the poll. */
  readonly pollIntervalMs?: number;
  /** Turn a `fixed_in_sha` into a link into the host's repository browser. */
  readonly commitRefUrl?: (sha: string) => string;
}

export function createAlertsRuntime(
  options: CreateAlertsRuntimeOptions = {}
): AlertsRuntime {
  const { baseUrl, pollIntervalMs, commitRefUrl, ...moduleOptions } = options;
  const base = createModuleRuntime(
    (client) =>
      createAlertsApi(client, {
        ...(options.fetch !== undefined ? { fetch: options.fetch } : {}),
        ...(options.credentials !== undefined
          ? { credentials: options.credentials }
          : {}),
        ...(options.defaultHeaders !== undefined
          ? { defaultHeaders: options.defaultHeaders }
          : {}),
      }),
    { ...moduleOptions, baseUrl: baseUrl ?? DEFAULT_ALERTS_BASE_URL }
  );
  return {
    ...base,
    pollIntervalMs: pollIntervalMs ?? DEFAULT_ALERTS_POLL_INTERVAL_MS,
    commitRefUrl,
  };
}
