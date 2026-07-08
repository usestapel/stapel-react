import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import type {
  CreateRecordingRequest,
  Recording,
  UploadSession,
} from "../api/types.js";
import { useCreateRecording } from "../model/mutations.js";

/** Render-prop bag for {@link RecordingComposer}. */
export interface RecordingComposerBag {
  /** Create a recording and open its upload session. */
  create(body: CreateRecordingRequest): void;
  /** A create call is in flight. */
  readonly isCreating: boolean;
  /** The created recording echoed by the server, else null. */
  readonly recording: Recording | null;
  /**
   * The single-PUT upload session opened for {@link RecordingComposerBag.recording},
   * else null. PUT the media at `upload.presigned_url` (see `uploadRecordingBlob`),
   * then finalize (see {@link UploadFinalizer}).
   */
  readonly upload: UploadSession | null;
  /** The create call failed. */
  readonly isError: boolean;
  /** The error, when `isError` (a localizable `StapelApiError`), else null. */
  readonly error: StapelApiError | null;
  /** Clear the mutation state (e.g. to compose another recording). */
  reset(): void;
}

/**
 * Headless recording composer — renderless wrapper over the create-recording
 * mutation, step 1 of create → upload → finalize. Hands a
 * {@link RecordingComposerBag} to `children`; bring your own form (title,
 * workspace, source type, language). Zero visual opinion (frontend-standard §2).
 * On success the pair invalidates the list read, and the bag exposes the opened
 * `upload` session for the caller to PUT the media at.
 *
 * ```tsx
 * <RecordingComposer>
 *   {({ create, upload }) => ( ... )}
 * </RecordingComposer>
 * ```
 */
export function RecordingComposer(props: {
  children: (bag: RecordingComposerBag) => ReactNode;
}): ReactNode {
  const mutation = useCreateRecording();
  return props.children({
    create: (body) => {
      mutation.mutate(body);
    },
    isCreating: mutation.isPending,
    recording: mutation.data?.recording ?? null,
    upload: mutation.data?.upload ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
