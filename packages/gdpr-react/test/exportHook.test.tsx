import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useDataExport } from "../src/index.js";
import {
  DOWNLOAD_CONSUMED,
  DOWNLOAD_EXPIRED,
  EXPORT_COOLDOWN,
  EXPORT_NOT_FOUND,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import { EXPORT_ACCEPTED, EXPORT_PARTIAL, EXPORT_PROCESSING } from "./fixtures.js";

const TOKEN = "tok-8812";

function Probe(): ReactElement {
  const bag = useDataExport();
  return (
    <div>
      <span data-testid="load">{bag.state.status}</span>
      <span data-testid="status">{bag.status ?? "—"}</span>
      <span data-testid="progress">
        {bag.progress ? `${bag.progress.done}/${bag.progress.total}` : "—"}
      </span>
      <span data-testid="available">{String(bag.downloadAvailable)}</span>
      <span data-testid="missing">{bag.missingServices.join(",")}</span>
      <span data-testid="expires">{bag.expiresAt ?? "—"}</span>
      <button
        data-testid="request"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => bag.request.mutate()}
      >
        {"request"}
      </button>
      <button
        data-testid="download"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => bag.download.mutate(TOKEN)}
      >
        {"download"}
      </button>
      <span data-testid="request-error">
        {bag.request.error ? bag.request.error.code : ""}
      </span>
      <span data-testid="download-error">
        {bag.download.error ? bag.download.error.code : ""}
      </span>
      <span data-testid="archive">{bag.download.data?.filename ?? ""}</span>
    </div>
  );
}

const mount = (server: MockServer): ReturnType<typeof render> =>
  render(
    <TestProviders server={server}>
      <Probe />
    </TestProviders>
  );

const ready = async (): Promise<void> => {
  await waitFor(() =>
    expect(screen.getByTestId("load").textContent).toBe("ready")
  );
};

describe("useDataExport — the other 404 that is a state", () => {
  it("folds error.404.gdpr.export_not_found into a ready answer of null", async () => {
    const server = mockServer({ "/user/data-export/status": EXPORT_NOT_FOUND });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("none");
    expect(screen.getByTestId("available").textContent).toBe("false");
    expect(screen.getByTestId("progress").textContent).toBe("—");
  });

  it("a 500 stays failed", async () => {
    const server = mockServer({
      "/user/data-export/status": { status: 500, body: {} },
    });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
  });
});

describe("useDataExport — what the hook refuses to infer", () => {
  it("takes `download_available` from the server, not from status === ready", async () => {
    const server = mockServer({
      "/user/data-export/status": { body: EXPORT_PROCESSING },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("processing");
    expect(screen.getByTestId("available").textContent).toBe("false");
  });

  it("reports sections done/total and the missing ones by name", async () => {
    const server = mockServer({
      "/user/data-export/status": { body: EXPORT_PARTIAL },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("progress").textContent).toBe("4/5");
    // A partial archive is still handed over, and the person is told which
    // parts are absent instead of finding the hole themselves.
    expect(screen.getByTestId("missing").textContent).toBe("recordings");
    expect(screen.getByTestId("available").textContent).toBe("true");
    expect(screen.getByTestId("expires").textContent).toBe(
      EXPORT_PARTIAL.expires_at
    );
  });
});

describe("useDataExport — the request", () => {
  it("posts and lets the read answer, rather than guessing a status row", async () => {
    let requested = false;
    const server = mockServer({
      "GET /user/data-export/status": () =>
        requested ? { body: EXPORT_PROCESSING } : EXPORT_NOT_FOUND,
      "POST /user/data-export/request": () => {
        requested = true;
        return { status: 202, body: EXPORT_ACCEPTED };
      },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("none");
    screen.getByTestId("request").click();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("processing")
    );
  });

  it("the 30-day cooldown arrives as its own 409 code", async () => {
    const server = mockServer({
      "GET /user/data-export/status": EXPORT_NOT_FOUND,
      "POST /user/data-export/request": EXPORT_COOLDOWN,
    });
    mount(server);
    await ready();
    screen.getByTestId("request").click();
    await waitFor(() =>
      expect(screen.getByTestId("request-error").textContent).toBe(
        "error.409.gdpr.export_cooldown"
      )
    );
  });
});

describe("useDataExport — the download, and the two 410s", () => {
  it("puts the token in the BODY and takes the bytes as a blob", async () => {
    const server = mockServer({
      "GET /user/data-export/status": { body: EXPORT_PARTIAL },
      "POST /user/data-export/download": {
        body: { pretend: "zip" },
        headers: {
          "content-type": "application/zip",
          "content-disposition": 'attachment; filename="stapel-export.zip"',
        },
      },
    });
    mount(server);
    await ready();
    screen.getByTestId("download").click();
    await waitFor(() =>
      expect(screen.getByTestId("archive").textContent).toBe("stapel-export.zip")
    );
    const post = server.calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/user/data-export/download")
    );
    expect(post).toBeDefined();
    // Never a query string: the GET variant put a live credential to a full
    // personal-data archive into logs, history and every proxy in between.
    expect(post?.url).not.toContain("token=");
    expect(JSON.parse(post?.body ?? "{}")).toEqual({ token: TOKEN });
  });

  it("'already used' and 'expired' are two codes at one status", async () => {
    const consumed = mockServer({
      "GET /user/data-export/status": { body: EXPORT_PARTIAL },
      "POST /user/data-export/download": DOWNLOAD_CONSUMED,
    });
    const view = mount(consumed);
    await ready();
    screen.getByTestId("download").click();
    await waitFor(() =>
      expect(screen.getByTestId("download-error").textContent).toBe(
        "error.410.gdpr.download_consumed"
      )
    );
    view.unmount();

    const expired = mockServer({
      "GET /user/data-export/status": { body: EXPORT_PARTIAL },
      "POST /user/data-export/download": DOWNLOAD_EXPIRED,
    });
    mount(expired);
    await ready();
    screen.getByTestId("download").click();
    await waitFor(() =>
      expect(screen.getByTestId("download-error").textContent).toBe(
        "error.410.gdpr.download_expired"
      )
    );
  });

  it("re-reads the status after a download attempt, however it ended", async () => {
    // The archive is DELETED the moment it is served and the token is spent —
    // including when this tab lost the race and got `download_consumed`.
    let spent = false;
    const server = mockServer({
      "GET /user/data-export/status": () => ({
        body: spent
          ? { ...EXPORT_PARTIAL, download_available: false }
          : EXPORT_PARTIAL,
      }),
      "POST /user/data-export/download": () => {
        spent = true;
        return DOWNLOAD_CONSUMED;
      },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("available").textContent).toBe("true");
    screen.getByTestId("download").click();
    await waitFor(() =>
      expect(screen.getByTestId("available").textContent).toBe("false")
    );
  });
});
