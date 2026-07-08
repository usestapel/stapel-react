import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type { Recording } from "../api/types.js";
import { useFinalizeUpload } from "../model/mutations.js";

/** Render-prop bag for {@link UploadFinalizer}. */
export interface UploadFinalizerBag {
  /**
   * Finalize the upload and enqueue the pipeline. Call AFTER the media blob has
   * been PUT to the session's presigned URL. `fileSizeBytes` is optional (the
   * backend can size the stored object itself).
   */
  finalize(fileSizeBytes?: number): void;
  /** A finalize call is in flight. */
  readonly isFinalizing: boolean;
  /** The updated recording echoed by the server after finalize, else null. */
  readonly recording: Recording | null;
  /** The finalize call failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Clear the mutation state. */
  reset(): void;
}

/**
 * Headless upload finalizer — renderless wrapper over the finalize mutation for
 * one recording, step 3 of create → upload → finalize. Hands an
 * {@link UploadFinalizerBag} to `children`; bring your own "done uploading"
 * control. Zero visual opinion (frontend-standard §2). A finalize on a recording
 * that is not awaiting it fails `error.400.recording_invalid_state` — branch on
 * the surfaced error.
 *
 * ```tsx
 * <UploadFinalizer recordingId={recording.id}>
 *   {({ finalize, isFinalizing }) => ( ... )}
 * </UploadFinalizer>
 * ```
 */
export function UploadFinalizer(props: {
  recordingId: string;
  children: (bag: UploadFinalizerBag) => ReactNode;
}): ReactNode {
  const { recordingId } = props;
  const mutation = useFinalizeUpload();
  return props.children({
    finalize: (fileSizeBytes) => {
      mutation.mutate(
        fileSizeBytes !== undefined
          ? { recordingId, fileSizeBytes }
          : { recordingId }
      );
    },
    isFinalizing: mutation.isPending,
    recording: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
