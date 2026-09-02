/**
 * A CLOSED `<RevisionsModal/>` costs nothing.
 *
 * The upstream tail of the drive wave: the modal read `GET /documents/:id`
 * (and its revision list) the moment it was MOUNTED, not the moment it was
 * opened. A host that mounts it once beside a row — the obvious composition,
 * and the one `SkinDialog`'s own API invites — therefore paid two requests
 * per row for a dialog nobody had opened yet. drive-react 0.5.1 worked
 * around it at the call site by mounting the modal only on tap; the modal is
 * the right place, because every other caller inherits the fix.
 *
 * Pinned here: zero requests while closed, and the reads resume on open.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createDocsRuntime } from "../src/model/runtime.js";
import type { DocsRuntime } from "../src/model/runtime.js";
import { DocsProvider } from "../src/headless/DocsProvider.js";
import { registerDocsI18n } from "../src/i18n/keys.js";
import { RevisionsModal } from "../src/default/index.js";

const BASE = "https://docs.stapel.test/docs/api/v1";

const DOCUMENT = {
  id: "d-1",
  workspace_id: "ws-1",
  folder_id: null,
  type: "md",
  title: "Design notes",
  head_seq: 4,
  snapshot_seq: 4,
  size_bytes: 11,
  mime_type: "text/markdown",
  metadata: {},
  editor_hint: "markdown",
  collab: "snapshot",
  diffable: true,
  socket_path: null,
  created_at: "2026-08-01T09:00:00Z",
  updated_at: "2026-08-02T09:00:00Z",
};

const REVISION = {
  id: "rev-1",
  document_id: "d-1",
  kind: "named",
  name: "before rewrite",
  seq: 3,
  size_bytes: 11,
  created_by: "u-1",
  created_at: "2026-08-02T08:00:00Z",
};

/** Every request the modal's reads would make, counted by path. */
const seen: string[] = [];

const server = setupServer(
  http.get(`${BASE}/documents/d-1`, () => {
    seen.push("document");
    return HttpResponse.json(DOCUMENT);
  }),
  http.get(`${BASE}/documents/d-1/revisions`, () => {
    seen.push("revisions");
    return HttpResponse.json([REVISION]);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  seen.length = 0;
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

describe("<RevisionsModal/> — mounted closed is free", () => {
  it("makes no request at all while closed", async () => {
    const runtime = createDocsRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RevisionsModal documentId="d-1" open={false} onClose={() => undefined} />
      )
    );
    // Give any un-gated query a chance to fire before asserting silence.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toEqual([]);
  });

  it("reads the document and its revisions once it is opened", async () => {
    const runtime = createDocsRuntime({ baseUrl: BASE });
    const { rerender } = render(
      wrap(
        runtime,
        <RevisionsModal documentId="d-1" open={false} onClose={() => undefined} />
      )
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seen).toEqual([]);

    rerender(
      wrap(
        runtime,
        <RevisionsModal documentId="d-1" open onClose={() => undefined} />
      )
    );
    await waitFor(() => {
      expect(screen.getByTestId("docs-revisions-modal")).toBeTruthy();
    });
    await waitFor(() => {
      expect(seen).toContain("revisions");
    });
    expect(seen).toContain("document");
  });
});
