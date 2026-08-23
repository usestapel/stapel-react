import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { RequestErasureBody } from "../api/gdprApi.js";
import type { ErasureStatus } from "../api/types.js";
import { useGdprApi } from "./context.js";
import { gdprQueryKeys } from "./queryKeys.js";

/** What {@link useMyErasures} reports. */
export interface MyErasuresBag {
  /**
   * The caller's erasures, newest state and all. A LIST load, so "we could not
   * ask" can never be drawn as "nothing is being deleted" — on this screen
   * those two sentences are as far apart as sentences get.
   */
  readonly rows: LoadState<readonly ErasureStatus[]>;
  /** Requests still on their way out (`queued` / `erasing`). */
  readonly pending: readonly ErasureStatus[];
  /** Requests an owner never receipted — the module marks them `timeout`. */
  readonly overdue: readonly ErasureStatus[];
  readonly refetch: () => void;
}

/** Erasure states the wire uses. Widened from `string` for the two filters. */
const STATE_QUEUED = "queued";
const STATE_ERASING = "erasing";
const STATE_TIMEOUT = "timeout";

/**
 * The caller's own erasures — the "waiting to be deleted" list.
 *
 * ── Two clocks, and the list carries both ─────────────────────────────────
 *
 * `due_at` is when OUR systems must be done; `fully_erased_by` is `due_at`
 * stretched to the last subprocessor's contractual window (`max(due_at,
 * max(obligation.due_at))`). A product that showed only the first would be
 * telling a person their recording is gone from the world on a date when it is
 * merely gone from us. Both come off the wire and neither is recomputed here.
 *
 * ── `timeout` is surfaced, not swallowed ──────────────────────────────────
 *
 * An `ErasurePart` with no receipt after `OWNER_TIMEOUT_HOURS` turns the whole
 * request `timeout`. That is the module making silence VISIBLE — the entire
 * point of the owner-health machinery — so the bag hands the overdue rows out
 * as their own list rather than leaving a skin to fish for a status string.
 */
export function useMyErasures(
  options: { readonly enabled?: boolean } = {}
): MyErasuresBag {
  const api = useGdprApi();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery<readonly ErasureStatus[]>({
    queryKey: gdprQueryKeys.myErasures,
    queryFn: ({ signal }) => api.myErasures({ signal }),
    enabled,
  });

  const rows = loadStateFromQuery(query);
  const loaded = rows.status === "ready" ? rows.data : [];

  return {
    rows,
    pending: loaded.filter(
      (row) => row.state === STATE_QUEUED || row.state === STATE_ERASING
    ),
    overdue: loaded.filter((row) => row.state === STATE_TIMEOUT),
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * One erasure, with its per-owner receipts and processor windows.
 *
 * The read a host polls after opening one: `parts` says which system has
 * confirmed and which has not, `unreceipted_owners` names what it is still
 * waiting on, and `obligations` carries the windows that push
 * `fully_erased_by` past `due_at`.
 */
export function useErasure(
  requestId: number | undefined,
  options: { readonly enabled?: boolean } = {}
): { readonly state: LoadState<ErasureStatus>; readonly refetch: () => void } {
  const api = useGdprApi();
  const sessionReady = useActiveSessionReady();
  const enabled =
    sessionReady && requestId !== undefined && (options.enabled ?? true);

  const query = useQuery<ErasureStatus>({
    queryKey: gdprQueryKeys.erasure(requestId ?? -1),
    queryFn: ({ signal }) => api.erasure(requestId ?? -1, { signal }),
    enabled,
  });

  return {
    state: loadStateFromQuery(query),
    refetch: () => {
      void query.refetch();
    },
  };
}

/**
 * Open an erasure for one subject — **the mutation a host calls right after
 * its own delete succeeded**.
 *
 * ── The order is not negotiable ───────────────────────────────────────────
 *
 * The endpoint is the hook for a subject the host has ALREADY removed from
 * its own UI: the clock it starts is a purge SLA, not a grace period, and
 * entities get no cancellable window (only the account does). Calling this
 * BEFORE the host's own delete would promise an erasure of something still
 * on screen; calling it instead of one would leave the row visible while
 * every downstream owner erased around it. So the shape is a plain mutation
 * a caller chains onto its own success — this package cannot delete a host's
 * recording and does not pretend to.
 *
 * ```tsx
 * const erase = useRequestErasure();
 * await deleteRecording(id);              // the host's own delete
 * erase.mutate({ subjectType: "recording", subjectKey: id });
 * ```
 *
 * A 403 here (`error.403.gdpr.erasure_forbidden`) is usually the HOST's
 * missing `ERASURE_AUTHORIZER`, not a statement about this person's rights —
 * the default authorizer is staff-only. `isErasureForbidden` exists so a
 * product can say that rather than accusing someone of not owning their own
 * recording.
 */
export function useRequestErasure(): UseMutationResult<
  ErasureStatus,
  StapelApiError,
  RequestErasureBody
> {
  const api = useGdprApi();
  const queryClient = useQueryClient();

  return useMutation<ErasureStatus, StapelApiError, RequestErasureBody>({
    mutationFn: (body) => api.requestErasure(body),
    onSuccess: (erasure) => {
      // Seed the single-request read the caller may poll, then invalidate the
      // list rather than splicing: the server decides which of the caller's
      // erasures are theirs to see, and a spliced row would survive a refetch
      // that disagreed.
      queryClient.setQueryData(gdprQueryKeys.erasure(erasure.request_id), erasure);
      void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.erasures });
    },
  });
}
