import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { useActiveSessionReady } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type { Recording, RecordingListParams } from "../api/types.js";
import { useRecordingsApi } from "./context.js";
import { recordingsQueryKeys } from "./queryKeys.js";

/**
 * Read hooks over the recordings API (frontend-standard §2 — read hooks).
 * Staleness follows core's query defaults; override per call site via a page
 * that needs fresher data. Keys are namespaced (see `recordingsQueryKeys`).
 */

/**
 * Recordings newest-first as the backend orders them — the caller's own by
 * default, or every recording in a workspace they belong to when `params`
 * carries a `workspaceId` (a non-member read fails
 * `error.403.recording_workspace_forbidden`).
 *
 * Gated on {@link useActiveSessionReady} (owner-diagnosed live incident,
 * 2026-07-17): this top-level list hook has no natural `enabled` condition
 * of its own — exactly the shape that raced a still-bootstrapping session
 * and read a live one as "expired". Zero manual `enabled` wiring needed at
 * the call site by design.
 */
export function useRecordings(
  params?: RecordingListParams
): UseQueryResult<Recording[], StapelApiError> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  const p = params ?? {};
  return useQuery({
    queryKey: recordingsQueryKeys.list(p),
    queryFn: () => api.listRecordings(p),
    enabled: sessionReady,
  });
}

/**
 * A single recording by id — the read behind a detail view that polls a
 * processing recording until its transcription outputs land. `enabled` is
 * gated on a non-empty id (so the hook stays inert until a selection
 * exists) AND session readiness — an id can be known synchronously (e.g. a
 * URL param) before the session has finished bootstrapping.
 */
export function useRecording(
  recordingId: string
): UseQueryResult<Recording, StapelApiError> {
  const api = useRecordingsApi();
  const sessionReady = useActiveSessionReady();
  return useQuery({
    queryKey: recordingsQueryKeys.detail(recordingId),
    queryFn: () => api.getRecording(recordingId),
    enabled: sessionReady && recordingId.length > 0,
  });
}
