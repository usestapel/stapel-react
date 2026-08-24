import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  CreateRecordingRequest,
  CreateRecordingResponse,
  Job,
  Recording,
  ShareUnlock,
} from "../api/types.js";
import { useRecordingsApi } from "./context.js";
import { recordingsQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — mutations invalidate on success). A created
 * recording lands in the list, and a finalize flips a recording's status and
 * (eventually) fills its transcription outputs — both shift more than one cached
 * read, so each mutation invalidates the module root (`recordingsQueryKeys.all`)
 * on success rather than guessing which entries changed. A host that wants
 * optimistic updates layers them on the returned mutation.
 *
 * Options are built as typed `UseMutationOptions` objects (not call-site
 * generics) so `void`/error types stay in reference position, which
 * `no-invalid-void-type` permits.
 */

/**
 * Create a recording and open its upload session — returns the created
 * recording plus the {@link UploadSession} to PUT the media at (see
 * `uploadRecordingBlob`). Finalize with {@link useFinalizeUpload} once uploaded.
 */
export function useCreateRecording(): UseMutationResult<
  CreateRecordingResponse,
  StapelApiError,
  CreateRecordingRequest
> {
  const api = useRecordingsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    CreateRecordingResponse,
    StapelApiError,
    CreateRecordingRequest
  > = {
    mutationFn: (body) => api.createRecording(body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recordingsQueryKeys.all });
    },
  };
  return useMutation(options);
}

/** Variables for {@link useFinalizeUpload}. */
export interface FinalizeUploadVariables {
  readonly recordingId: string;
  /** The uploaded object's size in bytes; omit to let the backend size it. */
  readonly fileSizeBytes?: number;
}

/**
 * Finalize the upload and enqueue the transcription pipeline — returns the
 * updated recording. Call AFTER the media blob has been PUT to the session's
 * presigned URL. Fails `error.400.recording_invalid_state` if the recording is
 * not awaiting finalize.
 */
export function useFinalizeUpload(): UseMutationResult<
  Recording,
  StapelApiError,
  FinalizeUploadVariables
> {
  const api = useRecordingsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Recording,
    StapelApiError,
    FinalizeUploadVariables
  > = {
    mutationFn: (vars) =>
      api.finalizeUpload(
        vars.recordingId,
        vars.fileSizeBytes !== undefined
          ? { file_size_bytes: vars.fileSizeBytes }
          : undefined
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recordingsQueryKeys.all });
    },
  };
  return useMutation(options);
}

/**
 * Re-run the whole pipeline for a finished recording — a second transcription
 * and a second bill, allowed only from `completed`. Resolves to the updated
 * recording (now back on `queued`), so the detail read starts polling again the
 * moment the invalidation lands.
 *
 * The refusals are NOT interchangeable and a skin must not collapse them: `409
 * recording_invalid_state` is "not from this status", `403
 * recording_action_denied` is "the policy says no", `402
 * recording_payment_required` is "the policy says no BECAUSE the balance is
 * spent" — a top-up prompt, not a dead end — and `404` is the bare-`bool`
 * policy's uniform refusal.
 */
export function useReprocess(): UseMutationResult<
  Recording,
  StapelApiError,
  string
> {
  const api = useRecordingsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Recording, StapelApiError, string> = {
    mutationFn: (recordingId) => api.reprocess(recordingId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recordingsQueryKeys.all });
    },
  };
  return useMutation(options);
}

/**
 * Regenerate ONE recording's summary — the user's own cheap verb for "the
 * transcript is right, only the summary is stale".
 *
 * Resolves to a {@link Job}, because `202` means ACCEPTED, not done. The
 * backend is idempotent (a second POST while one is in flight answers with the
 * same job id), and the UI must look idempotent too: hold the receipt and keep
 * the control disabled while that job is in flight, so a double click reads as
 * one action rather than two summaries the user will be billed for.
 */
export function useResummarize(): UseMutationResult<Job, StapelApiError, string> {
  const api = useRecordingsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<Job, StapelApiError, string> = {
    mutationFn: (recordingId) => api.resummarize(recordingId),
    onSuccess: () => {
      // The summary is not here yet — but the recording's own read is the only
      // place it will appear, and that read polls. Invalidating starts it.
      void queryClient.invalidateQueries({ queryKey: recordingsQueryKeys.all });
    },
  };
  return useMutation(options);
}

/** Variables for {@link useUnlockShare}. */
export interface UnlockShareVariables {
  readonly linkToken: string;
  readonly passcode: string;
}

/**
 * Exchange a share's passcode for a time-limited unlock token.
 *
 * Anonymous, so it invalidates the SHARE root only — an unlock has nothing to
 * say about the signed-in owner's recordings, and touching their cache from a
 * public page would be a leak of one surface into the other.
 */
export function useUnlockShare(): UseMutationResult<
  ShareUnlock,
  StapelApiError,
  UnlockShareVariables
> {
  const api = useRecordingsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    ShareUnlock,
    StapelApiError,
    UnlockShareVariables
  > = {
    mutationFn: (vars) => api.unlockShare(vars.linkToken, vars.passcode),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: recordingsQueryKeys.allShares,
      });
    },
  };
  return useMutation(options);
}
