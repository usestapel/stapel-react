import type { StapelClient } from "@stapel/core";
import type { ScopeUsageResponse } from "./types.js";

/**
 * The two request shapes `GET /scopes/{scope_key}/usage/` accepts, as a
 * DISCRIMINATED UNION rather than a bag of loose optional strings.
 *
 * The endpoint takes `month` OR `months`, never both — `months` is ignored
 * when `month` is given — and answers `error.400.video_invalid_usage_period`
 * for a malformed `month`, a `months` outside 1..36, or a `tz` that is not an
 * IANA zone. A `{ month?, months? }` bag would make "both" and "neither"
 * expressible and push the refusal to the server for a mistake the type system
 * can refuse for free.
 */
export type ScopeUsageRequest =
  | {
      /** The last `months` calendar months, newest first. */
      readonly kind: "window";
      readonly months: number;
      readonly tz: string;
    }
  | {
      /** ONE calendar month, `YYYY-MM`. Answers a one-element `months` list,
       * so a reader renders the same shape either way. */
      readonly kind: "month";
      readonly month: string;
      readonly tz: string;
    };

/**
 * The pair's typed operation surface — bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2). Paths are relative to the runtime's `baseUrl` (`/video/api/v1/`).
 *
 * ── One operation, out of eight in the contract ────────────────────────────
 *
 * `manifest.json` lists the whole of stapel-video's HTTP surface (8 paths):
 * room create/read, the join grant, the two lobby verdicts, the participant
 * list, this usage read, and the provider webhook. Only the usage read is
 * here, and the other seven are not omissions:
 *
 * - The room + lobby + participant endpoints belong to a MEETING client, which
 *   is a media-server session (a LiveKit/Janus SDK, a room UI, device
 *   permissions) and not a React data pair. A host that runs meetings already
 *   owns that stack; wrapping four JSON calls next to it would be the smallest
 *   and least useful part of it.
 * - `POST /webhook` is the provider's, not a browser's. It is verified by a
 *   provider signature the browser does not hold.
 *
 * Adding them later is additive and needs no change to anything here. These
 * operations will be GENERATED from schema.json operationIds by gen-api v2;
 * until then they are hand-authored here (the ONE legal home of path strings —
 * `stapel/no-string-paths` §2.3 carve-out).
 */
export interface VideoApi {
  readonly client: StapelClient;

  /**
   * One partition's per-month, per-person call time.
   *
   * TWO gates on the far side, and both answer **404**: the mandate gate
   * (`STAPEL_VIDEO["USAGE_MANDATE"]`, held IN this scope) and the scope
   * lookup. `error.404.video_scope_not_found` is therefore uniform over three
   * different situations — the scope does not exist, the scope has no calls,
   * and the caller may not read it — because a 403 would confirm that a
   * guessed tenant id is real. Nothing in this pair tries to tell them apart.
   */
  scopeUsage(
    scopeKey: string,
    request: ScopeUsageRequest,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ScopeUsageResponse>;
}

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

/** The query string for one request shape — the union, flattened once. */
function usageQuery(request: ScopeUsageRequest): Record<string, string | number> {
  return request.kind === "month"
    ? { month: request.month, tz: request.tz }
    : { months: request.months, tz: request.tz };
}

export function createVideoApi(client: StapelClient): VideoApi {
  return {
    client,

    scopeUsage: (scopeKey, request, options) =>
      client.get(
        // The scope key is host-chosen and opaque (for meettoday: a workspace
        // id). Encoded, because "opaque" includes shapes that are not path-safe.
        `/scopes/${encodeURIComponent(scopeKey)}/usage/`,
        { query: usageQuery(request), ...signalOf(options) }
      ),
  };
}
