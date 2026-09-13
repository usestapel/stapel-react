/**
 * One file in, one CDN key out — the shape every OTHER module needs.
 *
 * `useUploadImage` is the avatar/cover slot and narrows its bag to an image
 * row; `useUploadQueue` is the gallery. Neither is what a chat composer wants:
 * a chat attaches a photo, a clip, a document and a voice note through one
 * control, stores `<type>/<hash>` on a message, and needs the RENDER SNAPSHOT
 * back so the bubble it draws optimistically is the same shape the bubble the
 * server sends back will be. That is this hook, and it is deliberately the
 * general one: `target` decides the intake, nothing here is narrowed to a
 * medium.
 *
 * ── What "descriptor" means, and why it is not a second round trip ─────────
 *
 * Since stapel-cdn 0.16.0 every upload response carries `render_meta` inline —
 * the same snapshot `POST /describe/` answers with. So a caller that has just
 * uploaded already HOLDS the aspect, the 16px preview and the variant ladder,
 * and a component that asked `describe` for a reference it created itself
 * would be paying a round trip for bytes it was handed. {@link
 * MediaUploadBag.descriptor} is that snapshot, `null` only on a deployment
 * that predates it (the pair's pin is a RANGE — see `api/types.ts`).
 *
 * ── Blobs, and the name a recording does not have ─────────────────────────
 *
 * A `MediaRecorder` produces a `Blob`, not a `File`, and the intake gate is
 * written over `File.name` (the extension allowlist). So this hook accepts
 * either and names an unnamed blob itself — see {@link asFile}. The name is
 * not cosmetic: it is what `validateFile` reads, what the server stores as
 * `original_filename`, and what the document arm of an attachment renders.
 *
 * ── No percentage, on purpose ─────────────────────────────────────────────
 *
 * `phase` is the progress. `model/upload.ts` states the whole argument: there
 * is no honest byte-percentage behind `fetch`, and the two ways to show a
 * moving bar anyway are a second transport or a number nobody measured. A
 * pending chip shows the STEP.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toStapelApiError, useObjectUrlPreview } from "@stapel/core";
import type { StapelApiError } from "@stapel/core";
import type {
  CdnFileKind,
  CdnMediaRow,
  CdnRef,
  CdnRenderMeta,
  CdnVariantsStatus,
} from "../api/types.js";
import { useCdnRuntime } from "../model/context.js";
import type { CdnIntakeLimits } from "../model/limits.js";
import { isUploadCanceled, runUpload } from "../model/upload.js";
import type {
  CdnUploadTarget,
  DedupSkipReason,
  UploadPhase,
} from "../model/upload.js";

/** What one finished upload hands a caller. */
export interface MediaUploadResult {
  /**
   * `<type>/<hash>` — the OPAQUE value a consuming module stores. stapel-chat
   * calls this field `key` on `SendMessageRequest.attachments[]`; it is the
   * same string, and neither side builds a URL out of it.
   */
  readonly key: CdnRef;
  /** The render snapshot, inline on the upload response. */
  readonly descriptor: CdnRenderMeta | null;
  readonly row: CdnMediaRow;
  readonly kind: CdnFileKind;
  readonly deduped: boolean;
  readonly variantsReady: boolean;
}

export interface MediaUploadBag {
  /**
   * Upload one pick. Resolves the result, or `null` when it failed or was
   * canceled — {@link error} and {@link phase} say which, and they are
   * different outcomes: a cancel is not an error and must not raise one.
   */
  upload(
    source: File | Blob,
    options?: MediaUploadCallOptions
  ): Promise<MediaUploadResult | null>;
  /** Abort the upload in flight. Resolves that call's promise with `null`. */
  cancel(): void;
  /** Forget the pick, its preview, its result and its error. */
  reset(): void;
  /**
   * A local object URL for the bytes being uploaded — render it the instant
   * the pick happens, long before any server has seen it. Revoked when the
   * pick changes and on unmount by construction (core's `useObjectUrlPreview`).
   */
  readonly previewUrl: string | null;
  readonly phase: UploadPhase;
  readonly isPending: boolean;
  readonly key: CdnRef | null;
  readonly descriptor: CdnRenderMeta | null;
  readonly row: CdnMediaRow | null;
  readonly kind: CdnFileKind | null;
  readonly deduped: boolean;
  /** `undefined` when the pre-check ran; a reason when it did not. */
  readonly dedupSkipped: DedupSkipReason | undefined;
  readonly variantsReady: boolean;
  readonly variantsStatus: CdnVariantsStatus | null;
  readonly error: StapelApiError | null;
}

