/**
 * THE AUDIO INTAKE — `POST /upload/audio/` (stapel-cdn 0.21.0), end to end.
 *
 * Before this the pair could RECORD (`useMediaRecorder`, `<VoiceRecordButton>`)
 * and had nowhere to put the bytes: `CdnUploadTarget` had no `audio` arm,
 * `useMediaUpload` measured a recording against the image ceiling, and the
 * bundle did not contain the string `upload/audio/`. These tests assert the
 * seam from both ends, against the REAL flow over a mocked wire
 * (CONTRIBUTING.md): the request that leaves carries the recorded blob's own
 * MIME as a `file` part addressed to `/upload/audio/`, and the reference that
 * comes back is `audio/<hash>` with a length a bubble can draw.
 */
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import {
  CDN_DEFAULT_LIMITS,
  createCdnRuntime,
  runUpload,
  targetAssetType,
  targetFileKind,
  useMediaUpload,
  useVoiceUpload,
  validateFile,
  voiceFileName,
} from "../src/index.js";
import type { VoiceUploadResult } from "../src/index.js";
import { asFile, limitsForTarget } from "../src/headless/useMediaUpload.js";
import { recordingExtension } from "../src/model/recording.js";
import { VoiceRecordButton } from "../src/default/VoiceRecordButton.js";
import { mockServer, TestHarness } from "./harness.js";
import type { MockServer } from "./harness.js";
import { audioRow, hashOf, hit, MISS, recordedBlob, uploadedAudio } from "./fixtures.js";

