import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { matchList } from "@stapel/core";
import { createRecordingsRuntime } from "../src/model/runtime.js";
import type { RecordingsRuntime } from "../src/model/runtime.js";
import { RecordingsProvider } from "../src/headless/RecordingsProvider.js";
import { RecordingList } from "../src/headless/RecordingList.js";
import { RecordingComposer } from "../src/headless/RecordingComposer.js";
import { UploadFinalizer } from "../src/headless/UploadFinalizer.js";
import { RecordingMedia } from "../src/headless/RecordingMedia.js";
import { uploadGate } from "../src/headless/RecordingUpload.js";
import { useRecordings, useUploadLimits } from "../src/model/queries.js";
import { RECORDINGS_I18N_KEYS } from "../src/i18n/keys.js";
import {
  UploadPreflightError,
  isUploadExpired,
  storedBytesForHours,
  uploadAccept,
  uploadRecordingBlob,
} from "../src/api/extensions.js";

/** Base the msw handlers mount on (mirrors stapel-recordings `/recordings/api/`). */
const BASE = "https://recordings.stapel.test/recordings/api/v1";

const RECORDING = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  resource_key: "rec/550e8400",
  workspace_id: "ws-1",
  title: "Team standup",
  status: "processing",
  source_type: "upload",
  language: "en",
  duration_seconds: null,
  segments_count: 0,
  speakers_count: 0,
  word_count: 0,
  provider_used: null,
  transcript_storage_key: null,
  summary: null,
  created_at: "2026-07-09T09:00:00Z",
};

const UPLOAD = {
  id: "up-1",
  presigned_url: "https://store.stapel.test/upload/up-1",
  storage_key: "recordings/rec-1/media",
  max_size_bytes: 1024,
  expires_at: "2026-07-09T10:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: RecordingsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <RecordingsProvider runtime={runtime}>{children}</RecordingsProvider>
    </QueryClientProvider>
  );
}

describe("useRecordings (happy path)", () => {
  it("reads the user's own recordings", async () => {
    server.use(
      http.get(`${BASE}/recordings`, () => HttpResponse.json([RECORDING]))
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRecordings(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.title).toBe("Team standup");
  });
});

describe("useRecordings (workspace filter)", () => {
  it("passes ?workspace_id= when a workspaceId is given", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/recordings`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([RECORDING]);
      })
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRecordings({ workspaceId: "ws-9" }), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenUrl).toContain("workspace_id=ws-9");
  });

  it("omits the query param for the own-recordings read", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/recordings`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([RECORDING]);
      })
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRecordings(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenUrl).not.toContain("workspace_id");
  });
});

