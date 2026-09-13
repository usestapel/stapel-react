/**
 * `useMediaRecorder` — the microphone, as a bag.
 *
 * A voice message is three separate problems and only one of them is chat's:
 * capturing audio (this hook), storing it (`useMediaUpload`), and saying it
 * (chat's composer). This is the first, and it lives here because it is the
 * same capture whether the clip becomes a chat attachment, a listing walk-
 * through or a support note — and because a second implementation of "hold to
 * record" is a second set of the bugs below.
 *
 * ── The four things this gets right that a naive version does not ─────────
 *
 * 1. **The microphone is released.** `MediaRecorder.stop()` does not stop the
 *    tracks; the browser keeps the recording indicator lit until every track
 *    is stopped explicitly. Cancel, unmount and stop all go through the same
 *    teardown, so no exit leaves it on.
 * 2. **`stop()` resolves with the bytes.** The recorder's last chunk arrives
 *    AFTER `stop()` returns — `dataavailable` then `stop` — so a caller that
 *    reads the chunks synchronously gets a truncated clip, or none. The
 *    promise settles in the `stop` handler.
 * 3. **A refusal is a state, not an exception.** `getUserMedia` rejects with a
 *    `DOMException` whose `name` is the whole information; the hook classifies
 *    it (`model/recording.ts`) into reasons with different remediations, and
 *    the bag NAMES the one it is in. A control that can be pressed forever
 *    with nothing happening is the defect this pair's whole degradation
 *    vocabulary exists to prevent.
 * 4. **The meter is real or it is absent.** The level comes from an
 *    `AnalyserNode` over the live stream. Where `AudioContext` does not exist
 *    the bag says `levelAvailable: false` and `level` stays 0, rather than
 *    animating a number nobody measured — the same rule `model/upload.ts`
 *    applies to the upload percentage it refuses to invent.
 *
 * ── What this hook does NOT do ─────────────────────────────────────────────
 *
 * No pause/resume: `MediaRecorder.pause()` is unimplemented in enough engines
 * that a control for it would be a control that works on some phones. No
 * waveform drawing: stapel-cdn renders the waveform IMAGE for the stored clip
 * (`preview_kind: "waveform"`), so a client that drew its own would be the
 * fleet's second answer to what a clip looks like. The live `level` is a
 * meter, not a waveform, and it is gone the moment recording ends.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyMediaError,
  pickRecordingType,
  recordingExtension,
  rmsLevel,
} from "../model/recording.js";
import type { RecordedClip, RecorderFailure } from "../model/recording.js";

/** Which state the microphone is in. */
export type RecorderState =
  /** Nothing has happened, or the last clip was taken. */
  | "idle"
  /** `getUserMedia` is in flight — the permission prompt may be up. */
  | "requesting"
  | "recording"
  /** `stop()` was called; the last chunk has not arrived yet. */
  | "stopping"
  /** A clip is held and has not been taken yet. */
  | "ready"
  /** Refused. {@link MediaRecorderBag.failure} says why. */
  | "failed";

export interface MediaRecorderBag {
  /**
   * Ask for the microphone and start. Resolves when recording has begun, or
   * when it has failed — never rejects: the failure is a STATE, so a press
   * handler does not need a try/catch to avoid an unhandled rejection.
   */
  start(): Promise<void>;
  /**
   * Stop and resolve the clip. `null` when there was nothing recording, or
   * when the recorder produced no bytes at all (a press so short the engine
   * never emitted a chunk — a real case on a slow device, and a different one
   * from a failure).
   */
  stop(): Promise<RecordedClip | null>;
  /** Stop and DISCARD. The microphone is released either way. */
  cancel(): void;
  /** Drop a held clip and go back to `idle`. */
  reset(): void;
  readonly state: RecorderState;
  readonly isRecording: boolean;
  /** Milliseconds since recording began; 0 when not recording. */
  readonly elapsedMs: number;
  /** 0..1 RMS of the live signal, or 0 when {@link levelAvailable} is false. */
  readonly level: number;
  /** Whether this engine let the hook build a meter at all. */
  readonly levelAvailable: boolean;
  /** The last clip, until it is taken or reset. */
  readonly clip: RecordedClip | null;
  /** Why it is not recording, when that is the reason. */
  readonly failure: RecorderFailure | null;
  /**
   * Whether this page could record AT ALL, decided before any press: a secure
   * context, a `MediaRecorder`, and a container it will encode. `false` means
   * the control should say why rather than wait to be pressed.
   */
  readonly supported: boolean;
  /** The reason `supported` is false, known without asking for the device. */
  readonly unsupportedReason: RecorderFailure | null;
}

