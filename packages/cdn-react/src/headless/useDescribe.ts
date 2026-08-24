/**
 * `useDescribe(refs)` — render metadata for references this client did not
 * upload, which is what makes an attachment renderer possible at all.
 *
 * The batching, the cache unit and the "missing is data" posture are argued in
 * `model/describe.ts`; this file is the React seam over it.
 */
import { useCallback, useMemo } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { loadFailed, loadLoading, loadReady, useActiveSessionReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { CdnApi } from "../api/cdnApi.js";
import type { CdnRef, CdnRenderMeta } from "../api/types.js";
import { useCdnApi } from "../model/context.js";
import { cdnQueryKeys } from "../model/queryKeys.js";
import {
  createDescribeLoader,
  describeRetryDelayMs,
  isRateLimited,
} from "../model/describe.js";
import type { DescribeLoader, DescribeResult } from "../model/describe.js";

/**
 * One batching loader per API instance.
 *
 * A loader that is rebuilt on render coalesces nothing — every caller would get
 * its own batch of one, which is the per-ref-request shape the batch endpoint
 * exists to replace. Keyed on the api object (which a runtime creates once) and
 * held weakly, so a torn-down runtime takes its loader with it.
 */
const LOADERS = new WeakMap<CdnApi, DescribeLoader>();

function loaderFor(api: CdnApi): DescribeLoader {
  const existing = LOADERS.get(api);
  if (existing !== undefined) return existing;
  const created = createDescribeLoader(api);
  LOADERS.set(api, created);
  return created;
}

/** How many times a rate-limited describe is re-asked before it gives up. */
const RATE_LIMIT_RETRIES = 2;

export interface DescribeBag {
  /**
   * The snapshots, keyed by ref — `ready` only once every requested ref has an
   * answer, so a consumer cannot draw half a gallery and call it done.
   *
   * A ref the server resolved to nothing is NOT in this map and is not a
   * failure; it is in {@link missing}.
   */
  readonly state: LoadState<ReadonlyMap<CdnRef, CdnRenderMeta>>;
  /**
   * Refs that resolved to nothing: deleted, never stored, or malformed. Data,
   * with a 200 behind it — a skin draws "this attachment is gone", which is a
   * different sentence from "we could not ask".
   */
  readonly missing: readonly CdnRef[];
  /**
   * One ref's snapshot: `undefined` while unknown (loading, failed, or never
   * asked), `null` when the server said it resolves to nothing.
   *
   * Three values because there are three states, and collapsing them is the
   * mistake `LoadState` exists to prevent.
   */
  get(ref: CdnRef): CdnRenderMeta | null | undefined;
  readonly isFetching: boolean;
  refetch(): void;
}

/**
 * Resolve a list of `<type>/<hash>` references to their render metadata.
 *
 * ```tsx
 * const described = useDescribe(message.attachments);
 * <MediaAttachment ref={ref} meta={described.get(ref)} />
 * ```
 *
 * Duplicates in `refs` cost nothing (they collapse before the request), the
 * order of `refs` is irrelevant to the cache, and a ref already resolved by a
 * different component on the page is never asked for twice.
 *
 * Gated on the session for the same reason `useCdnRef` is: the default guard is
 * `IsAuthenticatedOrService`, so firing during the login bootstrap buys one
 * guaranteed 401 per attachment on the page.
 */
export function useDescribe(refs: readonly CdnRef[] | null | undefined): DescribeBag {
  const api = useCdnApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();

  // Dedup + stable order, keyed on the joined value rather than the array
  // identity: a caller that builds `[...ids]` inline in render is the normal
  // case, and depending on the identity would rebuild every query object on
  // every render of the caller.
  const key = (refs ?? []).join(" ");
  const unique = useMemo(
    () => [...new Set(key === "" ? [] : key.split(" "))],
    [key]
  );

  const results = useQueries({
    queries: unique.map((ref) => ({
      queryKey: cdnQueryKeys.describe(ref),
      queryFn: (): Promise<DescribeResult> => loaderFor(api).load(ref),
      enabled: sessionReady,
      // A content-addressed ref resolves to an immutable snapshot. There is no
      // later answer to this question.
      staleTime: Number.POSITIVE_INFINITY,
      // The one failure worth re-asking is the rate limiter, and the server
      // says when — see `describeRetryDelayMs`. Everything else (a 403 from a
      // deployment that keeps describe service-side, a 400) is a settled
      // answer that a retry would only repeat.
      retry: (count: number, error: unknown) =>
        isRateLimited(error) && count < RATE_LIMIT_RETRIES,
      retryDelay: (_count: number, error: unknown) => describeRetryDelayMs(error),
    })),
  });

  // Derived straight from `results` rather than memoized: `useQueries` rebuilds
  // that array every render anyway, so a memo keyed on it would recompute every
  // render AND cost a dependency list that lies about what it watches.
  const missing = unique.filter((ref, index) => {
    const result = results[index];
    return result?.status === "success" && result.data === null;
  });

  const state = ((): LoadState<ReadonlyMap<CdnRef, CdnRenderMeta>> => {
    const failure = results.find((result) => result.status === "error");
    if (failure !== undefined) return loadFailed(failure.error);
    if (results.some((result) => result.status === "pending")) return loadLoading();
    const map = new Map<CdnRef, CdnRenderMeta>();
    results.forEach((result, index) => {
      const ref = unique[index];
      if (ref !== undefined && result.data != null) map.set(ref, result.data);
    });
    return loadReady(map);
  })();

  // `undefined` (unknown) and `null` (resolved to nothing) are both meaningful
  // and both come straight off the cache entry — collapsing them with a `??`
  // would turn "this attachment is gone" back into "not asked yet".
  const get = useCallback(
    (ref: CdnRef): CdnRenderMeta | null | undefined =>
      queryClient.getQueryData<DescribeResult>(cdnQueryKeys.describe(ref)),
    [queryClient]
  );

  const refetch = useCallback((): void => {
    for (const ref of unique) {
      void queryClient.invalidateQueries({ queryKey: cdnQueryKeys.describe(ref) });
    }
  }, [queryClient, unique]);

  return {
    state,
    missing,
    get,
    isFetching: results.some((result) => result.isFetching),
    refetch,
  };
}

/**
 * The one-reference form. Same cache, same batch — a page of thirty
 * `useDescribeRef` calls issues ONE request, which is the whole reason the
 * loader batches instead of the hook.
 */
export function useDescribeRef(ref: CdnRef | null | undefined): DescribeBag {
  const refs = useMemo(
    () => (ref === null || ref === undefined || ref === "" ? [] : [ref]),
    [ref]
  );
  return useDescribe(refs);
}