function wrapper(server: MockServer): (props: { children: ReactNode }) => ReactElement {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

// ── the limits, read from the backend's own declaration ─────────────────────

describe("the audio ceilings mirror stapel-cdn's declared ones", () => {
  it("MAX_AUDIO_SIZE is 50 MB and the list is ALLOWED_AUDIO_EXTENSIONS, webm first", () => {
    expect(CDN_DEFAULT_LIMITS.audio.maxBytes).toBe(50 * 1024 * 1024);
    expect(CDN_DEFAULT_LIMITS.audio.extensions).toEqual([
      ".webm", ".ogg", ".opus", ".m4a", ".mp3", ".wav", ".flac", ".aac",
    ]);
    // The view gates on the extension and a byte sniff, never on the declared
    // Content-Type — so no MIME list, which would be a refusal the server
    // does not make.
    expect(CDN_DEFAULT_LIMITS.audio.mimeTypes).toBeUndefined();
  });

  it("an audio target is measured against the audio intake, not the image one", () => {
    expect(limitsForTarget({ kind: "audio" }, CDN_DEFAULT_LIMITS)).toBe(
      CDN_DEFAULT_LIMITS.audio
    );
    const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1" });
    expect(runtime.limits.audio.maxBytes).toBe(50 * 1024 * 1024);
  });

  it("`.m4a` is admitted and `.mp4` is refused — the audio list, not the video one", () => {
    const m4a = new File(["x"], "take.m4a", { type: "audio/mp4" });
    const mp4 = new File(["x"], "take.mp4", { type: "audio/mp4" });
    expect(validateFile(m4a, CDN_DEFAULT_LIMITS.audio)).toBeNull();
    expect(validateFile(mp4, CDN_DEFAULT_LIMITS.audio)?.code).toBe(
      "error.400.invalid_format"
    );
  });

  it("an AAC recording is therefore named .m4a, whichever half named it", () => {
    expect(recordingExtension("audio/mp4")).toBe(".m4a");
    expect(asFile(new Blob(["x"], { type: "audio/mp4" }), undefined).name).toBe(
      "upload.m4a"
    );
  });

  it("the target names its model: `audio` on the wire and in file/exists/", () => {
    expect(targetAssetType({ kind: "audio" })).toBe("audio");
    expect(targetFileKind({ kind: "audio" })).toBe("audio");
  });
});

// ── the flow, over the wire ─────────────────────────────────────────────────

describe("runUpload with the audio target", () => {
  it("POSTs the recorded blob to /upload/audio/ with ITS mime, and yields audio/<hash>", async () => {
    const blob = recordedBlob("audio/webm;codecs=opus");
    const file = asFile(blob, "voice.webm");
    const hash = await hashOf(file);
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": { status: 201, body: uploadedAudio(audioRow({ hash })) },
    });
    const runtime = createCdnRuntime({
      baseUrl: "https://cdn.test/cdn/api/v1",
      fetch: server.fetch,
      variants: { attempts: 0 },
    });

    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "audio" },
      limits: runtime.limits.audio,
    });

    expect(outcome.ref).toBe(`audio/${hash}`);
    expect(outcome.kind).toBe("audio");
    expect(outcome.deduped).toBe(false);
    // A recording has no ladder: it is born settled, not "pending forever".
    expect(outcome.variantsReady).toBe(true);
    expect(outcome.variantsStatus).toBeNull();

    const post = server.calls.find((call) => call.url.includes("upload/audio/"));
    expect(post?.method).toBe("POST");
    expect(post?.file?.type).toBe("audio/webm;codecs=opus");
    expect(post?.file?.name).toBe("voice.webm");
    expect(server.count("upload/image/")).toBe(0);
    expect(server.count("upload/file/")).toBe(0);
  });

  it("a file/exists/ hit of type `audio` short-circuits — nothing is sent", async () => {
    const file = asFile(recordedBlob(), "voice.webm");
    const hash = await hashOf(file);
    const server = mockServer({
      "file/exists/": { body: hit(audioRow({ hash, durationMs: 9_000 }), "audio") },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash })) },
    });
    const runtime = createCdnRuntime({
      baseUrl: "https://cdn.test/cdn/api/v1",
      fetch: server.fetch,
      variants: { attempts: 0 },
    });
    const outcome = await runUpload(runtime.api, file, {
      target: { kind: "audio" },
      limits: runtime.limits.audio,
    });
    expect(outcome.deduped).toBe(true);
    expect(outcome.ref).toBe(`audio/${hash}`);
    expect(server.count("upload/audio/")).toBe(0);
  });

  it("the same bytes stored as a DOCUMENT are not a hit for the audio target", async () => {
    const file = asFile(recordedBlob(), "voice.webm");
    const hash = await hashOf(file);
    const server = mockServer({
      "file/exists/": { body: hit(audioRow({ hash }), "file") },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash })) },
    });
    const runtime = createCdnRuntime({
      baseUrl: "https://cdn.test/cdn/api/v1",
      fetch: server.fetch,
      variants: { attempts: 0 },
    });
    await runUpload(runtime.api, file, {
      target: { kind: "audio" },
      limits: runtime.limits.audio,
    });
    expect(server.count("upload/audio/")).toBe(1);
  });

  it("useMediaUpload reaches the audio intake through its per-call target", async () => {
    const blob = recordedBlob();
    const hash = await hashOf(asFile(blob, "upload.webm"));
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash })) },
    });
    const { result } = renderHook(() => useMediaUpload(), { wrapper: wrapper(server) });
    await act(async () => {
      await result.current.upload(blob, { target: { kind: "audio" } });
    });
    expect(result.current.key).toBe(`audio/${hash}`);
    expect(result.current.kind).toBe("audio");
    expect(result.current.descriptor?.kind).toBe("audio");
    expect(result.current.descriptor?.preview_kind).toBe("waveform");
  });
});

// ── the voice hook: a clip in, a key and a length out ───────────────────────

const CLIP = {
  blob: recordedBlob(),
  mimeType: "audio/webm;codecs=opus",
  extension: ".webm",
  durationMs: 8_750,
  reachedLimit: false,
};