export interface UseMediaRecorderOptions {
  /**
   * Stop automatically after this many milliseconds. A clip that ends this way
   * carries `reachedLimit: true`, so the UI can SAY it stopped rather than let
   * a person keep talking at a recorder that already ended.
   */
  readonly maxMs?: number;
  /** How often the elapsed time and the meter update. Default 100 ms. */
  readonly tickMs?: number;
  /** Extra constraints merged into `{ audio: true }`. */
  readonly constraints?: MediaTrackConstraints;
}

const DEFAULT_TICK_MS = 100;

/** What the capture holds while it runs — one object, one teardown. */
interface Capture {
  readonly recorder: MediaRecorder;
  readonly stream: MediaStream;
  readonly chunks: Blob[];
  readonly mimeType: string;
  readonly extension: string;
  readonly startedAt: number;
  audio: { context: AudioContext; analyser: AnalyserNode } | null;
  timer: ReturnType<typeof setInterval> | null;
  settle: ((clip: RecordedClip | null) => void) | null;
  discarded: boolean;
  reachedLimit: boolean;
}

/** What this engine can do, asked once and without touching a device. */
function probeSupport(): {
  supported: boolean;
  reason: RecorderFailure | null;
  mimeType: string;
  extension: string;
} {
  const absent = { supported: false, mimeType: "", extension: "" };
  if (
    typeof navigator === "undefined" ||
    typeof navigator.mediaDevices?.getUserMedia !== "function"
  ) {
    // `navigator.mediaDevices` is gated on a secure context by the spec, so
    // its absence on a page that HAS a navigator is overwhelmingly http://
    // rather than an engine without the API — and "open the https page" is a
    // remediation a person can act on.
    return { ...absent, reason: "insecure_context" };
  }
  const ctor =
    typeof globalThis.MediaRecorder === "function"
      ? globalThis.MediaRecorder
      : undefined;
  if (ctor === undefined) return { ...absent, reason: "unsupported" };
  const picked = pickRecordingType(ctor);
  if (picked === null) return { ...absent, reason: "no_codec" };
  return {
    supported: true,
    reason: null,
    mimeType: picked.mimeType,
    extension: picked.extension,
  };
}