export interface MediaUploadCallOptions {
  /** Override the hook's target for this one call (one control, four intakes). */
  readonly target?: CdnUploadTarget;
  /**
   * The filename to give a `Blob` that has none. Ignored for a `File`, which
   * brings its own — renaming somebody's pick would lose the extension the
   * server stores and the document arm renders.
   */
  readonly name?: string;
}

export interface UseMediaUploadOptions {
  /** Default intake. `{kind: "image"}` when omitted. */
  readonly target?: CdnUploadTarget;
}

/**
 * Which ceilings a target is measured against.
 *
 * The runtime publishes three intakes because stapel-cdn declares three
 * (`MAX_IMAGE_SIZE` / `MAX_VIDEO_SIZE` / `MAX_FILE_SIZE`). Reading the wrong
 * one is not a rounding error: it would refuse a 30 MB clip against the image
 * ceiling, which is the one thing `model/limits.ts` says a mirror must never
 * do.
 */
export function limitsForTarget(
  target: CdnUploadTarget,
  limits: {
    readonly image: CdnIntakeLimits;
    readonly video: CdnIntakeLimits;
    readonly file: CdnIntakeLimits;
  }
): CdnIntakeLimits {
  switch (target.kind) {
    case "video":
      return limits.video;
    case "file":
      return limits.file;
    default:
      return limits.image;
  }
}

/**
 * A `File` for the gate to read, whatever arrived.
 *
 * A `Blob` from `MediaRecorder` has a `type` and no name at all, and
 * `validateFile` refuses a nameless file on the extension rule — correctly,
 * because the SERVER refuses it too. Naming it here is the one place that
 * knows both halves: the caller supplies the name it wants stored, and the
 * fallback is derived from the blob's own MIME rather than guessed, so a
 * recording that came back as `audio/ogg` is not stored as `.webm`.
 */
export function asFile(source: File | Blob, name: string | undefined): File {
  if (source instanceof File && source.name !== "") return source;
  const chosen =
    name !== undefined && name !== "" ? name : `upload${extensionForMime(source.type)}`;
  return new File([source], chosen, {
    ...(source.type !== "" ? { type: source.type } : {}),
  });
}

/**
 * The extension a MIME type implies, for the fallback name only.
 *
 * Deliberately short and deliberately not a lookup of every media type in
 * existence: a caller that cares supplies `name`. The entries are the ones a
 * browser actually produces from `MediaRecorder` plus the two image types a
 * canvas export produces, and an unknown MIME yields `""` — which the gate
 * then refuses with the server's own `error.400.invalid_format`, rather than
 * this function inventing an extension that makes an unsupported file look
 * supported.
 */
function extensionForMime(mime: string): string {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  switch (base) {
    case "audio/webm":
    case "video/webm":
      return ".webm";
    case "audio/ogg":
    case "video/ogg":
      return ".ogg";
    case "audio/mp4":
    case "video/mp4":
      return ".mp4";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    default:
      return "";
  }
}

/** The snapshot the row was handed with, or `null` on a pre-0.16 deployment. */
function descriptorOf(row: CdnMediaRow): CdnRenderMeta | null {
  return row.render_meta ?? null;
}

