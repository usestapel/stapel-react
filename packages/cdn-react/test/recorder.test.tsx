/**
 * The microphone, against a fake engine.
 *
 * MOCK THE WIRE, NOT THE MODULE (CONTRIBUTING.md). The "wire" for a recorder is
 * the two browser APIs it stands on — `navigator.mediaDevices.getUserMedia` and
 * the `MediaRecorder` constructor — so those are what the fakes replace, and
 * the hook under test is the real one, driven through the real event sequence
 * a browser produces (`dataavailable` … then `stop`, both AFTER `stop()`
 * returns). Nothing here hand-shapes a clip: every `Blob` the assertions see
 * was assembled by the hook out of chunks the fake emitted.
 *
 * The three things that have to be proven and cannot be proven by reading:
 * the promise from `stop()` settles with the LAST chunk rather than before it,
 * every exit stops the stream's tracks (the microphone light), and a refusal
 * lands as a NAMED state rather than an unhandled rejection.
 */
import { act, renderHook, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider, createI18n } from "@stapel/core";
import type { ReactElement, ReactNode } from "react";
import { useMediaRecorder } from "../src/headless/useMediaRecorder.js";
import {
  classifyMediaError,
  pickRecordingType,
  recordingExtension,
  rmsLevel,
} from "../src/model/recording.js";
import { registerCdnI18n } from "../src/index.js";
import { VoiceRecordButton } from "../src/default/VoiceRecordButton.js";

// ── the fake engine ──────────────────────────────────────────────────────────

/** A track that remembers whether anybody stopped it. */
class FakeTrack {
  stopped = false;
  stop(): void {
    this.stopped = true;
  }
}

class FakeStream {
  readonly tracks: FakeTrack[] = [new FakeTrack()];
  getTracks(): FakeTrack[] {
    return this.tracks;
  }
}

type Listener = ((event: unknown) => void) | null;

/**
 * The engine, with the ORDERING that trips naive implementations: `stop()`
 * returns immediately and the bytes arrive afterwards.
 */
class FakeMediaRecorder {
  static supported: readonly string[] = ["audio/webm;codecs=opus"];
  static readonly constructed: FakeMediaRecorder[] = [];
  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supported.includes(type);
  }

  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: Listener = null;
  onstop: Listener = null;
  onerror: Listener = null;
  readonly mimeType: string;

  constructor(
    readonly stream: FakeStream,
    options?: { mimeType?: string }
  ) {
    this.mimeType = options?.mimeType ?? "";
    FakeMediaRecorder.constructed.push(this);
  }

  start(): void {
    this.state = "recording";
  }

  /** Deliver one chunk, the way a real recorder does while running. */
  emit(bytes: string): void {
    this.ondataavailable?.({ data: new Blob([bytes], { type: this.mimeType }) });
  }

  stop(): void {
    this.state = "inactive";
    // The final chunk, THEN the stop event — the real order, and the whole
    // reason `stop()` returns a promise instead of reading `chunks`.
    this.ondataavailable?.({ data: new Blob(["tail"], { type: this.mimeType }) });
    this.onstop?.({});
  }
}

let lastStream: FakeStream | null = null;
let getUserMedia: (constraints: unknown) => Promise<FakeStream>;

function installEngine(): void {
  lastStream = null;
  FakeMediaRecorder.supported = ["audio/webm;codecs=opus"];
  FakeMediaRecorder.constructed.length = 0;
  getUserMedia = () => {
    lastStream = new FakeStream();
    return Promise.resolve(lastStream);
  };
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: (constraints: unknown) => getUserMedia(constraints),
    },
  });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
}

function removeEngine(): void {
  Reflect.deleteProperty(globalThis.navigator, "mediaDevices");
  Reflect.deleteProperty(globalThis as { MediaRecorder?: unknown }, "MediaRecorder");
}

/** The recorder the hook built, once it has built one. */
function currentRecorder(): FakeMediaRecorder {
  const recorder = FakeMediaRecorder.constructed.at(-1);
  if (recorder === undefined) throw new Error("no recorder was constructed");
  return recorder;
}

beforeEach(() => {
  installEngine();
});

afterEach(() => {
  removeEngine();
  vi.useRealTimers();
});

// ── the rules, without a device ──────────────────────────────────────────────

