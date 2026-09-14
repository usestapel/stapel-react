/**
 * A VOICE MESSAGE, BOTH WAYS.
 *
 * Until stapel-cdn 0.21.0 `ComposeAttachments.tsx` carried a header titled
 * "the audio hole": the recorder existed and the intake did not, so this pair
 * shipped no voice control and `useCdnAttachmentUpload` refused `audio` by
 * name. These tests pin the seam now that it is closed, against the REAL flow
 * over a mocked wire on both sides:
 *
 *   1. the uploader routes an `audio` attachment to `POST /upload/audio/`
 *      with the recorded blob's own MIME, and hands back `audio/<hash>`;
 *   2. the microphone control puts a take on the draft as an `audio` chip —
 *      through `draft.add` with `{type: "audio"}`, the option the headless
 *      hook has carried since 0.19.0 — so it reaches the wire as
 *      `{key, type: "audio"}` like any other attachment;
 *   3. the bubble is a player: a reserved row, play/pause, the length, and a
 *      playhead driven by the element's own `timeupdate`;
 *   4. the thread panel draws the microphone only behind `voice`, and only
 *      when `upload` is wired.
 */
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider, createI18n } from "@stapel/core";
import type { I18nEngine } from "@stapel/core";
import {
  CdnProvider,
  createCdnRuntime,
  registerCdnI18n,
  sha256Hex,
} from "@stapel/cdn-react";
import type { Attachment } from "../src/api/types.js";
import { registerChatI18n, useAttachmentDraft } from "../src/index.js";
import type { AttachmentUpload, AttachmentUploadRequest } from "../src/index.js";
import {
  ConversationThreadPanel,
  MessageAttachments,
  STORABLE_ATTACHMENT_TYPES,
  useCdnAttachmentUpload,
  VoiceAttachButton,
} from "../src/default/index.js";
import { mockServer, TestHarness } from "./harness.js";
import { CONVERSATION_ID, conversation, message, messagePage } from "./fixtures.js";

// ── a CDN on the wire ───────────────────────────────────────────────────────

const HASH_LEN = 64;

interface CdnCall {
  readonly url: string;
  readonly method: string;
  readonly file: File | null;
}

/** A stapel-cdn that records the multipart part and answers the audio 201. */
function cdnServer(): {
  readonly fetch: typeof globalThis.fetch;
  readonly calls: CdnCall[];
} {
  const calls: CdnCall[] = [];
  const fetchImpl = (async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    let file: File | null = null;
    if (init?.body instanceof FormData) {
      const part = init.body.get("file");
      file = part instanceof File ? part : null;
    }
    calls.push({ url, method, file });
    const json = (status: number, body: unknown): Response =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    if (url.includes("file/exists/")) {
      return json(200, { exists: false, type: null, file: null });
    }
    if (url.includes("upload/audio/") && file !== null) {
      const hash = await sha256Hex(file);
      return json(201, {
        message: "Audio uploaded successfully",
        audio: {
          id: 12,
          ref: `audio/${hash}`,
          file_hash: hash,
          original_filename: file.name,
          file_extension: ".webm",
          mime_type: "audio/webm",
          original_size: file.size,
          duration: null,
          preview_b64: "",
          original_url: `https://cdn.test/media/cdn/audio/${hash.slice(0, 8)}.webm`,
          render_meta: {
            ref: `audio/${hash}`,
            kind: "audio",
            mime: "audio/webm",
            ext: ".webm",
            bytes: file.size,
            width: null,
            height: null,
            aspect: null,
            square: false,
            animated: false,
            duration_ms: null,
            preview_b64: null,
            preview_kind: "waveform",
            poster_url: null,
            meta_status: "partial",
            meta_reason: "not_generated",
            variants: [],
          },
          refs: [],
          is_compressed: false,
          uploaded_by: "00000000-0000-0000-0000-000000000001",
          uploaded_by_username: "seller",
          created_at: "2026-09-14T10:00:00Z",
          updated_at: "2026-09-14T10:00:00Z",
        },
      });
    }
    return json(404, { localizable_error: "error.404.not_found" });
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

function Localized(props: { children: ReactNode }): ReactElement {
  const engine: I18nEngine = createI18n({ locale: "en" });
  registerChatI18n(engine);
  registerCdnI18n(engine);
  return <I18nProvider i18n={engine}>{props.children}</I18nProvider>;
}

function WithCdn(props: {
  cdn: ReturnType<typeof cdnServer>;
  children: ReactNode;
}): ReactElement {
  const runtime = createCdnRuntime({
    baseUrl: "https://cdn.test/cdn/api/v1",
    fetch: props.cdn.fetch,
    variants: { attempts: 0 },
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <Localized>
        <CdnProvider runtime={runtime}>{props.children}</CdnProvider>
      </Localized>
    </QueryClientProvider>
  );
}

// ── 1. the uploader ─────────────────────────────────────────────────────────

describe("useCdnAttachmentUpload and the audio intake", () => {
  it("lists audio among the storable types — the hole is closed", () => {
    expect(STORABLE_ATTACHMENT_TYPES).toContain("audio");
  });

  it("routes an `audio` attachment to POST /upload/audio/ with the blob's own mime", async () => {
    const cdn = cdnServer();
    const { result } = renderHook(() => useCdnAttachmentUpload(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <WithCdn cdn={cdn}>{children}</WithCdn>
      ),
    });
    const clip = new File(["opus-bytes"], "voice-2026.webm", {
      type: "audio/webm;codecs=opus",
    });
    const request: AttachmentUploadRequest = {
      file: clip,
      type: "audio",
      signal: new AbortController().signal,
      onPhase: () => undefined,
    };
    let stored: { key: string; descriptor?: Partial<Attachment> | null } | null = null;
    await act(async () => {
      stored = await result.current(request);
    });
    const got = stored as { key: string; descriptor?: Partial<Attachment> | null } | null;
    expect(got?.key.startsWith("audio/")).toBe(true);
    expect(got?.key.length).toBe("audio/".length + HASH_LEN);
    // The descriptor came back INLINE, in the chat vocabulary, so the chip and
    // the optimistic bubble draw without a describe round trip.
    expect(got?.descriptor?.type).toBe("audio");
    expect(got?.descriptor?.preview_kind).toBe("waveform");

    const post = cdn.calls.find((call) => call.url.includes("upload/audio/"));
    expect(post?.method).toBe("POST");
    expect(post?.file?.type).toBe("audio/webm;codecs=opus");
    expect(post?.file?.name).toBe("voice-2026.webm");
    expect(cdn.calls.some((call) => call.url.includes("upload/file/"))).toBe(false);
  });
});

// ── 2. the microphone puts a take on the draft ──────────────────────────────

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

function installEngine(): void {
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve(new FakeStream()) },
  });
  (globalThis as { MediaRecorder?: unknown }).MediaRecorder = FakeMediaRecorder;
}