export function useMediaUpload(options?: UseMediaUploadOptions): MediaUploadBag {
  const runtime = useCdnRuntime();
  const defaultTarget: CdnUploadTarget = options?.target ?? { kind: "image" };

  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [key, setKey] = useState<CdnRef | null>(null);
  const [descriptor, setDescriptor] = useState<CdnRenderMeta | null>(null);
  const [row, setRow] = useState<CdnMediaRow | null>(null);
  const [kind, setKind] = useState<CdnFileKind | null>(null);
  const [deduped, setDeduped] = useState(false);
  const [dedupSkipped, setDedupSkipped] = useState<DedupSkipReason | undefined>(
    undefined
  );
  const [variantsReady, setVariantsReady] = useState(false);
  const [variantsStatus, setVariantsStatus] = useState<CdnVariantsStatus | null>(
    null
  );
  const [error, setError] = useState<StapelApiError | null>(null);
  const previewUrl = useObjectUrlPreview(file);

  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);

  const runtimeRef = useRef(runtime);
  runtimeRef.current = runtime;
  const targetRef = useRef(defaultTarget);
  targetRef.current = defaultTarget;

  const upload = useCallback(
    async (
      source: File | Blob,
      call?: MediaUploadCallOptions
    ): Promise<MediaUploadResult | null> => {
      controller.current?.abort();
      const own = new AbortController();
      controller.current = own;

      const target = call?.target ?? targetRef.current;
      const picked = asFile(source, call?.name);

      setFile(picked);
      setKey(null);
      setDescriptor(null);
      setRow(null);
      setKind(null);
      setDeduped(false);
      setDedupSkipped(undefined);
      setVariantsReady(false);
      setVariantsStatus(null);
      setError(null);
      setPhase("hashing");

      const current = runtimeRef.current;
      try {
        const outcome = await runUpload(current.api, picked, {
          target,
          limits: limitsForTarget(target, current.limits),
          signal: own.signal,
          onPhase: (next) => {
            if (!alive.current || own.signal.aborted) return;
            // The three terminal phases are set by the arms below, from the
            // outcome — never from the callback, which fires before this hook
            // knows whether the promise resolved or threw.
            if (next === "done" || next === "failed" || next === "canceled") return;
            setPhase(next);
          },
          ...(current.variants !== undefined ? { variants: current.variants } : {}),
        });
        const result: MediaUploadResult = {
          key: outcome.ref,
          descriptor: descriptorOf(outcome.row),
          row: outcome.row,
          kind: outcome.kind,
          deduped: outcome.deduped,
          variantsReady: outcome.variantsReady,
        };
        if (!alive.current) return result;
        setKey(result.key);
        setDescriptor(result.descriptor);
        setRow(outcome.row);
        setKind(outcome.kind);
        setDeduped(outcome.deduped);
        setDedupSkipped(outcome.dedupSkipped);
        setVariantsReady(outcome.variantsReady);
        setVariantsStatus(outcome.variantsStatus);
        setPhase("done");
        return result;
      } catch (failure) {
        if (!alive.current) return null;
        if (isUploadCanceled(failure)) {
          setPhase("canceled");
          return null;
        }
        setError(toStapelApiError(failure));
        setPhase("failed");
        return null;
      }
    },
    []
  );

  const cancel = useCallback((): void => {
    controller.current?.abort();
  }, []);

  const reset = useCallback((): void => {
    controller.current?.abort();
    setFile(null);
    setPhase("idle");
    setKey(null);
    setDescriptor(null);
    setRow(null);
    setKind(null);
    setDeduped(false);
    setDedupSkipped(undefined);
    setVariantsReady(false);
    setVariantsStatus(null);
    setError(null);
  }, []);

  return {
    upload,
    cancel,
    reset,
    previewUrl,
    phase,
    isPending:
      phase === "hashing" ||
      phase === "checking" ||
      phase === "uploading" ||
      phase === "processing",
    key,
    descriptor,
    row,
    kind,
    deduped,
    dedupSkipped,
    variantsReady,
    variantsStatus,
    error,
  };
}
