import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useMyErasures, useRequestErasure } from "../src/index.js";
import {
  ERASURE_FORBIDDEN,
  TestProviders,
  UNKNOWN_SUBJECT_TYPE,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import { ERASURE_DONE, ERASURE_ERASING, ERASURE_TIMEOUT } from "./fixtures.js";

function Probe(): ReactElement {
  const bag = useMyErasures();
  const request = useRequestErasure();
  return (
    <div>
      <span data-testid="load">{bag.rows.status}</span>
      <span data-testid="ids">
        {bag.rows.status === "ready"
          ? bag.rows.data.map((row) => row.request_id).join(",")
          : ""}
      </span>
      <span data-testid="pending">
        {bag.pending.map((row) => row.request_id).join(",")}
      </span>
      <span data-testid="overdue">
        {bag.overdue.map((row) => row.request_id).join(",")}
      </span>
      <span data-testid="clocks">
        {bag.rows.status === "ready" && bag.rows.data[0]
          ? `${bag.rows.data[0].due_at}|${bag.rows.data[0].fully_erased_by}`
          : ""}
      </span>
      <button
        data-testid="erase"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() =>
          request.mutate({ subjectType: "recording", subjectKey: "9f1c2d3e" })
        }
      >
        {"erase"}
      </button>
      <span data-testid="erase-error">
        {request.error ? request.error.code : ""}
      </span>
      <span data-testid="erase-id">{request.data?.request_id ?? ""}</span>
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

describe("useMyErasures — the list a person checks", () => {
  it("loading is not empty: the first paint reports `loading`", () => {
    const server = mockServer({ "/me/erasures": { body: [] } });
    mount(server);
    expect(screen.getByTestId("load").textContent).toBe("loading");
  });

  it("a genuinely empty list is `ready` with no rows — a real answer", async () => {
    const server = mockServer({ "/me/erasures": { body: [] } });
    mount(server);
    await ready();
    expect(screen.getByTestId("ids").textContent).toBe("");
  });

  it("a failed read is `failed` — never 'nothing is being deleted'", async () => {
    const server = mockServer({ "/me/erasures": { status: 500, body: {} } });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
    expect(screen.getByTestId("pending").textContent).toBe("");
    expect(screen.getByTestId("overdue").textContent).toBe("");
  });

  it("splits what is still running from what an owner never receipted", async () => {
    const server = mockServer({
      "/me/erasures": {
        body: [ERASURE_ERASING, ERASURE_TIMEOUT, ERASURE_DONE],
      },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("pending").textContent).toBe("17");
    // `timeout` is surfaced, not swallowed: an owner's silence is the module's
    // whole reason for having a receipt table.
    expect(screen.getByTestId("overdue").textContent).toBe("18");
  });

  it("carries BOTH clocks, and they are not the same date", async () => {
    // due_at = our own purge SLA; fully_erased_by = that stretched to the last
    // subprocessor's contractual window. A pair that kept one would be stating
    // the shorter as if it were the whole truth.
    const server = mockServer({ "/me/erasures": { body: [ERASURE_ERASING] } });
    mount(server);
    await ready();
    const [due, fully] = (screen.getByTestId("clocks").textContent ?? "").split("|");
    expect(due).toBe(ERASURE_ERASING.due_at);
    expect(fully).toBe(ERASURE_ERASING.fully_erased_by);
    expect(due).not.toBe(fully);
  });
});

describe("useRequestErasure — the mutation a host calls after its own delete", () => {
  it("posts the subject pair in the module's own snake_case", async () => {
    const server = mockServer({
      "GET /me/erasures": { body: [] },
      "POST /erasures": { status: 202, body: ERASURE_ERASING },
    });
    mount(server);
    await ready();
    screen.getByTestId("erase").click();
    await waitFor(() =>
      expect(screen.getByTestId("erase-id").textContent).toBe("17")
    );
    const post = server.calls.find(
      (c) => c.method === "POST" && c.url.endsWith("/erasures")
    );
    expect(post).toBeDefined();
    expect(JSON.parse(post?.body ?? "{}")).toEqual({
      subject_type: "recording",
      subject_key: "9f1c2d3e",
    });
  });

  it("refreshes the list from the server rather than splicing the new row in", async () => {
    let opened = false;
    const server = mockServer({
      "GET /me/erasures": () => ({ body: opened ? [ERASURE_ERASING] : [] }),
      "POST /erasures": () => {
        opened = true;
        return { status: 202, body: ERASURE_ERASING };
      },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("ids").textContent).toBe("");
    screen.getByTestId("erase").click();
    await waitFor(() =>
      expect(screen.getByTestId("ids").textContent).toBe("17")
    );
  });

  it("the authorizer's 403 arrives as its own code, not as a generic failure", async () => {
    // The default ERASURE_AUTHORIZER is staff-only, so this is usually the
    // HOST's missing ownership predicate — not a statement about this person.
    const server = mockServer({
      "GET /me/erasures": { body: [] },
      "POST /erasures": ERASURE_FORBIDDEN,
    });
    mount(server);
    await ready();
    screen.getByTestId("erase").click();
    await waitFor(() =>
      expect(screen.getByTestId("erase-error").textContent).toBe(
        "error.403.gdpr.erasure_forbidden"
      )
    );
    expect(screen.getByTestId("ids").textContent).toBe("");
  });

  it("an unknown subject type is a 400 with its own code, not a 403", async () => {
    const server = mockServer({
      "GET /me/erasures": { body: [] },
      "POST /erasures": UNKNOWN_SUBJECT_TYPE,
    });
    mount(server);
    await ready();
    screen.getByTestId("erase").click();
    await waitFor(() =>
      expect(screen.getByTestId("erase-error").textContent).toBe(
        "error.400.gdpr.unknown_subject_type"
      )
    );
  });
});
