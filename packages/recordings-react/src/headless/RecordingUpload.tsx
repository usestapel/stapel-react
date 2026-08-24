import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Recording, UploadSession } from "../api/types.js";
import {
  UploadPreflightError,
  isAcceptedMediaType,
  isUploadExpired,
  uploadRecordingBlob,
} from "../api/extensions.js";
import type { UploadProgress, UploadPreflightReason } from "../api/extensions.js";
import { useCreateRecording, useFinalizeUpload } from "../model/mutations.js";
import { RECORDINGS_I18N_KEYS } from "../i18n/keys.js";

/**
 * Where the upload is. One machine, five states — `create → upload →
 * finalize` is ONE user act, and a host wiring the three calls by hand is how
 * a half-uploaded recording gets stranded with no transcript and no way back.
 */
export type UploadStep =
  | "idle"
  | "creating"
  | "uploading"
  | "finalizing"
  | "done";

/** The draft a caller edits before starting. */
export interface RecordingDraft {
  readonly title: string;
  readonly sourceType: string;
  /** BCP-47 tag, or `null` to let the pipeline detect it. */
  readonly language: string | null;
  readonly diarizationEnabled: boolean;
}

/** Render-prop bag for {@link RecordingUpload}. */
export interface RecordingUploadBag {
  readonly step: UploadStep;
  /** The chosen media file, or `null`. */
  readonly file: File | null;
  setFile(file: File | null): void;
  readonly draft: RecordingDraft;
  /** Patch one or more draft fields (the form is controlled by the caller). */
  patchDraft(patch: Partial<RecordingDraft>): void;
  /**
   * Whether starting is possible, with the reason when it is not: no file, no
   * title, no workspace, a file that is not audio or video. A gate, never a
   * `disabled` boolean — the reason is shown beside the button.
   */
  readonly gate: ActionAvailability;
  /** Run the whole act: create the recording, PUT the media, finalize. */
  start(): void;
  /** Abort an upload in flight (the PUT only — the recording stays created). */
  cancel(): void;
  /** Bytes out of bytes, while `step === "uploading"`. */
  readonly progress: UploadProgress | null;
  /** The recording, once created — echoed again after finalize. */
  readonly recording: Recording | null;
  /** The session opened for it, so a caller can see the size ceiling/expiry. */
  readonly session: UploadSession | null;
  /** The failure, if the act stopped. Fold it with the pair's error helpers. */
  readonly error: unknown;
  /** Back to `idle`, keeping nothing. */
  reset(): void;
}

const EMPTY_DRAFT: RecordingDraft = {
  title: "",
  sourceType: "upload",
  language: null,
  diarizationEnabled: true,
};

/**
 * Headless recording uploader — the whole `create → upload → finalize` act as
 * ONE renderless machine.
 *
 * Three things it does that a host wiring the calls by hand does not:
 *
 *  - **checks the size ceiling before the round-trip.** `max_size_bytes` comes
 *    back with the session, so an over-size file is caught the moment the
 *    session opens instead of after minutes of upload and a `413`.
 *  - **refuses to PUT into a dead session.** `expires_at` is checked
 *    immediately before the PUT; an expired window means create again, not
 *    push bytes at a URL that no longer signs.
 *  - **reports progress.** A single unresumable `fetch` PUT of meeting-length
 *    audio is a frozen button for minutes; this reports bytes as they leave.
 *
 * ```tsx
 * <RecordingUpload workspaceId={ws}>
 *   {({ gate, start, progress, step }) => …}
 * </RecordingUpload>
 * ```
 */
