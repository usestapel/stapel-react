import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useAccountClosure } from "../src/index.js";
import {
  CLOSURE_ALREADY_PENDING,
  LEGAL_HOLD,
  NO_ACTIVE_CLOSURE,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import { DELETING, IN_GRACE } from "./fixtures.js";

/**
 * The hook, exercised through the REAL client against real-shaped bodies. A
 * probe renders the bag's discriminant as text, so an assertion reads the same
 * states a skin does — there is no way to observe "ready with no closure"
 * here without the 404 actually having been answered and folded.
 */
function Probe(): ReactElement {
  const bag = useAccountClosure();
  return (
    <div>
      <span data-testid="load">{bag.state.status}</span>
      <span data-testid="status">{bag.status ?? "—"}</span>
      <span data-testid="closing">{String(bag.closing)}</span>
      <span data-testid="grace">{bag.graceEndsAt ?? "—"}</span>
      <span data-testid="can-cancel">{String(bag.canCancel)}</span>
      <span data-testid="error">
        {bag.state.status === "failed" ? String(bag.state.error) : ""}
      </span>
      <button
        data-testid="initiate"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => bag.initiate.mutate()}
      >
        {"initiate"}
      </button>
      <button
        data-testid="cancel"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => bag.cancel.mutate()}
      >
        {"cancel"}
      </button>
      <span data-testid="initiate-error">
        {bag.initiate.error ? bag.initiate.error.code : ""}
      </span>
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

describe("useAccountClosure — the 404 that means 'you are fine'", () => {
  it("folds error.404.gdpr.no_active_closure into a ready answer of null", async () => {
    const server = mockServer({ "/user/account/close/status": NO_ACTIVE_CLOSURE });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("none");
    expect(screen.getByTestId("closing").textContent).toBe("false");
    expect(screen.getByTestId("error").textContent).toBe("");
  });

  it("does NOT fold a 404 that means something else", async () => {
    // The module has three 404s. Swallowing the wrong one would hide a real
    // miss behind "your account is fine".
    const server = mockServer({
      "/user/account/close/status": {
        status: 404,
        body: { localizable_error: "error.404.gdpr.export_not_found" },
      },
    });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
    expect(screen.getByTestId("status").textContent).toBe("—");
  });

  it("a transport failure stays failed — never 'nothing is being deleted'", async () => {
    const server = mockServer({
      "/user/account/close/status": { status: 500, body: {} },
    });
    mount(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
    expect(screen.getByTestId("status").textContent).toBe("—");
    expect(screen.getByTestId("closing").textContent).toBe("false");
  });
});

describe("useAccountClosure — a closure on record", () => {
  it("reports the server's date and the cancel affordance, in grace", async () => {
    const server = mockServer({ "/user/account/close/status": { body: IN_GRACE } });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("grace");
    expect(screen.getByTestId("closing").textContent).toBe("true");
    // Straight off the wire: no arithmetic, no countdown, no reformatting in
    // the model layer.
    expect(screen.getByTestId("grace").textContent).toBe(IN_GRACE.grace_ends_at);
    expect(screen.getByTestId("can-cancel").textContent).toBe("true");
  });

  it("stops offering a cancel once the erasure is running", async () => {
    const server = mockServer({ "/user/account/close/status": { body: DELETING } });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("deleting");
    expect(screen.getByTestId("closing").textContent).toBe("true");
    expect(screen.getByTestId("can-cancel").textContent).toBe("false");
  });
});

describe("useAccountClosure — the two writes", () => {
  it("initiate posts to close and the state follows the server, not a guess", async () => {
    // The mock is STATEFUL because the server is: once a closure exists, the
    // status read stops answering 404. The hook seeds the cache from the
    // write's own response and then invalidates, so this also proves the
    // invalidation actually re-reads rather than trusting the seed forever.
    let closureExists = false;
    const server = mockServer({
      "GET /user/account/close/status": () =>
        closureExists ? { body: IN_GRACE } : NO_ACTIVE_CLOSURE,
      "POST /user/account/close": () => {
        closureExists = true;
        return { status: 202, body: IN_GRACE };
      },
    });
    mount(server);
    await ready();
    screen.getByTestId("initiate").click();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("grace")
    );
    expect(
      server.calls.some(
        (c) => c.method === "POST" && c.url.endsWith("/user/account/close")
      )
    ).toBe(true);
  });

  it("cancel resolves to the null the next read would answer, not to a cancelled row", async () => {
    // The module EXCLUDES cancelled rows from the status read, so caching the
    // response body would leave a row on screen that no refetch could produce.
    let cancelled = false;
    const server = mockServer({
      "GET /user/account/close/status": () =>
        cancelled ? NO_ACTIVE_CLOSURE : { body: IN_GRACE },
      "POST /user/account/cancel-close": () => {
        cancelled = true;
        return { body: { ...IN_GRACE, status: "cancelled", can_cancel: false } };
      },
    });
    mount(server);
    await ready();
    expect(screen.getByTestId("status").textContent).toBe("grace");
    screen.getByTestId("cancel").click();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("none")
    );
    expect(screen.getByTestId("closing").textContent).toBe("false");
  });

  it("a legal hold reaches the caller as its own code, never as a generic 409", async () => {
    const server = mockServer({
      "GET /user/account/close/status": NO_ACTIVE_CLOSURE,
      "POST /user/account/close": LEGAL_HOLD,
    });
    mount(server);
    await ready();
    screen.getByTestId("initiate").click();
    await waitFor(() =>
      expect(screen.getByTestId("initiate-error").textContent).toBe(
        "error.409.gdpr.legal_hold"
      )
    );
    // And it did not silently become a closure.
    expect(screen.getByTestId("status").textContent).toBe("none");
  });

  it("'already pending' re-reads the state instead of leaving a stale answer", async () => {
    let closureExists = false;
    const server = mockServer({
      "GET /user/account/close/status": () =>
        closureExists ? { body: IN_GRACE } : NO_ACTIVE_CLOSURE,
      "POST /user/account/close": () => {
        // Another tab won the race: the server refuses, and the truth is that
        // a closure now exists.
        closureExists = true;
        return CLOSURE_ALREADY_PENDING;
      },
    });
    mount(server);
    await ready();
    screen.getByTestId("initiate").click();
    await waitFor(() =>
      expect(screen.getByTestId("status").textContent).toBe("grace")
    );
    expect(screen.getByTestId("initiate-error").textContent).toBe(
      "error.409.gdpr.closure_already_pending"
    );
  });
});
