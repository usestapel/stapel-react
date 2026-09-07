import { useCallback, useRef, useState } from "react";
import type { ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { Recording, UploadLimits, UploadSession } from "../api/types.js";
import {
  UploadPreflightError,
  isAcceptedMediaType,
  isAllowedUploadName,
  isUploadExpired,
  uploadRecordingBlob,
} from "../api/extensions.js";
import type { UploadProgress, UploadPreflightReason } from "../api/extensions.js";
import { useCreateRecording, useFinalizeUpload } from "../model/mutations.js";
import { useUploadLimits } from "../model/queries.js";
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
   * title, no workspace, a file this deployment does not accept, a file over
   * the size it accepts. A gate, never a `disabled` boolean — the reason is
   * shown beside the button.
   */
  readonly gate: ActionAvailability;
  /**
   * What this deployment accepts and what it keeps, or `null` while the read
   * is in flight. Read BEFORE the picker: a skin builds its `accept` from
   * `allowed_extensions` and can say what an hour costs from
   * `stored_bytes_per_hour` without waiting for a refusal to teach it.
   */
  readonly limits: UploadLimits | null;
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
 *  - **checks the size ceiling before the round-trip — and before the picker.**
 *    `GET /recordings/upload-limits` (backend 0.22.0) says what this
 *    deployment accepts and what it keeps, so an over-size or unsupported file
 *    is refused with the real numbers the moment it is chosen; the session's
 *    own `max_size_bytes` is checked again when it opens, as the authority.
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
  const limitsQuery = useUploadLimits();
  const limits = limitsQuery.data ?? null;
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

  const gate = uploadGate({ file, title: draft.title, workspaceId, limits });

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
          "file is over the session ceiling",
          { sizeBytes: file.size, limitBytes: created.upload.max_size_bytes }
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
    limits,
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
 * The two numbers a `too_large` refusal is about, in bytes, or `null`.
 *
 * A skin formats them (`useRecordingsFormat().bytes`) and interpolates them
 * into the copy, so "that file is too big" becomes the deployment's real
 * ceiling. `null` for every other reason: there is no number to print.
 */
export function uploadPreflightBytes(
  error: unknown
): { readonly size: number; readonly limit: number } | null {
  if (!(error instanceof UploadPreflightError)) return null;
  if (error.sizeBytes === undefined || error.limitBytes === undefined) return null;
  return { size: error.sizeBytes, limit: error.limitBytes };
}

/**
 * Can this draft be uploaded, and if not, why not — in the order a person
 * would be told: pick a workspace, pick a file, name it, and only then the
 * quibbles about the file itself.
 *
 * `limits` is what the deployment answered on `GET /recordings/upload-limits`;
 * with it in hand the type check is the deployment's own extension allowlist
 * and the size check happens HERE rather than after a session has been opened
 * and bytes sent. Without it the gate falls back to the MIME-prefix guess and
 * lets the backend be the authority — a pair that has not read the limits must
 * not invent a refusal.
 *
 * Exported so a skin's button and a host's own affordance cannot disagree.
 */
export function uploadGate(input: {
  readonly file: File | null;
  readonly title: string;
  readonly workspaceId: string | undefined;
  readonly limits?: UploadLimits | null;
}): ActionAvailability {
  const limits = input.limits ?? null;
  const file = input.file;
  return firstBlock(
    input.workspaceId === undefined || input.workspaceId === ""
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoWorkspace)
      : actionAvailable(),
    file === null
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoFile)
      : actionAvailable(),
    input.title.trim() === ""
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderBlockedNoTitle)
      : actionAvailable(),
    file !== null &&
      !(limits !== null
        ? isAllowedUploadName(file.name, limits)
        : isAcceptedMediaType(file.type))
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderUnsupportedType)
      : actionAvailable(),
    file !== null && limits !== null && file.size > limits.max_upload_bytes
      ? actionBlocked(RECORDINGS_I18N_KEYS.uploaderTooLarge)
      : actionAvailable()
  );
}
