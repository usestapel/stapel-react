/**
 * The viewing-wave seams of the docs pair (stapel-docs 0.8.0):
 *
 * 1. `MediaViewer` classifies `audio/*` as its own kind and `FileCard`
 *    plays it inline — an audio file used to be a download button.
 * 2. The one refusal with an honest local answer: a storage that cannot
 *    SIGN a URL (503 `docs_download_url_unavailable` — the DjangoStorage
 *    dev profile) falls back to the authorized content stream instead of
 *    failing the whole viewer. Every other error stays an error.
 * 3. `RevisionsModal` previews an OLD revision of a media file through
 *    the authorized revision content stream — binary no longer means
 *    "download only" when the binary is a picture.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import { FileCard, RevisionsModal } from "../src/default/index.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const FILE_DOC = {
  id: "d-media",
  workspace_id: "ws-1",
  folder_id: null,
  type: "file",
  title: "voice memo",
  head_seq: 1,
  snapshot_seq: 1,
  size_bytes: 2048,
  mime_type: "audio/mpeg",
  metadata: {},
  editor_hint: "",
  collab: "snapshot",
  diffable: false,
  socket_path: null,
  created_at: "2026-09-01T09:00:00Z",
  updated_at: "2026-09-01T09:00:00Z",
};

const IMAGE_DOC = {
  ...FILE_DOC,
  id: "d-shot",
  title: "screenshot.png",
  mime_type: "image/png",
};

const REVISION = {
  id: "rev-9",
  document_id: "d-shot",
  kind: "auto",
  name: "",
  seq: 1,
  size_bytes: 2048,
  created_by: "u-1",
  created_at: "2026-09-01T08:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

function wrap(runtime: DocsRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerDocsI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <DocsProvider runtime={runtime}>{children}</DocsProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("FileCard — the audio kind (0.8.0)", () => {
  it("plays an audio/* document inline on the minted URL", async () => {
    server.use(
      http.get(`${BASE}/documents/d-media`, () => HttpResponse.json(FILE_DOC)),
      http.get(`${BASE}/documents/d-media/download`, () =>
        HttpResponse.json({ url: "https://cdn.stapel.test/signed/memo.mp3" })
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(wrap(runtime, <FileCard documentId="d-media" />));
    await waitFor(() => {
      expect(screen.getByTestId("docs-file-audio")).toBeTruthy();
    });
    const audio = screen.getByTestId<HTMLAudioElement>("docs-file-audio");
    expect(audio.getAttribute("src")).toBe(
      "https://cdn.stapel.test/signed/memo.mp3"
    );
    expect(audio.hasAttribute("controls")).toBe(true);
  });
});

describe("MediaViewer — the 503 fallback to the authorized stream", () => {
  it("an unsignable-URL 503 serves the content stream instead of an error", async () => {
    server.use(
      http.get(`${BASE}/documents/d-shot`, () => HttpResponse.json(IMAGE_DOC)),
      http.get(`${BASE}/documents/d-shot/download`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.503.docs_download_url_unavailable",
            error: "Download links are not available",
            params: {},
          },
          { status: 503 }
        )
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { container } = render(
      wrap(runtime, <FileCard documentId="d-shot" />)
    );
    await waitFor(() => {
      expect(container.querySelector("img")).toBeTruthy();
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      `${BASE}/documents/d-shot/content`
    );
  });

  it("every other download-URL error stays an error", async () => {
    server.use(
      http.get(`${BASE}/documents/d-shot`, () => HttpResponse.json(IMAGE_DOC)),
      http.get(`${BASE}/documents/d-shot/download`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.503.docs_workspaces_unavailable",
            error: "outage",
            params: {},
          },
          { status: 503 }
        )
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { container } = render(
      wrap(runtime, <FileCard documentId="d-shot" />)
    );
    await waitFor(() => {
      expect(screen.getByTestId("docs-file-url-error")).toBeTruthy();
    });
    expect(container.querySelector("img")).toBeNull();
  });
});

describe("RevisionsModal — media revisions preview through the stream", () => {
  it("selecting a revision of an image file renders it from the revision content URL", async () => {
    server.use(
      http.get(`${BASE}/documents/d-shot`, () => HttpResponse.json(IMAGE_DOC)),
      http.get(`${BASE}/documents/d-shot/revisions`, () =>
        HttpResponse.json([REVISION])
      )
    );
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RevisionsModal documentId="d-shot" open onClose={() => undefined} />
      )
    );
    await waitFor(() => {
      expect(document.querySelector('[data-docs-revision="rev-9"]')).toBeTruthy();
    });
    const row = document.querySelector('[data-docs-revision="rev-9"]');
    if (!(row instanceof HTMLElement)) throw new Error("revision row missing");
    fireEvent.click(row);
    await waitFor(() => {
      expect(screen.getByTestId("docs-revision-media")).toBeTruthy();
    });
    expect(
      screen.getByTestId("docs-revision-media").getAttribute("src")
    ).toBe(`${BASE}/documents/d-shot/revisions/rev-9/content`);
  });
});