function removeEngine(): void {
  Reflect.deleteProperty(globalThis.navigator, "mediaDevices");
  Reflect.deleteProperty(globalThis as { MediaRecorder?: unknown }, "MediaRecorder");
}

beforeEach(installEngine);
afterEach(removeEngine);

/** Two presses of the record control. */
async function record(): Promise<void> {
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
}

function Composer(props: { upload: AttachmentUpload }): ReactElement {
  const draft = useAttachmentDraft({ upload: props.upload });
  return (
    <>
      <VoiceAttachButton draft={draft} />
      <ul data-testid="items">
        {draft.items.map((item) => (
          <li key={item.id} data-testid="item" data-type={item.type} data-phase={item.phase}>
            {item.medium}
          </li>
        ))}
      </ul>
      <span data-testid="payload">{JSON.stringify(draft.payload)}</span>
    </>
  );
}

describe("VoiceAttachButton", () => {
  it("a take becomes an `audio` chip that reaches the upload seam as type audio", async () => {
    const seen: AttachmentUploadRequest[] = [];
    const upload: AttachmentUpload = (request) => {
      seen.push(request);
      return Promise.resolve({ key: "audio/stored" });
    };
    render(
      <Localized>
        <Composer upload={upload} />
      </Localized>
    );
    await record();
    await waitFor(() => {
      expect(screen.getAllByTestId("item")).toHaveLength(1);
    });
    const item = screen.getByTestId("item");
    expect(item.getAttribute("data-type")).toBe("audio");
    expect(item.textContent).toBe("audio");
    await waitFor(() => {
      expect(item.getAttribute("data-phase")).toBe("ready");
    });
    // The seam saw the registry type and a FILE named from the container the
    // engine chose — the extension the audio intake reads.
    expect(seen).toHaveLength(1);
    expect(seen[0]?.type).toBe("audio");
    expect(seen[0]?.file.type).toBe("audio/webm;codecs=opus");
    expect(seen[0]?.file.name.endsWith(".webm")).toBe(true);
    expect(seen[0]?.file.size).toBeGreaterThan(0);
    expect(screen.getByTestId("payload").textContent).toBe(
      JSON.stringify([{ key: "audio/stored", type: "audio" }])
    );
  });

  it("the take goes through the REAL uploader to /upload/audio/ and the message carries audio/<hash>", async () => {
    const cdn = cdnServer();
    const sent: unknown[] = [];
    const chat = mockServer({
      [`POST /conversations/${CONVERSATION_ID}/messages`]: (call) => {
        sent.push(call.body);
        return { body: message(7, { body: "" }) };
      },
      [`GET /conversations/${CONVERSATION_ID}/messages`]: { body: messagePage([]) },
      [`GET /conversations/${CONVERSATION_ID}`]: {
        body: conversation({ id: CONVERSATION_ID }),
      },
    });
    function Thread(): ReactElement {
      const upload = useCdnAttachmentUpload();
      return (
        <ConversationThreadPanel conversationId={CONVERSATION_ID} upload={upload} voice />
      );
    }
    render(
      <WithCdn cdn={cdn}>
        <TestHarness server={chat}>
          <Thread />
        </TestHarness>
      </WithCdn>
    );
    await waitFor(() => {
      expect(screen.getByTestId("cdn-voice-record")).toBeTruthy();
    });
    await record();
    // The chip says what it is, not the filename it was stored under.
    await waitFor(() => {
      expect(screen.getByTestId("chat-attach-name").textContent).toBe("Voice message");
    });
    await waitFor(() => {
      expect(screen.getByTestId("chat-attach-chip").getAttribute("data-phase")).toBe("ready");
    });
    const post = cdn.calls.find((call) => call.url.includes("upload/audio/"));
    expect(post?.file?.type).toBe("audio/webm;codecs=opus");

    // A VOICE NOTE IS A MESSAGE: no words, one attachment, may be sent.
    await act(async () => {
      screen.getByTestId("chat-composer-send").click();
    });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    const body = sent[0] as { body: string; attachments: { key: string; type: string }[] };
    expect(body.body).toBe("");
    expect(body.attachments).toHaveLength(1);
    expect(body.attachments[0]?.type).toBe("audio");
    expect(body.attachments[0]?.key.startsWith("audio/")).toBe(true);
  });

  it("is switched off with the draft full, like every other attach control", async () => {
    const upload: AttachmentUpload = () => Promise.resolve({ key: "audio/stored" });
    function Full(): ReactElement {
      const draft = useAttachmentDraft({ upload, max: 1 });
      return (
        <>
          <VoiceAttachButton draft={draft} />
          <button
            type="button"
            data-testid="fill"
            onClick={() => {
              draft.add([new File(["x"], "a.png", { type: "image/png" })]);
            }}
          />
        </>
      );
    }
    render(
      <Localized>
        <Full />
      </Localized>
    );
    expect(screen.getByTestId("cdn-voice-record").hasAttribute("disabled")).toBe(false);
    await act(async () => {
      screen.getByTestId("fill").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("cdn-voice-record").hasAttribute("disabled")).toBe(true);
    });
  });
});

