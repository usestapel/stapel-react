import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createRecordingsRuntime } from "../src/model/runtime.js";
import type { RecordingsRuntime } from "../src/model/runtime.js";
import { RecordingsProvider } from "../src/headless/RecordingsProvider.js";
import { RecordingList } from "../src/headless/RecordingList.js";
import { RecordingComposer } from "../src/headless/RecordingComposer.js";
import { UploadFinalizer } from "../src/headless/UploadFinalizer.js";
import { useRecordings } from "../src/model/queries.js";
import {
  isUploadExpired,
  uploadRecordingBlob,
} from "../src/api/extensions.js";

/** Base the msw handlers mount on (mirrors stapel-recordings `/recordings/api/`). */
const BASE = "https://recordings.stapel.test/recordings/api";

const RECORDING = {
  id: "550e8400-e29b-41d4-a716-446655440000",
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
          {({ recordings }) => (
            <span data-testid="count">{recordings.length}</span>
          )}
        </RecordingList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("count").textContent).toBe("1")
    );
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

    const tooBig = new Blob([new Uint8Array(UPLOAD.max_size_bytes + 1)]);
    await expect(uploadRecordingBlob(UPLOAD, tooBig)).rejects.toBeInstanceOf(
      RangeError
    );
  });

  it("isUploadExpired compares expires_at against now", () => {
    expect(isUploadExpired(UPLOAD, new Date("2026-07-09T09:30:00Z"))).toBe(false);
    expect(isUploadExpired(UPLOAD, new Date("2026-07-09T10:30:00Z"))).toBe(true);
  });
});
