import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState, StapelApiError } from "@stapel/core";
import type { ExportArchive } from "../api/download.js";
import type { ExportRequest, ExportStatus } from "../api/types.js";
import { useGdprApi } from "./context.js";
import { gdprQueryKeys } from "./queryKeys.js";
import { isExportNotFound } from "./refusals.js";

/** What {@link useDataExport} reports. */
export interface DataExportBag {
  /**
   * The export on record, or `null` for "you have never asked for one" — the
   * same 404-as-a-state fold `useAccountClosure` performs, for the module's
   * other read that says "nothing here" with a status code.
   */
  readonly state: LoadState<ExportStatus | null>;
  /** `pending` | `processing` | `ready` | `failed` | `expired`, or `"none"`. */
  readonly status: ExportStatus["status"] | "none" | undefined;
  /** Sections finished / sections expected — the honest progress pair. */
  readonly progress: { readonly done: number; readonly total: number } | undefined;
  /**
   * True only while the single-use token is unspent AND the archive exists.
   * The server owns this bit; nothing here infers it from `status`.
   */
  readonly downloadAvailable: boolean;
  /**
   * Sections that could not be included. A partial archive is still handed
   * over — the regulation's deadline does not pause for one silent owner —
   * but the person is TOLD which parts are missing rather than being left to
   * discover a hole in their own data.
   */
  readonly missingServices: readonly string[];
  /** ISO instant the download link dies. Off the wire, never recomputed. */
  readonly expiresAt: string | undefined;
  /** Ask for the archive. Refused with a 409 once per 30 days. */
  readonly request: UseMutationResult<ExportRequest, StapelApiError, void>;
  /**
   * Spend the single-use token and take the bytes.
   *
   * The token is NOT in this bag and cannot be: the module never returns it
   * from a read — it is emailed, precisely so that fetching an archive needs
   * something more than a live session. The host passes the token it took from
   * that link.
   */
  readonly download: UseMutationResult<ExportArchive, StapelApiError, string>;
  readonly refetch: () => void;
}

/**
 * The Art. 15 / 20 archive: ask for it, watch it being built, take it.
 *
 * ── Why this pair exists at all ───────────────────────────────────────────
 *
 * These three endpoints have shipped in stapel-gdpr since 0.1 and were
 * unreachable from any product — the regulation's "right of access" existed as
 * a URL nobody had wired a button to. That is the defect this hook closes.
 *
 * ── Two things the hook refuses to infer ──────────────────────────────────
 *
 * 1. **Whether the archive can be downloaded.** `download_available` is a
 *    server bit that also encodes "the single-use token is still unspent". A
 *    client deriving it from `status === "ready"` would offer a button that
 *    answers 410 to somebody who already downloaded their data.
 * 2. **When the link dies.** `expires_at` is the server's instant; a
 *    browser-side "expires in 6 days" drifts from the value the cleanup task
 *    acts on.
 */
export function useDataExport(
  options: { readonly enabled?: boolean } = {}
): DataExportBag {
  const api = useGdprApi();
  const queryClient = useQueryClient();
  const sessionReady = useActiveSessionReady();
  const enabled = sessionReady && (options.enabled ?? true);

  const query = useQuery<ExportStatus | null>({
    queryKey: gdprQueryKeys.exportStatus,
    queryFn: ({ signal }) =>
      api.exportStatus({ signal }).catch((error: unknown) => {
        if (isExportNotFound(error)) return null;
        throw error;
      }),
    enabled,
  });

  // Typed options object, not call-site generics: `void` stays in
  // type-reference position (`no-invalid-void-type`, the auth-react precedent).
  const requestOptions: UseMutationOptions<ExportRequest, StapelApiError, void> = {
    mutationFn: () => api.requestExport(),
    // The POST answers `{request_id, status, message}` — an acceptance, not a
    // status row — so there is nothing to seed the status cache with, and
    // guessing one (`parts_done: 0`) would put a number on screen that the
    // server never said. Invalidate and let the read answer.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.exportStatus });
    },
  };
  const request = useMutation(requestOptions);

  const download = useMutation<ExportArchive, StapelApiError, string>({
    mutationFn: (token) => api.downloadExport(token),
    // The archive is DELETED the moment it is served and the token is spent,
    // so the cached status ("download_available: true") is stale the instant
    // this resolves — including when it fails with 410 `download_consumed`,
    // which means somebody else's tab spent it first.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: gdprQueryKeys.exportStatus });
    },
  });

  const state = loadStateFromQuery(query);
  const row = state.status === "ready" ? state.data : undefined;

  return {
    state,
    status: row === undefined ? undefined : row === null ? "none" : row.status,
    progress:
      row != null
        ? { done: row.parts_done, total: row.parts_total }
        : undefined,
    downloadAvailable: row?.download_available ?? false,
    missingServices: row?.missing_services ?? [],
    expiresAt: row?.expires_at ?? undefined,
    request,
    download,
    refetch: () => {
      void query.refetch();
    },
  };
}