describe("the recording rules", () => {
  it("picks the first container the engine admits, not the first in the list", () => {
    FakeMediaRecorder.supported = ["audio/ogg;codecs=opus"];
    expect(pickRecordingType(FakeMediaRecorder as unknown as typeof MediaRecorder)).toEqual(
      { mimeType: "audio/ogg;codecs=opus", extension: ".ogg" }
    );
  });

  it("refuses only when the engine admits NONE of them", () => {
    FakeMediaRecorder.supported = [];
    expect(pickRecordingType(FakeMediaRecorder as unknown as typeof MediaRecorder)).toBeNull();
  });

  it("an engine with no isTypeSupported is given the first candidate, not refused", () => {
    // "We could not ask" must not become "it does not work" — the silent
    // degradation this pair's vocabulary exists against.
    const ctor = function NoProbe(): void {} as unknown as typeof MediaRecorder;
    expect(pickRecordingType(ctor)?.mimeType).toBe("audio/webm;codecs=opus");
  });

  it("the extension follows the container the engine actually chose", () => {
    expect(recordingExtension("audio/ogg;codecs=opus")).toBe(".ogg");
    expect(recordingExtension("audio/webm")).toBe(".webm");
    expect(recordingExtension("audio/flac")).toBe("");
  });

  it("classifies a DOMException by NAME — the message is localized by the browser", () => {
    expect(classifyMediaError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyMediaError({ name: "NotFoundError" })).toBe("no_device");
    expect(classifyMediaError({ name: "SecurityError" })).toBe("insecure_context");
    expect(classifyMediaError(new Error("boom"))).toBe("failed");
  });

  it("the meter is RMS, so silence reads 0 and a full-scale tone reads 1", () => {
    expect(rmsLevel(new Uint8Array([128, 128, 128, 128]))).toBe(0);
    expect(rmsLevel(new Uint8Array([0, 255, 0, 255]))).toBeCloseTo(1, 1);
    expect(rmsLevel(new Uint8Array())).toBe(0);
  });
});

// ── the hook ─────────────────────────────────────────────────────────────────

describe("useMediaRecorder", () => {
  it("records, and stop() resolves with the LAST chunk included", async () => {
    const { result } = renderHook(() => useMediaRecorder());
    expect(result.current.supported).toBe(true);

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("recording");
    expect(result.current.isRecording).toBe(true);

    act(() => {
      currentRecorder().emit("head");
    });

    let clip: Awaited<ReturnType<typeof result.current.stop>> = null;
    await act(async () => {
      clip = await result.current.stop();
    });

    expect(clip).not.toBeNull();
    const taken = clip as unknown as { blob: Blob; extension: string; mimeType: string };
    // "head" + "tail": the chunk emitted while running AND the one the engine
    // only delivers after stop() was called. A hook that read its buffer
    // synchronously would see 4 bytes here.
    expect(taken.blob.size).toBe(8);
    expect(taken.extension).toBe(".webm");
    expect(taken.mimeType).toBe("audio/webm;codecs=opus");
  });

  it("releases the microphone on stop — the track is stopped, not just the recorder", async () => {
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(lastStream?.tracks[0]?.stopped).toBe(false);
    await act(async () => {
      await result.current.stop();
    });
    expect(lastStream?.tracks[0]?.stopped).toBe(true);
  });

  it("releases the microphone on cancel, and keeps no clip", async () => {
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.cancel();
    });
    await waitFor(() => {
      expect(result.current.state).toBe("idle");
    });
    expect(result.current.clip).toBeNull();
    expect(lastStream?.tracks[0]?.stopped).toBe(true);
  });

  it("releases the microphone on unmount — no exit leaves the light on", async () => {
    const { result, unmount } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    unmount();
    expect(lastStream?.tracks[0]?.stopped).toBe(true);
  });

  it("a refusal is a named STATE, never a rejection", async () => {
    getUserMedia = () =>
      Promise.reject(Object.assign(new Error("no"), { name: "NotAllowedError" }));
    const { result } = renderHook(() => useMediaRecorder());
    // No try/catch here on purpose: a start() that rejected would fail this
    // test as an unhandled rejection, which is the behaviour being ruled out.
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.state).toBe("failed");
    expect(result.current.failure).toBe("denied");
    expect(result.current.isRecording).toBe(false);
  });

  it("a missing device and a refusal are DIFFERENT reasons", async () => {
    getUserMedia = () =>
      Promise.reject(Object.assign(new Error("none"), { name: "NotFoundError" }));
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.failure).toBe("no_device");
  });

  it("an engine with no MediaRecorder says so BEFORE a press", () => {
    Reflect.deleteProperty(globalThis as { MediaRecorder?: unknown }, "MediaRecorder");
    const { result } = renderHook(() => useMediaRecorder());
    expect(result.current.supported).toBe(false);
    expect(result.current.unsupportedReason).toBe("unsupported");
  });

  it("an insecure page is told to open the https one, not that the browser is old", () => {
    removeEngine();
    const { result } = renderHook(() => useMediaRecorder());
    expect(result.current.supported).toBe(false);
    expect(result.current.unsupportedReason).toBe("insecure_context");
  });

  it("a press that produces no bytes is 'nothing recorded', not a failure", async () => {
    // An engine that emits no chunk at all: a real case on a slow device, and
    // a different outcome from a refusal.
    const noBytes = class extends FakeMediaRecorder {
      override stop(): void {
        this.state = "inactive";
        this.onstop?.({});
      }
    };
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = noBytes;
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    let clip: unknown = "unset";
    await act(async () => {
      clip = await result.current.stop();
    });
    expect(clip).toBeNull();
    expect(result.current.state).toBe("idle");
    expect(result.current.failure).toBeNull();
  });

  it("the meter is absent, not zero-forever, where the engine has no AudioContext", async () => {
    // jsdom has no AudioContext at all, which is exactly the degraded case.
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => {
      await result.current.start();
    });
    expect(result.current.levelAvailable).toBe(false);
    expect(result.current.level).toBe(0);
  });

  it("stops itself at maxMs and SAYS the take ended at the ceiling", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useMediaRecorder({ maxMs: 300, tickMs: 100 }));
    await act(async () => {
      await result.current.start();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    // No `waitFor` here: it polls on a real timer, which a fake-timer test
    // never advances, so the wait would outlive the suite's budget rather than
    // observe anything. `advanceTimersByTimeAsync` has already flushed the
    // microtasks the stop resolves through.
    expect(result.current.state).toBe("ready");
    expect(result.current.clip?.reachedLimit).toBe(true);
    expect(lastStream?.tracks[0]?.stopped).toBe(true);
  });
});

