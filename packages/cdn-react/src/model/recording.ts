/**
 * The recording rules that are decisions rather than DOM calls — picked apart
 * from the hook so they can be reasoned about (and tested) without a
 * microphone.
 *
 * ── Why the container is chosen and not assumed ────────────────────────────
 *
 * `new MediaRecorder(stream)` with no `mimeType` records in whatever the
 * engine prefers, and the engines disagree: Chromium gives `audio/webm` with
 * Opus, Firefox gives `audio/ogg` with Opus, and WebKit gives `audio/mp4` with
 * AAC. That string is not cosmetic — it decides the file EXTENSION, and the
 * extension is what stapel-cdn's intake allowlist reads. So the container is
 * chosen explicitly, from a preference order, against the engine's OWN
 * `isTypeSupported`, and the chosen string travels with the clip.
 *
 * Opus first in both containers, because it is the codec the whole point of a
 * voice message is: intelligible speech at a bitrate a phone connection can
 * push in real time. The bare containers are the fallbacks for an engine that
 * refuses a `codecs=` parameter it does support, which some do.
 *
 * ── Degradation is named, never silent ────────────────────────────────────
 *
 * Three different things all look like "the button does nothing": this page is
 * not a secure context (no `navigator.mediaDevices` at all), this engine has
 * no `MediaRecorder`, and this engine supports none of the containers above.
 * They have three different remediations — open the https page, use another
 * browser, and "report this", respectively — so they are three reasons, not
 * one `false`.
 */

/** What a recorder produced. */
export interface RecordedClip {
  /** The bytes. Upload it with `useMediaUpload`, which names it for the gate. */
  readonly blob: Blob;
  /** The container/codec actually used — the engine's answer, not a guess. */
  readonly mimeType: string;
  /** The extension that MIME implies, dot included (`".webm"`). */
  readonly extension: string;
  /**
   * How long it ran, in milliseconds, MEASURED BY THIS CLIENT'S CLOCK.
   *
   * It is a wall-clock elapsed time, not a decoded duration, and the two are
   * not the same number: a dropped frame, a suspended tab or a device that
   * started the stream late all move them apart. The authoritative duration is
   * the one stapel-cdn's ffprobe reports on the stored asset, which is why
   * `AttachmentResponse.duration_ms` exists. Send this as the optimistic value
   * a bubble draws before the server answers; do not store it as the truth.
   */
  readonly durationMs: number;
  /** Whether recording ended because it hit the caller's ceiling. */
  readonly reachedLimit: boolean;
}

/** Why a recorder cannot run, or stopped running. Each is a DIFFERENT sentence. */
export type RecorderFailure =
  /** No `navigator.mediaDevices` — an insecure origin, by the spec. */
  | "insecure_context"
  /** No `MediaRecorder` constructor in this engine. */
  | "unsupported"
  /** `isTypeSupported` refused every container this module offers. */
  | "no_codec"
  /** The person said no, or a policy said no for them. */
  | "denied"
  /** There is no microphone attached. */
  | "no_device"
  /** The device exists and is refused by something else (in use, hardware). */
  | "failed";

/**
 * Containers to try, best first. Each entry carries the extension it stores
 * as, so the choice and its consequence cannot drift apart.
 */
export const RECORDING_CANDIDATES: readonly {
  readonly mimeType: string;
  readonly extension: string;
}[] = [
  { mimeType: "audio/webm;codecs=opus", extension: ".webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: ".ogg" },
  { mimeType: "audio/webm", extension: ".webm" },
  { mimeType: "audio/ogg", extension: ".ogg" },
  { mimeType: "audio/mp4", extension: ".mp4" },
];

/** The extension a recording MIME implies, dot included, or `""`. */
export function recordingExtension(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  const match = RECORDING_CANDIDATES.find(
    (candidate) => candidate.mimeType.split(";")[0] === base
  );
  return match?.extension ?? "";
}

/**
 * The best container this engine will actually record, or `null`.
 *
 * `isTypeSupported` is a static on the constructor and is itself optional —
 * older implementations ship the recorder without it. An engine that cannot be
 * asked is given the first candidate rather than refused: refusing on the
 * absence of the QUESTION would turn "we could not check" into "it does not
 * work", which is the silent-degradation shape this fleet keeps paying for.
 */
export function pickRecordingType(
  ctor: typeof MediaRecorder | undefined
): { readonly mimeType: string; readonly extension: string } | null {
  if (ctor === undefined) return null;
  const supports = ctor.isTypeSupported;
  if (typeof supports !== "function") return RECORDING_CANDIDATES[0] ?? null;
  for (const candidate of RECORDING_CANDIDATES) {
    if (supports.call(ctor, candidate.mimeType)) return candidate;
  }
  return null;
}

/**
 * Classify what `getUserMedia` threw.
 *
 * The names are the ones the Media Capture spec defines, and the reason they
 * are read by NAME rather than by message is that the message is localized by
 * the browser and differs between them. `NotAllowedError` is the refusal —
 * from the person or from a Permissions-Policy, which are indistinguishable to
 * a page and have the same remediation. `SecurityError` is an insecure context
 * that still exposed the API.
 */
export function classifyMediaError(error: unknown): RecorderFailure {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "no_device";
    case "SecurityError":
      return "insecure_context";
    default:
      return "failed";
  }
}

/**
 * The RMS amplitude of one analyser frame, as 0..1.
 *
 * Byte time-domain data is centred on 128, so the deviation from it is the
 * signal. RMS rather than peak: a meter driven by the peak sample jumps to
 * full on a single click and reads nothing like loudness, and the whole point
 * of the bar beside a recording button is that a person can see that the
 * microphone is hearing them.
 */
export function rmsLevel(frame: Uint8Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (const sample of frame) {
    const centred = (sample - 128) / 128;
    sum += centred * centred;
  }
  return Math.min(1, Math.sqrt(sum / frame.length));
}
