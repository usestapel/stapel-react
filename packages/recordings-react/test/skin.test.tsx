import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import {
  RECORDINGS_I18N_KEYS,
  createRecordingsRuntime,
  mediaRefreshMs,
  pollIntervalMs,
  recordingsI18nBundleEn,
  registerRecordingsI18n,
  reprocessGate,
  resummarizeGate,
  segmentIndexAt,
  uploadGate,
} from "../src/index.js";
import { RecordingsProvider } from "../src/headless/RecordingsProvider.js";
import { recordingsI18nBundleRu } from "../src/i18n/ru.js";
import { recordingsI18nBundleEs } from "../src/i18n/es.js";
import { RecordingsList } from "../src/default/RecordingsList.js";
import { RecordingStatusChip } from "../src/default/RecordingStatusChip.js";

const BASE = "https://recordings.stapel.test/recordings/api/v1";

const DONE = {
  id: "rec-2",
  resource_key: "rec/rec-2",
  workspace_id: "ws-1",
  title: "Customer interview",
  status: "completed",
  source_type: "upload",
  language: "en",
  duration_seconds: 1830,
  segments_count: 214,
  speakers_count: 2,
  word_count: 4120,
  provider_used: "whisper",
  transcript_storage_key: "k",
  summary: null,
  created_at: "2026-08-18T15:30:00Z",
  is_processing: false,
  poll_after_seconds: null,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  document.documentElement.removeAttribute("data-theme");
});
afterAll(() => server.close());