// ── the skin ─────────────────────────────────────────────────────────────────

function Localized(props: { children: ReactNode }): ReactElement {
  const engine = createI18n({ locale: "en" });
  registerCdnI18n(engine);
  return <I18nProvider i18n={engine}>{props.children}</I18nProvider>;
}

describe("VoiceRecordButton", () => {
  it("hands the clip over on the second press, and takes it out of the bag", async () => {
    const recorded = vi.fn();
    render(
      <Localized>
        <VoiceRecordButton onRecorded={recorded} />
      </Localized>
    );
    const button = screen.getByTestId("cdn-voice-record");
    await act(async () => {
      button.click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("cdn-voice-cancel")).toBeTruthy();
    });
    await act(async () => {
      button.click();
    });
    await waitFor(() => {
      expect(recorded).toHaveBeenCalledTimes(1);
    });
    const clip = recorded.mock.calls[0]?.[0] as { blob: Blob };
    expect(clip.blob.size).toBeGreaterThan(0);
  });

  it("a page that cannot record says WHY instead of offering a dead button", () => {
    removeEngine();
    render(
      <Localized>
        <VoiceRecordButton onRecorded={vi.fn()} />
      </Localized>
    );
    expect(screen.getByTestId("cdn-voice-failure").textContent).toContain("https");
    expect(screen.getByTestId("cdn-voice-record").hasAttribute("disabled")).toBe(true);
  });
});

describe("VoiceRecordButton — the outcomes with nothing to show for them", () => {
  it("says a take produced nothing, rather than appearing to do nothing", async () => {
    const noBytes = class extends FakeMediaRecorder {
      override stop(): void {
        this.state = "inactive";
        this.onstop?.({});
      }
    };
    (globalThis as { MediaRecorder?: unknown }).MediaRecorder = noBytes;
    const recorded = vi.fn();
    render(
      <Localized>
        <VoiceRecordButton onRecorded={recorded} />
      </Localized>
    );
    const button = screen.getByTestId("cdn-voice-record");
    await act(async () => {
      button.click();
    });
    await act(async () => {
      button.click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("cdn-voice-empty")).toBeTruthy();
    });
    expect(recorded).not.toHaveBeenCalled();
    // Not a failure: nothing is wrong with the microphone.
    expect(screen.queryByTestId("cdn-voice-failure")).toBeNull();
  });

  it("the hold gesture is stated even when the microphone is refused", () => {
    removeEngine();
    render(
      <Localized>
        <VoiceRecordButton interaction="hold" onRecorded={vi.fn()} />
      </Localized>
    );
    // Two different questions, two lines: a person who has never seen the
    // control work still learns what the gesture is.
    expect(screen.getByTestId("cdn-voice-hint")).toBeTruthy();
    expect(screen.getByTestId("cdn-voice-failure")).toBeTruthy();
  });
});
