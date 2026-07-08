import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  UseMutationOptions,
  UseMutationResult,
} from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  CreateRecordingRequest,
  CreateRecordingResponse,
  Recording,
} from "../api/types.js";
import { useRecordingsApi } from "./context.js";
import { recordingsQueryKeys } from "./queryKeys.js";

/**
 * Write hooks (frontend-standard §2 — "мутации с инвалидацией"). A created
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