export function useMediaRecorder(
  options?: UseMediaRecorderOptions
): MediaRecorderBag {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [levelAvailable, setLevelAvailable] = useState(false);
  const [clip, setClip] = useState<RecordedClip | null>(null);
  const [failure, setFailure] = useState<RecorderFailure | null>(null);

  // Probed on every render rather than memoised: the whole point is that it is
  // cheap and reads globals a test replaces between renders.
  const support = probeSupport();

  const capture = useRef<Capture | null>(null);
  const alive = useRef(true);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  /** The ONE teardown. Every exit goes through it; none of them skips a track. */
  const teardown = useCallback((current: Capture | null): void => {
    if (current === null) return;
    if (current.timer !== null) {
      clearInterval(current.timer);
      current.timer = null;
    }
    for (const track of current.stream.getTracks()) {
      try {
        track.stop();
      } catch {
        // A track already ended by the device (unplugged) throws here in some
        // engines. There is nothing to do about it and nothing to report: the
        // goal of this call is that the track is not live, which it is not.
      }
    }
    if (current.audio !== null) {
      void current.audio.context.close().catch(() => {
        // Closing an AudioContext that the engine already tore down rejects.
        // Same reasoning as the track above.
      });
      current.audio = null;
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const current = capture.current;
      capture.current = null;
      if (current !== null) {
        current.discarded = true;
        try {
          if (current.recorder.state !== "inactive") current.recorder.stop();
        } catch {
          // Stopping an already-stopped recorder throws in some engines; the
          // teardown below is what actually matters.
        }
        teardown(current);
        current.settle?.(null);
      }
    };
  }, [teardown]);

  /**
   * The meter, when the engine has one.
   *
   * Failure here is NOT a failure of the recording: a page can record
   * perfectly with no `AudioContext`, so this is wrapped and its absence is
   * reported as `levelAvailable: false` rather than allowed to abort a start.
   */
  const attachMeter = useCallback(
    (stream: MediaStream): Capture["audio"] => {
      const Ctor =
        typeof globalThis.AudioContext === "function"
          ? globalThis.AudioContext
          : undefined;
      if (Ctor === undefined) return null;
      try {
        const context = new Ctor();
        const analyser = context.createAnalyser();
        analyser.fftSize = 256;
        context.createMediaStreamSource(stream).connect(analyser);
        return { context, analyser };
      } catch {
        return null;
      }
    },
    []
  );

  const finish = useCallback(
    (current: Capture): void => {
      const settle = current.settle;
      current.settle = null;
      teardown(current);
      if (capture.current === current) capture.current = null;

      if (current.discarded) {
        if (alive.current) {
          setState("idle");
          setElapsedMs(0);
          setLevel(0);
        }
        settle?.(null);
        return;
      }

      const blob = new Blob(current.chunks, { type: current.mimeType });
      const produced: RecordedClip | null =
        blob.size === 0
          ? null
          : {
              blob,
              mimeType: current.mimeType,
              extension:
                current.extension !== ""
                  ? current.extension
                  : recordingExtension(current.mimeType),
              durationMs: Math.max(0, Date.now() - current.startedAt),
              reachedLimit: current.reachedLimit,
            };
      if (alive.current) {
        setClip(produced);
        setState(produced === null ? "idle" : "ready");
        setLevel(0);
        if (produced === null) setElapsedMs(0);
      }
      settle?.(produced);
    },
    [teardown]
  );

  const stop = useCallback(async (): Promise<RecordedClip | null> => {
    const current = capture.current;
    if (current === null) return null;
    if (current.settle !== null) return null;
    if (current.recorder.state === "inactive") {
      finish(current);
      return null;
    }
    setState("stopping");
    return new Promise<RecordedClip | null>((resolve) => {
      current.settle = resolve;
      try {
        current.recorder.stop();
      } catch {
        // An engine that refuses the stop still has to release the device and
        // settle the caller's promise, so the teardown runs here too.
        finish(current);
      }
    });
  }, [finish]);

  const cancel = useCallback((): void => {
    const current = capture.current;
    if (current === null) return;
    current.discarded = true;
    if (current.recorder.state === "inactive") {
      finish(current);
      return;
    }
    try {
      current.recorder.stop();
    } catch {
      finish(current);
    }
  }, [finish]);

  const start = useCallback(async (): Promise<void> => {
    if (capture.current !== null) return;
    const probe = probeSupport();
    if (!probe.supported) {
      setState("failed");
      setFailure(probe.reason);
      return;
    }

    setState("requesting");
    setFailure(null);
    setClip(null);
    setElapsedMs(0);
    setLevel(0);

    let stream: MediaStream;
    try {
      const constraints = optionsRef.current?.constraints;
      stream = await navigator.mediaDevices.getUserMedia({
        audio: constraints === undefined ? true : constraints,
      });
    } catch (error) {
      if (!alive.current) return;
      setState("failed");
      setFailure(classifyMediaError(error));
      return;
    }

    if (!alive.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new globalThis.MediaRecorder(stream, {
        mimeType: probe.mimeType,
      });
    } catch {
      // The engine said `isTypeSupported` and then refused the constructor.
      // Releasing the stream here is what keeps the microphone light from
      // staying on after a failure nobody could see.
      for (const track of stream.getTracks()) track.stop();
      setState("failed");
      setFailure("no_codec");
      return;
    }

    const current: Capture = {
      recorder,
      stream,
      chunks: [],
      // The engine's own word for what it is producing, when it publishes one:
      // an engine may honour the request with a different profile string, and
      // the EXTENSION is derived from whatever it actually says.
      mimeType: recorder.mimeType !== "" ? recorder.mimeType : probe.mimeType,
      extension: probe.extension,
      startedAt: Date.now(),
      audio: null,
      timer: null,
      settle: null,
      discarded: false,
      reachedLimit: false,
    };
    capture.current = current;

    recorder.ondataavailable = (event: BlobEvent): void => {
      if (event.data.size > 0) current.chunks.push(event.data);
    };
    recorder.onstop = (): void => {
      finish(current);
    };
    recorder.onerror = (): void => {
      current.discarded = true;
      if (alive.current) {
        setState("failed");
        setFailure("failed");
      }
      finish(current);
    };

    current.audio = attachMeter(stream);
    setLevelAvailable(current.audio !== null);

    const tickMs = optionsRef.current?.tickMs ?? DEFAULT_TICK_MS;
    const maxMs = optionsRef.current?.maxMs;
    const frame =
      current.audio === null
        ? null
        : new Uint8Array(current.audio.analyser.frequencyBinCount);
    current.timer = setInterval(() => {
      if (!alive.current || capture.current !== current) return;
      const ran = Date.now() - current.startedAt;
      setElapsedMs(ran);
      if (current.audio !== null && frame !== null) {
        current.audio.analyser.getByteTimeDomainData(frame);
        setLevel(rmsLevel(frame));
      }
      if (maxMs !== undefined && ran >= maxMs && current.recorder.state !== "inactive") {
        current.reachedLimit = true;
        void stop();
      }
    }, tickMs);

    recorder.start();
    setState("recording");
  }, [attachMeter, finish, stop]);

  const reset = useCallback((): void => {
    setClip(null);
    setFailure(null);
    setElapsedMs(0);
    setLevel(0);
    if (capture.current === null) setState("idle");
  }, []);

  return {
    start,
    stop,
    cancel,
    reset,
    state,
    isRecording: state === "recording",
    elapsedMs,
    level,
    levelAvailable,
    clip,
    failure,
    supported: support.supported,
    unsupportedReason: support.reason,
  };
}
