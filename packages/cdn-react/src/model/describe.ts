/**
 * Resolving a reference to what it takes to draw it — the read this pair did
 * not have until stapel-cdn 0.17.0.
 *
 * ── Why there is a loader here and not just a query ────────────────────────
 *
 * The endpoint is a BATCH (≤ 50 refs, duplicates collapsed server-side) and the
 * consumer is a LIST: a chat thread mounts thirty bubbles, a gallery mounts ten
 * tiles, each of which knows exactly one ref and nothing about its neighbours.
 * Those are the two ends of the same seam, and the two obvious ways to join
 * them are both wrong:
 *
 *   - one request per ref — thirty POSTs where the contract offers one, and the
 *     rate limit (60/min by default) starts refusing a page that is drawing
 *     itself;
 *   - one query keyed on "the list this component happened to hold" — every
 *     component caches its own overlapping copy, and adding a thirty-first
 *     attachment re-fetches the thirty already in hand.
 *
 * So the batch is a TRANSPORT detail and the cache unit is the ref. Callers ask
 * for one ref at a time; requests raised in the same tick are coalesced into as
 * few POSTs as the ceiling allows, and the answer for a ref is one cache entry
 * no matter which batch happened to carry it.
 *
 * ── Missing is data ────────────────────────────────────────────────────────
 *
 * A ref that was deleted, never stored, or is malformed comes back in
 * `missing` with a 200. That is a resolved answer — `null` — and never a
 * rejection: one dead attachment must not cost a page its other thirty-nine,
 * which is the property the endpoint was designed around.
 */
import { isStapelApiError, toStapelApiError } from "@stapel/core";
import type { CdnApi } from "../api/cdnApi.js";
import { CDN_DESCRIBE_MAX_REFS } from "../api/cdnApi.js";
import type { CdnRef, CdnRenderMeta } from "../api/types.js";

/** `null` — the ref resolved to nothing, which is an answer. */
export type DescribeResult = CdnRenderMeta | null;

export interface DescribeLoader {
  /**
   * The snapshot for one ref. Coalesced with every other `load` raised before
   * the batch window closes.
   */
  load(ref: CdnRef): Promise<DescribeResult>;
}

export interface DescribeLoaderOptions {
  /**
   * When to close the batch window. Default: a microtask, so everything a
   * single render pass asks for travels together. Injectable for tests.
   */
  readonly schedule?: (flush: () => void) => void;
  /** Ceiling per request. Default {@link CDN_DESCRIBE_MAX_REFS}. */
  readonly maxRefs?: number;
}

interface Waiter {
  readonly resolve: (value: DescribeResult) => void;
  readonly reject: (error: unknown) => void;
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

/**
 * Build a batching describe loader over an API instance.
 *
 * NO ABORT SIGNAL, deliberately. A batch belongs to several callers at once, so
 * one component unmounting must not cancel the request the other twenty-nine
 * are waiting on. The response is bounded by construction (50 refs × a few KB
 * of preview), and the caller that went away simply drops its answer.
 */
export function createDescribeLoader(
  api: CdnApi,
  options?: DescribeLoaderOptions
): DescribeLoader {
  const maxRefs = options?.maxRefs ?? CDN_DESCRIBE_MAX_REFS;
  const schedule = options?.schedule ?? ((flush: () => void) => { queueMicrotask(flush); });

  let pending = new Map<CdnRef, Waiter[]>();
  let scheduled = false;

  const flush = (): void => {
    scheduled = false;
    const batch = pending;
    pending = new Map<CdnRef, Waiter[]>();
    if (batch.size === 0) return;

    for (const refs of chunk([...batch.keys()], maxRefs)) {
      void api.describe(refs).then(
        (response) => {
          for (const ref of refs) {
            const meta = response.items[ref];
            for (const waiter of batch.get(ref) ?? []) {
              waiter.resolve(meta ?? null);
            }
          }
        },
        (error: unknown) => {
          // A transport failure is NOT "these refs are missing": the client has
          // no answer at all, and a skin must be able to tell "this attachment
          // is gone" from "we could not ask".
          const failure = toStapelApiError(error);
          for (const ref of refs) {
            for (const waiter of batch.get(ref) ?? []) waiter.reject(failure);
          }
        }
      );
    }
  };

  return {
    load(ref) {
      return new Promise<DescribeResult>((resolve, reject) => {
        const waiters = pending.get(ref);
        if (waiters === undefined) pending.set(ref, [{ resolve, reject }]);
        else waiters.push({ resolve, reject });
        if (!scheduled) {
          scheduled = true;
          schedule(flush);
        }
      });
    },
  };
}

const HTTP_TOO_MANY_REQUESTS = 429;
const DEFAULT_RETRY_AFTER_MS = 1_000;
const MAX_RETRY_AFTER_MS = 60_000;

/** Is this the rate limiter, rather than a refusal about the refs themselves? */
export function isRateLimited(error: unknown): boolean {
  return isStapelApiError(error) && error.status === HTTP_TOO_MANY_REQUESTS;
}

/**
 * How long to wait before re-asking, from the server's own `retry_after`.
 *
 * The endpoint sends the number in the refusal's params AND in a `Retry-After`
 * header; the params are what reaches a client through core's error dialect.
 * Guessing when the server has said is how a retry storm starts, so the guess
 * is only the fallback — and it is clamped, because a hostile or misconfigured
 * `retry_after` should not park a page for an hour.
 */
export function describeRetryDelayMs(error: unknown): number {
  const raw = isStapelApiError(error) ? error.params["retry_after"] : undefined;
  const seconds = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_MS;
  return Math.min(seconds * 1_000, MAX_RETRY_AFTER_MS);
}
