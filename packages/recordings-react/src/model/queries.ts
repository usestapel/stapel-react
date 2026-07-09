import { useQuery } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
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
 */
export function useRecordings(
  params?: RecordingListParams
): UseQueryResult<Recording[], StapelApiError> {
  const api = useRecordingsApi();
  const p = params ?? {};
  return useQuery({
    queryKey: recordingsQueryKeys.list(p),
    queryFn: () => api.listRecordings(p),
  });
}

/**
 * A single recording by id — the read behind a detail view that polls a
 * processing recording until its transcription outputs land. `enabled` is gated
 * on a non-empty id so the hook stays inert until a selection exists.
 */
export function useRecording(
  recordingId: string
): UseQueryResult<Recording, StapelApiError> {
  const api = useRecordingsApi();
  return useQuery({
    queryKey: recordingsQueryKeys.detail(recordingId),
    queryFn: () => api.getRecording(recordingId),
    enabled: recordingId.length > 0,
  });
}
