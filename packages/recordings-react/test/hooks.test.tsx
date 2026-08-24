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
import { useRecordings } from "../src/model/queries.js";
import {
  UploadPreflightError,
  isUploadExpired,
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