describe("<RecordingList> (headless)", () => {
  it("renders the recordings bag", async () => {
    server.use(
      http.get(`${BASE}/recordings`, () => HttpResponse.json([RECORDING]))
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingList>
          {({ state }) => (
            <span data-testid="count">
              {state.status === "ready" ? state.data.length : state.status}
            </span>
          )}
        </RecordingList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
  });

  it("forwards the workspaceId prop as the ?workspace_id= filter", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/recordings`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([RECORDING]);
      })
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingList workspaceId="ws-7">
          {({ state }) => (
            <span data-testid="ws-count">
              {state.status === "ready" ? state.data.length : state.status}
            </span>
          )}
        </RecordingList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("ws-count").textContent).toBe("1")
    );
    expect(seenUrl).toContain("workspace_id=ws-7");
  });
});

describe("<RecordingComposer> (create → opens upload session)", () => {
  it("creates a recording and exposes the opened upload session", async () => {
    server.use(
      http.post(`${BASE}/recordings`, () =>
        HttpResponse.json({ recording: RECORDING, upload: UPLOAD }, { status: 201 })
      )
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingComposer>
          {({ create, recording, upload }) => (
            <div>
              <span data-testid="rec">{recording?.title ?? "none"}</span>
              <span data-testid="url">{upload?.presigned_url ?? "none"}</span>
              <button
                onClick={() =>
                  create({
                    workspace_id: "ws-1",
                    title: "Team standup",
                    diarization_enabled: true,
                  })
                }
              >
                go
              </button>
            </div>
          )}
        </RecordingComposer>
      )
    );
    expect(screen.getByTestId("rec").textContent).toBe("none");
    screen.getByText("go").click();
    await waitFor(() =>
      expect(screen.getByTestId("rec").textContent).toBe("Team standup")
    );
    expect(screen.getByTestId("url").textContent).toBe(UPLOAD.presigned_url);
  });
});

describe("<UploadFinalizer> (error path)", () => {
  it("surfaces a StapelApiError code on a 400 invalid-state", async () => {
    server.use(
      http.post(`${BASE}/recordings/:id/finalize`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.recording_invalid_state",
            error: "Recording is not in a valid state for this action",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <UploadFinalizer recordingId="rec-1">
          {({ finalize, error }) => (
            <div>
              <span data-testid="code">{error?.code ?? "none"}</span>
              <button onClick={() => finalize(1024)}>finalize</button>
            </div>
          )}
        </UploadFinalizer>
      )
    );
    screen.getByText("finalize").click();
    await waitFor(() =>
      expect(screen.getByTestId("code").textContent).toBe(
        "error.400.recording_invalid_state"
      )
    );
  });
});

describe("uploadRecordingBlob (single-PUT to the presigned URL)", () => {
  it("PUTs the blob to the session URL and guards the size limit", async () => {
    let seenMethod = "";
    server.use(
      http.put(UPLOAD.presigned_url, ({ request }) => {
        seenMethod = request.method;
        return new HttpResponse(null, { status: 200 });
      })
    );
    const blob = new Blob([new Uint8Array(512)]);
    const res = await uploadRecordingBlob(UPLOAD, blob, {
      contentType: "audio/webm",
    });
    expect(res.ok).toBe(true);
    expect(seenMethod).toBe("PUT");

    // The local size guard now throws the pair's own preflight error rather
    // than a bare RangeError: the caller has to tell "over the ceiling" from
    // "the session window closed" to say the right sentence, and a message
    // string is not something a UI should parse.
    const tooBig = new Blob([new Uint8Array(UPLOAD.max_size_bytes + 1)]);
    await expect(uploadRecordingBlob(UPLOAD, tooBig)).rejects.toBeInstanceOf(
      UploadPreflightError
    );
    await expect(uploadRecordingBlob(UPLOAD, tooBig)).rejects.toMatchObject({
      reason: "too_large",
    });
  });

  it("isUploadExpired compares expires_at against now", () => {
    expect(isUploadExpired(UPLOAD, new Date("2026-07-09T09:30:00Z"))).toBe(false);
    expect(isUploadExpired(UPLOAD, new Date("2026-07-09T10:30:00Z"))).toBe(true);
  });
});

// ── the absence of a result is not a result (@stapel/core loadState.ts) ──────
//
// 2026-08-09: a sibling pair's list endpoint answered 404 and every screen
// built on its flattened `?? []` bag said "you have nothing". A recordings
// list is where that lie is cheapest to tell and hardest to notice — "no
// recordings yet" is the expected first-run screen.
describe("<RecordingList> — a failed read is not an empty list", () => {
  it("reports `failed`, and never the empty rendering", async () => {
    server.use(
      http.get(`${BASE}/recordings`, () =>
        // A real 404 through the real transport: what a mis-mounted route
        // returns, not a hand-shaped `{status: 404}` the code already agrees
        // with.
        new HttpResponse("<h1>Not Found</h1>", {
          status: 404,
          headers: { "Content-Type": "text/html" },
        })
      )
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingList>
          {({ state }) => (
            <span data-testid="failed-count">
              {matchList(state, {
                loading: () => "loading",
                failed: () => "could not load",
                empty: () => "no recordings yet",
                ready: (rows) => `${String(rows.length)} recording(s)`,
              })}
            </span>
          )}
        </RecordingList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("failed-count").textContent).toBe("could not load")
    );
    expect(screen.queryByText("no recordings yet")).toBeNull();
  });

  it("says 'no recordings yet' only for a read that succeeded", async () => {
    server.use(http.get(`${BASE}/recordings`, () => HttpResponse.json([])));
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingList>
          {({ state }) => (
            <span data-testid="empty-count">
              {matchList(state, {
                loading: () => "loading",
                failed: () => "could not load",
                empty: () => "no recordings yet",
                ready: (rows) => `${String(rows.length)} recording(s)`,
              })}
            </span>
          )}
        </RecordingList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("empty-count").textContent).toBe("no recordings yet")
    );
  });
});

// ── the ceilings, before the picker (backend 0.22.0) ─────────────────────────
//
// The module became an AUDIO service: a container is transport, its track is
// extracted and downmixed, and the container is deleted. That is why there are
// two ceilings and why they differ by orders of magnitude — a host that only
// knows one of them either refuses files the deployment would have taken or
// lets a person upload 16 GB to learn about a 413. The numbers below are a
// live stand's.
const UPLOAD_LIMITS = {
  max_upload_bytes: 17179869184,
  max_stored_bytes: 536870912,
  audio_only_ingest: true,
  stored_audio_codec: "opus",
  stored_audio_channels: 1,
  stored_audio_sample_rate: 16000,
  stored_bytes_per_hour: 10800000,
  multipart_part_size: 10485760,
  max_multipart_parts: 10000,
  allowed_extensions: ["m4a", "mp3", "mp4", "ogg", "opus", "wav", "webm"],
};

describe("useUploadLimits — the read a host makes BEFORE the file picker", () => {
  it("reads the ceilings and the stored audio profile off one endpoint", async () => {
    let seenUrl = "";
    server.use(
      http.get(`${BASE}/recordings/upload-limits`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json(UPLOAD_LIMITS);
      })
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useUploadLimits(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(seenUrl).toContain("/recordings/upload-limits");
    const limits = result.current.data;
    // ACCEPTED and KEPT are different numbers, and the pair must not collapse
    // them: the first is the 413 line, the second is what survives ingest.
    expect(limits?.max_upload_bytes).toBe(17179869184);
    expect(limits?.max_stored_bytes).toBe(536870912);
    expect(limits?.audio_only_ingest).toBe(true);
    expect(limits?.stored_audio_codec).toBe("opus");
    expect(limits?.stored_audio_channels).toBe(1);
    expect(limits?.stored_audio_sample_rate).toBe(16000);
    expect(limits?.multipart_part_size).toBe(10485760);
    expect(limits?.max_multipart_parts).toBe(10000);
    expect(limits?.allowed_extensions).toContain("m4a");
  });

  it("prices an hour of speech off the STORED profile, not the upload", () => {
    expect(storedBytesForHours(UPLOAD_LIMITS, 2)).toBe(21600000);
    expect(storedBytesForHours(UPLOAD_LIMITS, 0)).toBe(0);
  });
});

describe("uploadGate — the deployment's own allowlist, and its own ceiling", () => {
  /** A `File` of a stated size without allocating it — a 16 GiB fixture is
   * not something a test can hold in memory. */
  function sized(name: string, size: number): File {
    const file = new File([new Uint8Array(1)], name, { type: "audio/mpeg" });
    Object.defineProperty(file, "size", { value: size });
    return file;
  }

  it("takes a listed extension", () => {
    const gate = uploadGate({
      file: sized("standup.m4a", 1024),
      title: "Standup",
      workspaceId: "ws-1",
      limits: UPLOAD_LIMITS,
    });
    expect(gate.available).toBe(true);
  });

  it("refuses an extension this deployment does not list", () => {
    const gate = uploadGate({
      file: sized("standup.aiff", 1024),
      title: "Standup",
      workspaceId: "ws-1",
      limits: UPLOAD_LIMITS,
    });
    expect(gate.available).toBe(false);
    expect(gate.block?.code).toBe(
      RECORDINGS_I18N_KEYS.uploaderUnsupportedType
    );
  });

  it("refuses a file over the ACCEPTED ceiling before a byte is sent", () => {
    const gate = uploadGate({
      file: sized("marathon.wav", UPLOAD_LIMITS.max_upload_bytes + 1),
      title: "Marathon",
      workspaceId: "ws-1",
      limits: UPLOAD_LIMITS,
    });
    expect(gate.available).toBe(false);
    expect(gate.block?.code).toBe(RECORDINGS_I18N_KEYS.uploaderTooLarge);
  });

  it("does NOT judge a file against the STORED ceiling — the container is transport", () => {
    // 1 GB is over `max_stored_bytes` and far under `max_upload_bytes`. The
    // deployment takes it and keeps the extracted audio; a pair that gated on
    // the wrong number would refuse an upload the backend wanted.
    const gate = uploadGate({
      file: sized("meeting.mp4", 1073741824),
      title: "Meeting",
      workspaceId: "ws-1",
      limits: UPLOAD_LIMITS,
    });
    expect(gate.available).toBe(true);
  });

  it("invents no refusal while the limits have not landed", () => {
    const gate = uploadGate({
      file: sized("standup.aiff", 999999999999),
      title: "Standup",
      workspaceId: "ws-1",
      limits: null,
    });
    expect(gate.available).toBe(true);
  });
});

describe("uploadAccept — the picker offers what the deployment takes", () => {
  it("builds the accept list from allowed_extensions", () => {
    expect(uploadAccept(UPLOAD_LIMITS)).toBe(
      ".m4a,.mp3,.mp4,.ogg,.opus,.wav,.webm"
    );
  });

  it("falls back to the media prefixes rather than to nothing", () => {
    // A picker filtered on a list it does not have is a picker that shows no
    // files at all.
    expect(uploadAccept(null)).toBe("audio/*,video/*");
  });
});

// ── 409 on a recording still in the pipeline is a WAIT, not a loss ───────────
//
// Since 0.22.0 `media_storage_key` refuses to serve the uploaded container at
// all while audio-only ingest runs, so a recording that has not reached the
// convert stage answers its media read `409 recording_media_not_stored` — the
// same code a recording with genuinely nothing stored answers. Told apart by
// the recording's own status, or the pair says "this recording has no media
// file" about audio that is being written as the person reads it.
describe("<RecordingMedia> — the 409 that means 'not yet'", () => {
  function mountMedia(status: string): void {
    server.use(
      http.get(`${BASE}/recordings/:id/media`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.409.recording_media_not_stored",
            error: "This recording has no media stored",
            params: {},
          },
          { status: 409 }
        )
      )
    );
    const runtime = createRecordingsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RecordingMedia recording={{ id: "rec-1", status }}>
          {({ isNotStored, isConverting }) => (
            <div>
              <span data-testid="not-stored">{String(isNotStored)}</span>
              <span data-testid="converting">{String(isConverting)}</span>
            </div>
          )}
        </RecordingMedia>
      )
    );
  }

  it("reads a mid-pipeline 409 as still converting", async () => {
    mountMedia("normalizing");
    await waitFor(() =>
      expect(screen.getByTestId("not-stored").textContent).toBe("true")
    );
    expect(screen.getByTestId("converting").textContent).toBe("true");
  });

  it("keeps a terminal 409 a real 'nothing stored'", async () => {
    mountMedia("completed");
    await waitFor(() =>
      expect(screen.getByTestId("not-stored").textContent).toBe("true")
    );
    expect(screen.getByTestId("converting").textContent).toBe("false");
  });
});