// ── 3. the bubble is a player ───────────────────────────────────────────────

function voiceAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    key: `audio/${"a".repeat(HASH_LEN)}`,
    type: "audio",
    mime: "audio/webm",
    bytes: 84_000,
    name: null,
    ext: ".webm",
    width: null,
    height: null,
    aspect: null,
    square: false,
    animated: false,
    duration_ms: 9_000,
    preview_b64: "data:image/webp;base64,V0FWRQ==",
    preview_kind: "waveform",
    poster_url: null,
    meta_status: "ok",
    meta_reason: null,
    variants: [
      {
        tier: "original",
        branch: null,
        url: "https://cdn.test/v.webm",
        width: null,
        height: null,
      },
    ],
    ...overrides,
  } as Attachment;
}

describe("the voice bubble", () => {
  it("reserves its row and its strip before anything loads, and starts at 0", () => {
    render(
      <Localized>
        <MessageAttachments
          message={message(1, {
            body: "",
            attachments: [voiceAttachment({ preview_b64: null, meta_status: "partial" })],
          })}
        />
      </Localized>
    );
    const row = screen.getByTestId("chat-attachment-audio-row");
    expect(row.style.minHeight).toBe("48px");
    const progress = screen.getByTestId("chat-attachment-progress");
    expect(progress.getAttribute("role")).toBe("progressbar");
    expect(progress.getAttribute("aria-valuenow")).toBe("0");
    expect(progress.style.aspectRatio).toBe("4");
    // No strip yet — the box is there anyway.
    expect(screen.queryByTestId("chat-attachment-waveform")).toBeNull();
    expect(screen.getByTestId("chat-attachment-duration").textContent).toBe("0:09");
  });

  it("the playhead follows the element's own timeupdate, against the measured length", () => {
    render(
      <Localized>
        <MessageAttachments
          message={message(1, { body: "", attachments: [voiceAttachment()] })}
        />
      </Localized>
    );
    const element = screen.getByTestId("chat-attachment-audio-element") as HTMLAudioElement;
    Object.defineProperty(element, "currentTime", { configurable: true, value: 3 });
    act(() => {
      fireEvent.timeUpdate(element);
    });
    expect(screen.getByTestId("chat-attachment-progress").getAttribute("aria-valuenow")).toBe(
      "33"
    );
    expect(screen.getByTestId("chat-attachment-playhead").style.width).toBe("33%");
    expect(screen.getByTestId("chat-attachment-duration").textContent).toBe("0:03 / 0:09");
    // Ended: back to the start, and the plain length again.
    act(() => {
      fireEvent.ended(element);
    });
    expect(screen.getByTestId("chat-attachment-progress").getAttribute("aria-valuenow")).toBe(
      "0"
    );
    expect(screen.getByTestId("chat-attachment-duration").textContent).toBe("0:09");
  });

  it("an unmeasured clip says so, and still shows progress once the element knows its length", () => {
    render(
      <Localized>
        <MessageAttachments
          message={message(1, {
            body: "",
            attachments: [voiceAttachment({ duration_ms: null })],
          })}
        />
      </Localized>
    );
    expect(screen.getByTestId("chat-attachment-duration").textContent).toContain(
      "not measured"
    );
    const element = screen.getByTestId("chat-attachment-audio-element") as HTMLAudioElement;
    Object.defineProperty(element, "duration", { configurable: true, value: 12 });
    Object.defineProperty(element, "currentTime", { configurable: true, value: 6 });
    act(() => {
      fireEvent.loadedMetadata(element);
      fireEvent.timeUpdate(element);
    });
    expect(screen.getByTestId("chat-attachment-progress").getAttribute("aria-valuenow")).toBe(
      "50"
    );
  });

  it("play and pause are one control that says which it is", () => {
    render(
      <Localized>
        <MessageAttachments
          message={message(1, { body: "", attachments: [voiceAttachment()] })}
        />
      </Localized>
    );
    const toggle = screen.getByTestId("chat-attachment-audio-toggle");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    const element = screen.getByTestId("chat-attachment-audio-element") as HTMLAudioElement;
    act(() => {
      fireEvent.play(element);
    });
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    expect(toggle.getAttribute("aria-label")).toBe("Pause");
    act(() => {
      fireEvent.pause(element);
    });
    expect(toggle.getAttribute("aria-label")).toBe("Play");
  });
});

