/**
 * `useVoiceUpload` — a recorded clip in, `audio/<hash>` and a length out.
 *
 * The third of the three problems a voice message is (`useMediaRecorder`
 * captures, this stores, the consuming module says). It is `useMediaUpload`
 * pointed at the audio intake, plus the two things a recording needs that a
 * picked file does not:
 *
 * 1. **A name.** A `MediaRecorder` blob has a MIME and nothing else, and the
 *    intake gate — client mirror and server alike — reads the EXTENSION. The
 *    clip already knows which container the engine chose (`clip.extension`,
 *    derived from the engine's own `mimeType`), so the name is built from
 *    that rather than re-guessed from the MIME here: a recording that came
 *    back as `audio/ogg` is stored as `.ogg`, and an AAC one as `.m4a`, which
 *    is what `ALLOWED_AUDIO_EXTENSIONS` spells it.
 * 2. **A duration, stated honestly.** stapel-cdn measures the length with
 *    ffprobe AFTER the row exists, so the 201 carries `duration: null`. The
 *    clip's own wall-clock length is the right OPTIMISTIC value — it is what
 *    the bubble draws until the server's number lands — and
 *    {@link VoiceUploadResult.measured} says which of the two the caller is
 *    holding, because "9 seconds by this phone's clock" and "9 seconds by
 *    ffprobe" are different facts that agree almost always.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CdnAudio, CdnRef, CdnRenderMeta } from "../api/types.js";
import type { RecordedClip } from "../model/recording.js";
import { useMediaUpload } from "./useMediaUpload.js";
import type { MediaUploadBag } from "./useMediaUpload.js";

/** What a stored voice message is, to the module that will say it. */
export interface VoiceUploadResult {
  /** `audio/<hash>` — the OPAQUE value a message stores (`key` in stapel-chat). */
  readonly key: CdnRef;
  /**
   * The length to draw, in milliseconds: the server's measurement when it had
   * already happened by the time the row came back, else the clip's own clock.
   */
  readonly durationMs: number;
  /** Whether {@link durationMs} is the server's ffprobe number or the client's clock. */
  readonly measured: boolean;
  /** The render snapshot inline on the upload response. */
  readonly descriptor: CdnRenderMeta | null;
  /** The stored row. */
  readonly row: CdnAudio;
  /** The clip that was sent — its blob, its container, its own clock. */
  readonly clip: RecordedClip;
  /** The pre-check hit: these bytes were already stored and nothing was sent. */
  readonly deduped: boolean;
}

export interface VoiceUploadCallOptions {
  /** The filename to store. Default: {@link voiceFileName}. */
  readonly name?: string;
}

export interface VoiceUploadBag {
  /**
   * Store one clip. Resolves the result, or `null` when the upload failed or
   * was canceled — {@link error} and {@link phase} say which.
   */
  upload(
    clip: RecordedClip,
    options?: VoiceUploadCallOptions
  ): Promise<VoiceUploadResult | null>;
  /** Abort the upload in flight. */
  cancel(): void;
  /** Forget the clip, its result and its error. */
  reset(): void;
  readonly phase: MediaUploadBag["phase"];
  readonly isPending: boolean;
  readonly error: MediaUploadBag["error"];
  /** The last stored voice message, until reset. */
  readonly result: VoiceUploadResult | null;
}

/**
 * The name a recording is stored under. Timestamped so two takes in the same
 * thread do not both read `voice.webm` in a download list; the extension is
 * the clip's own, which is the one the intake allowlist reads.
 */
export function voiceFileName(clip: RecordedClip, at: Date = new Date()): string {
  const stamp = at.toISOString().replace(/[:.]/g, "-").replace(/Z$/, "");
  const extension = clip.extension !== "" ? clip.extension : ".webm";
  return `voice-${stamp}${extension}`;
}

/** The length the row already carries, in ms, or `null` while unmeasured. */
function measuredMs(row: CdnAudio): number | null {
  const fromMeta = row.render_meta?.duration_ms;
  if (typeof fromMeta === "number" && fromMeta >= 0) return fromMeta;
  if (typeof row.duration === "number" && row.duration >= 0) {
    return Math.round(row.duration * 1000);
  }
  return null;
}

export function useVoiceUpload(): VoiceUploadBag {
  const media = useMediaUpload({ target: { kind: "audio" } });
  const { upload: uploadMedia, cancel, reset: resetMedia, phase, isPending, error } = media;
  const [result, setResult] = useState<VoiceUploadResult | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const upload = useCallback(
    async (
      clip: RecordedClip,
      options?: VoiceUploadCallOptions
    ): Promise<VoiceUploadResult | null> => {
      setResult(null);
      const stored = await uploadMedia(clip.blob, {
        target: { kind: "audio" },
        name: options?.name ?? voiceFileName(clip),
      });
      if (stored === null) return null;
      // `kind` is the flow's own statement about which model came back, and
      // the audio target can only ever produce the audio row — so this is a
      // narrowing of a value the flow already discriminated, not a sniff.
      const row = stored.row as CdnAudio;
      const measured = measuredMs(row);
      const voice: VoiceUploadResult = {
        key: stored.key,
        durationMs: measured ?? clip.durationMs,
        measured: measured !== null,
        descriptor: stored.descriptor,
        row,
        clip,
        deduped: stored.deduped,
      };
      if (alive.current) setResult(voice);
      return voice;
    },
    [uploadMedia]
  );

  const reset = useCallback((): void => {
    resetMedia();
    setResult(null);
  }, [resetMedia]);

  return {
    upload,
    cancel,
    reset,
    phase,
    isPending,
    error,
    result,
  };
}