function wrap(children: ReactNode): ReactElement {
  const runtime = createRecordingsRuntime({ baseUrl: BASE });
  const engine = createI18n({ locale: "en" });
  registerRecordingsI18n(engine);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={engine}>
        <RecordingsProvider runtime={runtime}>{children}</RecordingsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("polling is read off the payload, never guessed", () => {
  it("schedules the next read at poll_after_seconds", () => {
    expect(pollIntervalMs({ poll_after_seconds: 5 })).toBe(5000);
  });

  it("STOPS when the hint is absent — the field's absence is the instruction", () => {
    // A client that polls a failed recording forever is the defect the shape
    // exists to prevent, so `null` and `undefined` must both mean `false`.
    expect(pollIntervalMs({ poll_after_seconds: null })).toBe(false);
    expect(pollIntervalMs(undefined)).toBe(false);
  });

  it("refuses a zero/negative hint rather than spinning the query loop", () => {
    expect(pollIntervalMs({ poll_after_seconds: 0 })).toBe(false);
    expect(pollIntervalMs({ poll_after_seconds: -1 })).toBe(false);
  });

  it("re-mints a media URL BEFORE it dies, not after", () => {
    expect(mediaRefreshMs(900)).toBe(720_000);
    expect(mediaRefreshMs(900)).toBeLessThan(900_000);
    expect(mediaRefreshMs(1)).toBe(false);
  });
});

describe("transcript ↔ playback sync", () => {
  const segments = [
    { sequence_num: 1, start_time: 0, end_time: 5, speaker: "A", text: "one" },
    { sequence_num: 2, start_time: 5, end_time: 9, speaker: null, text: "two" },
    { sequence_num: 3, start_time: 12, end_time: 20, speaker: "A", text: "three" },
  ];

  it("finds the segment covering a moment", () => {
    expect(segmentIndexAt(segments, 0)).toBe(0);
    expect(segmentIndexAt(segments, 6)).toBe(1);
    expect(segmentIndexAt(segments, 19)).toBe(2);
  });

  it("returns -1 in a gap and past the end — never the nearest neighbour", () => {
    expect(segmentIndexAt(segments, 10)).toBe(-1);
    expect(segmentIndexAt(segments, 99)).toBe(-1);
    expect(segmentIndexAt([], 3)).toBe(-1);
  });
});

describe("gates carry a reason, never a bare boolean", () => {
  it("names the FIRST thing missing, in the order a person is told", () => {
    const noWorkspace = uploadGate({ file: null, title: "", workspaceId: undefined });
    expect(noWorkspace.available).toBe(false);
    expect(noWorkspace.block?.code).toBe(
      RECORDINGS_I18N_KEYS.uploaderBlockedNoWorkspace
    );
    const noFile = uploadGate({ file: null, title: "", workspaceId: "ws-1" });
    expect(noFile.block?.code).toBe(RECORDINGS_I18N_KEYS.uploaderBlockedNoFile);
  });

  it("refuses a file that is not audio or video", () => {
    const pdf = new File([new Uint8Array(4)], "notes.pdf", {
      type: "application/pdf",
    });
    expect(
      uploadGate({ file: pdf, title: "Notes", workspaceId: "ws-1" }).block?.code
    ).toBe(RECORDINGS_I18N_KEYS.uploaderUnsupportedType);
  });

  it("blocks a re-summary with no transcript, and one mid-pipeline", () => {
    expect(
      resummarizeGate({ is_processing: false, segments_count: 0 }).block?.code
    ).toBe(RECORDINGS_I18N_KEYS.resummarizeBlockedNoTranscript);
    expect(
      resummarizeGate({ is_processing: true, segments_count: 9 }).block?.code
    ).toBe(RECORDINGS_I18N_KEYS.resummarizeBlockedProcessing);
    expect(
      resummarizeGate({ is_processing: false, segments_count: 9 }).available
    ).toBe(true);
  });

  it("allows reprocess ONLY from completed — the backend's own rule", () => {
    expect(reprocessGate({ status: "completed" }).available).toBe(true);
    expect(reprocessGate({ status: "transcribing" }).block?.code).toBe(
      RECORDINGS_I18N_KEYS.reprocessBlockedNotCompleted
    );
  });
});

describe("i18n locale parity (en / ru / es)", () => {
  const uiKeys = Object.values(RECORDINGS_I18N_KEYS);

  it("every UI key the pair defines has copy in all three locales", () => {
    for (const key of uiKeys) {
      expect(recordingsI18nBundleEn[key], `en ${key}`).toBeTruthy();
      expect(recordingsI18nBundleRu[key], `ru ${key}`).toBeTruthy();
      expect(recordingsI18nBundleEs[key], `es ${key}`).toBeTruthy();
    }
  });

  it("ships a sentence for every one of the module's own error codes", () => {
    // Eleven of the seventeen had no English string at all before this wave —
    // they rendered as raw keys, including the metered 402 the backend added
    // specifically so a UI could turn it into a top-up prompt.
    for (const code of [
      "error.401.share_passcode_required",
      "error.402.recording_payment_required",
      "error.403.recording_action_denied",
      "error.403.share_permission_denied",
      "error.404.share_not_found",
      "error.409.recording_media_not_stored",
      "error.409.recording_no_transcript",
      "error.429.share_unlock_throttled",
      "error.503.recording_media_unavailable",
      "error.503.recording_summarize_unavailable",
      "error.503.recording_upload_unverifiable",
    ]) {
      expect(recordingsI18nBundleEn[code], `en ${code}`).toBeTruthy();
      expect(recordingsI18nBundleRu[code], `ru ${code}`).toBeTruthy();
      expect(recordingsI18nBundleEs[code], `es ${code}`).toBeTruthy();
    }
  });
});

describe("<RecordingStatusChip>", () => {
  it("renders a sentence for a real status, never the enum member", () => {
    render(wrap(<RecordingStatusChip status="transcribing" />));
    expect(screen.getByText("Transcribing")).toBeTruthy();
    expect(screen.queryByText("transcribing")).toBeNull();
  });

  it("falls back to a neutral chip for a status this build does not know", () => {
    const { container } = render(wrap(<RecordingStatusChip status="wat" />));
    expect(
      container.querySelector('[data-stapel-recording-status="unknown"]')
    ).not.toBeNull();
    expect(screen.queryByText("wat")).toBeNull();
  });
});

describe("<RecordingsList> — the shipped screen", () => {
  it("renders rows with a formatted date and length, not raw wire values", async () => {
    server.use(http.get(`${BASE}/recordings`, () => HttpResponse.json([DONE])));
    render(wrap(<RecordingsList />));
    await waitFor(() => {
      expect(screen.getByText("Customer interview")).toBeTruthy();
    });
    expect(screen.queryByText(DONE.created_at)).toBeNull();
    expect(screen.getByText("30:30")).toBeTruthy();
  });

  it("a FAILED read never wears the empty copy (the 2026-08-09 incident)", async () => {
    server.use(
      http.get(`${BASE}/recordings`, () => new HttpResponse(null, { status: 500 }))
    );
    render(wrap(<RecordingsList />));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeTruthy();
    });
    expect(
      screen.queryByText(recordingsI18nBundleEn[RECORDINGS_I18N_KEYS.listEmpty] ?? "")
    ).toBeNull();
  });

  it("shows a NAMED, visible slot where the host's create action belongs", async () => {
    server.use(http.get(`${BASE}/recordings`, () => HttpResponse.json([])));
    const { container } = render(wrap(<RecordingsList />));
    await waitFor(() => {
      expect(
        container.querySelector('[data-stapel-load-state="empty"]')
      ).not.toBeNull();
    });
    expect(
      container.querySelector('[data-stapel-slot="renderCreateAction"]')
    ).not.toBeNull();
  });

  it("self-themes from the document's LIVE data-theme, both ways", async () => {
    server.use(http.get(`${BASE}/recordings`, () => HttpResponse.json([DONE])));
    const { container } = render(wrap(<RecordingsList />));
    const root = (): Element | null =>
      container.querySelector("[data-stapel-skin-mode]");
    await waitFor(() => {
      expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("light");
    });
    document.documentElement.setAttribute("data-theme", "dark");
    await act(async () => {
      await Promise.resolve();
    });
    expect(root()?.getAttribute("data-stapel-skin-mode")).toBe("dark");
  });
});