describe("useVoiceUpload", () => {
  it("names the clip from ITS container and stores it under audio/<hash>", async () => {
    const hash = await hashOf(asFile(CLIP.blob, "voice.webm"));
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash })) },
    });
    const { result } = renderHook(() => useVoiceUpload(), { wrapper: wrapper(server) });
    let voice: VoiceUploadResult | null = null;
    await act(async () => {
      voice = await result.current.upload(CLIP);
    });
    const got = voice as VoiceUploadResult | null;
    expect(got?.key).toBe(`audio/${hash}`);
    expect(result.current.result?.key).toBe(`audio/${hash}`);
    const post = server.calls.find((call) => call.url.includes("upload/audio/"));
    expect(post?.file?.name).toMatch(/^voice-\d{4}-\d{2}-\d{2}T[\d-]+\.webm$/);
    expect(post?.file?.type).toBe("audio/webm;codecs=opus");
  });

  it("the 201 carries no duration yet, so the clip's own clock is the length — and says so", async () => {
    const hash = await hashOf(asFile(CLIP.blob, "voice.webm"));
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash, durationMs: null })) },
    });
    const { result } = renderHook(() => useVoiceUpload(), { wrapper: wrapper(server) });
    let voice: VoiceUploadResult | null = null;
    await act(async () => {
      voice = await result.current.upload(CLIP);
    });
    const got = voice as VoiceUploadResult | null;
    expect(got?.durationMs).toBe(8_750);
    expect(got?.measured).toBe(false);
  });

  it("a row the server had already measured wins over the clip's clock", async () => {
    const hash = await hashOf(asFile(CLIP.blob, "voice.webm"));
    const server = mockServer({
      "file/exists/": { body: hit(audioRow({ hash, durationMs: 9_000 }), "audio") },
    });
    const { result } = renderHook(() => useVoiceUpload(), { wrapper: wrapper(server) });
    let voice: VoiceUploadResult | null = null;
    await act(async () => {
      voice = await result.current.upload(CLIP);
    });
    const got = voice as VoiceUploadResult | null;
    expect(got?.durationMs).toBe(9_000);
    expect(got?.measured).toBe(true);
    expect(got?.deduped).toBe(true);
  });

  it("the filename is timestamped and carries the clip's extension", () => {
    const at = new Date("2026-09-14T10:11:12.345Z");
    expect(voiceFileName(CLIP, at)).toBe("voice-2026-09-14T10-11-12-345.webm");
    expect(voiceFileName({ ...CLIP, extension: ".m4a" }, at)).toBe(
      "voice-2026-09-14T10-11-12-345.m4a"
    );
  });
});

// ── the skin, end to end: press, press, reference ───────────────────────────

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
class FakeMediaRecorder {
  static isTypeSupported(type: string): boolean {
    return type === "audio/webm;codecs=opus";
  }
  state: "inactive" | "recording" = "inactive";
  ondataavailable: Listener = null;
  onstop: Listener = null;
  onerror: Listener = null;
  readonly mimeType: string;
  constructor(
    readonly stream: FakeStream,
    options?: { mimeType?: string }
  ) {
    this.mimeType = options?.mimeType ?? "";
  }
  start(): void {
    this.state = "recording";
  }
  stop(): void {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["opus"], { type: this.mimeType }) });
    this.onstop?.({});
  }
}

beforeEach(() => {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(new FakeStream()) },
  });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, "mediaDevices");
  Reflect.deleteProperty(globalThis as { MediaRecorder?: unknown }, "MediaRecorder");
});

describe("VoiceRecordButton with onUploaded", () => {
  it("records, uploads the take to /upload/audio/ with the engine's mime, hands back the reference", async () => {
    const hash = await hashOf(
      new File([new Blob(["opus"], { type: "audio/webm;codecs=opus" })], "x.webm")
    );
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": { body: uploadedAudio(audioRow({ hash })) },
    });
    const recorded = vi.fn();
    const uploaded = vi.fn();
    render(
      <TestHarness server={server}>
        <VoiceRecordButton onRecorded={recorded} onUploaded={uploaded} />
      </TestHarness>
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
      expect(uploaded).toHaveBeenCalledTimes(1);
    });
    // The clip went to the caller FIRST — the optimistic bubble's source.
    expect(recorded).toHaveBeenCalledTimes(1);
    const voice = uploaded.mock.calls[0]?.[0] as VoiceUploadResult;
    expect(voice.key).toBe(`audio/${hash}`);
    expect(voice.measured).toBe(false);
    expect(voice.durationMs).toBeGreaterThanOrEqual(0);

    const post = server.calls.find((call) => call.url.includes("upload/audio/"));
    expect(post?.method).toBe("POST");
    expect(post?.file?.type).toBe("audio/webm;codecs=opus");
    expect(post?.file?.name?.endsWith(".webm")).toBe(true);
    // Once the take is stored the control is back for the next one.
    await waitFor(() => {
      expect(screen.getByTestId("cdn-voice-record").hasAttribute("disabled")).toBe(false);
    });
  });

  it("a refused upload is a sentence under the control, and the take is not silently dropped", async () => {
    const server = mockServer({
      "file/exists/": { body: MISS },
      "POST upload/audio/": {
        status: 413,
        body: { localizable_error: "error.413.file_too_large", error: "File is too large" },
      },
    });
    const uploaded = vi.fn();
    render(
      <TestHarness server={server}>
        <VoiceRecordButton onUploaded={uploaded} />
      </TestHarness>
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
      expect(screen.getByTestId("cdn-voice-upload-error")).toBeTruthy();
    });
    expect(uploaded).not.toHaveBeenCalled();
  });
});