export function RecordingUpload(props: {
  /** The workspace the recording is created in. Absent = the gate says so. */
  workspaceId?: string;
  /** Called once the pipeline has been enqueued (e.g. to route to the detail). */
  onFinalized?: (recording: Recording) => void;
  children: (bag: RecordingUploadBag) => ReactNode;
}): ReactNode {
  const { workspaceId, onFinalized } = props;
  const create = useCreateRecording();
  const finalize = useFinalizeUpload();
  const [file, setFile] = useState<File | null>(null);
  const [draft, setDraft] = useState<RecordingDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState<UploadStep>("idle");
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [session, setSession] = useState<UploadSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const abortRef = useRef<AbortController | null>(null);

  const patchDraft = useCallback((patch: Partial<RecordingDraft>): void => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setDraft(EMPTY_DRAFT);
    setStep("idle");
    setProgress(null);
    setRecording(null);
    setSession(null);
    setError(null);
    create.reset();
    finalize.reset();
  }, [create, finalize]);

  const cancel = useCallback((): void => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStep("idle");
    setProgress(null);
  }, []);

  const gate = uploadGate({ file, title: draft.title, workspaceId });

  const start = useCallback((): void => {
    if (!gate.available || file === null || workspaceId === undefined) return;
    setError(null);
    setProgress(null);
    setStep("creating");
    const controller = new AbortController();
    abortRef.current = controller;
    const run = async (): Promise<void> => {
      const created = await create.mutateAsync({
        workspace_id: workspaceId,
        title: draft.title,
        source_type: draft.sourceType,
        language: draft.language,
        diarization_enabled: draft.diarizationEnabled,
        filename: file.name,
      });
      setRecording(created.recording);
      setSession(created.upload);
      if (file.size > created.upload.max_size_bytes) {
        throw new UploadPreflightError(
          "too_large",
          "file is over the session ceiling"
        );
      }
      if (isUploadExpired(created.upload)) {
        throw new UploadPreflightError(
          "session_expired",
          "the upload session's window has closed"
        );
      }
      setStep("uploading");
      await uploadRecordingBlob(created.upload, file, {
        contentType: file.type,
        signal: controller.signal,
        onProgress: setProgress,
      });
      setStep("finalizing");
      const finalized = await finalize.mutateAsync({
        recordingId: created.recording.id,
        fileSizeBytes: file.size,
      });
      setRecording(finalized);
      setStep("done");
      onFinalized?.(finalized);
    };
    void run().catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setError(cause);
      setStep("idle");
    });
  }, [create, draft, file, finalize, gate.available, onFinalized, workspaceId]);

  return props.children({
    step,
    file,
    setFile,
    draft,
    patchDraft,
    gate,
    start,
    cancel,
    progress,
    recording,
    session,
    error,
    reset,
  });
}

/** Reason → the i18n key that says it. The one mapping, so the machine's
 * refusals and the skin's copy cannot drift. */
const PREFLIGHT_KEYS: Readonly<Record<UploadPreflightReason, string>> = {
  too_large: RECORDINGS_I18N_KEYS.uploaderTooLarge,
  session_expired: RECORDINGS_I18N_KEYS.uploaderSessionExpired,
  unsupported_type: RECORDINGS_I18N_KEYS.uploaderUnsupportedType,
};

/**
 * The i18n key for a local upload refusal, or `undefined` when the failure is
 * not one — a transport fault or a backend error, which the pair's normal
 * error path already renders.
 */
export function uploadPreflightKey(error: unknown): string | undefined {
  return error instanceof UploadPreflightError
    ? PREFLIGHT_KEYS[error.reason]
    : undefined;
}

/**
 * Can this draft be uploaded, and if not, why not — in the order a person
 * would be told: pick a workspace, pick a file, name it, and only then the
 * quibble about the file's type.
 *
 * Exported so a skin's button and a host's own affordance cannot disagree.
 */
export function uploadGate(input: {
  readonly file: File | null;
  readonly title: string;
  readonly workspaceId: string | undefined;
}): ActionAvailability {
  return firstBlock(
    input.workspaceId === undefined || input.workspaceId === ""
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoWorkspace)
      : actionAvailable(),
    input.file === null
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoFile)
      : actionAvailable(),
    input.title.trim() === ""
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoTitle)
      : actionAvailable(),
    input.file !== null && !isAcceptedMediaType(input.file.type)
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderUnsupportedType)
      : actionAvailable()
  );
}