// ── 4. the switch ───────────────────────────────────────────────────────────

describe("<ConversationThreadPanel voice>", () => {
  function panel(props: { upload?: AttachmentUpload; voice?: boolean }): void {
    const chat = mockServer({
      [`GET /conversations/${CONVERSATION_ID}/messages`]: { body: messagePage([]) },
      [`GET /conversations/${CONVERSATION_ID}`]: {
        body: conversation({ id: CONVERSATION_ID }),
      },
    });
    // The pickers read the CDN runtime for their `accept` lists, so the panel
    // stands inside a provider here the way it does in a host.
    render(
      <WithCdn cdn={cdnServer()}>
        <TestHarness server={chat}>
          <ConversationThreadPanel
            conversationId={CONVERSATION_ID}
            {...(props.upload !== undefined ? { upload: props.upload } : {})}
            {...(props.voice !== undefined ? { voice: props.voice } : {})}
          />
        </TestHarness>
      </WithCdn>
    );
  }

  it("draws the microphone only behind `voice`", async () => {
    const upload: AttachmentUpload = () => Promise.resolve({ key: "audio/x" });
    panel({ upload, voice: true });
    await waitFor(() => {
      expect(screen.getByTestId("chat-attach-media")).toBeTruthy();
    });
    expect(screen.getByTestId("cdn-voice-record")).toBeTruthy();
  });

  it("and not without it — a paperclip does not imply a microphone", async () => {
    const upload: AttachmentUpload = () => Promise.resolve({ key: "audio/x" });
    panel({ upload });
    await waitFor(() => {
      expect(screen.getByTestId("chat-attach-media")).toBeTruthy();
    });
    expect(screen.queryByTestId("cdn-voice-record")).toBeNull();
  });

  it("and not without `upload` — a control over bytes that cannot be stored is absent", async () => {
    panel({ voice: true });
    await waitFor(() => {
      expect(screen.getByTestId("chat-composer-send")).toBeTruthy();
    });
    expect(screen.queryByTestId("cdn-voice-record")).toBeNull();
    expect(screen.queryByTestId("chat-attach-media")).toBeNull();
  });
});

vi.setConfig({ testTimeout: 10_000 });
