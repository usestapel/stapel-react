import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { useDsar, useDsarQueue, useUpdateDsar } from "../src/index.js";
import {
  CAPTCHA_INVALID,
  STAFF_ONLY,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  DSAR_ACKNOWLEDGED,
  DSAR_ACK_OVERDUE,
  DSAR_RESOLVED,
} from "./fixtures.js";

function IntakeProbe(props: { anonymous?: boolean }): ReactElement {
  const bag = useDsar();
  return (
    <div>
      <span data-testid="reference">{bag.submitted?.request_id ?? ""}</span>
      <span data-testid="ack-due">{bag.submitted?.ack_due_at ?? ""}</span>
      <span data-testid="error">{bag.submit.error ? bag.submit.error.code : ""}</span>
      <button
        data-testid="submit"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() =>
          bag.submit.mutate(
            props.anonymous === true
              ? {
                  variant: "anonymous",
                  kind: "erasure",
                  email: "person@example.com",
                  note: "please",
                  captchaToken: "cap-1",
                }
              : { variant: "app", kind: "access" }
          )
        }
      >
        {"submit"}
      </button>
    </div>
  );
}

function QueueProbe(): ReactElement {
  const bag = useDsarQueue();
  const update = useUpdateDsar();
  return (
    <div>
      <span data-testid="load">{bag.rows.status}</span>
      <span data-testid="ids">
        {bag.rows.status === "ready"
          ? bag.rows.data.map((row) => row.request_id).join(",")
          : ""}
      </span>
      <span data-testid="ack-overdue">
        {bag.ackOverdue.map((row) => row.request_id).join(",")}
      </span>
      <span data-testid="resolve-overdue">
        {bag.resolveOverdue.map((row) => row.request_id).join(",")}
      </span>
      <span data-testid="failed">
        {bag.rows.status === "failed" ? String(bag.rows.error) : ""}
      </span>
      <button
        data-testid="patch"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => update.mutate({ dsarId: 5, state: "in_progress" })}
      >
        {"patch"}
      </button>
      <button
        data-testid="match"
        data-analytics="none"
        data-analytics-reason="test probe"
        onClick={() => update.mutate({ dsarId: 5, userId: "u-9a1f" })}
      >
        {"match"}
      </button>
    </div>
  );
}

const mountIntake = (
  server: MockServer,
  anonymous?: boolean
): ReturnType<typeof render> =>
  render(
    <TestProviders server={server}>
      <IntakeProbe {...(anonymous !== undefined ? { anonymous } : {})} />
    </TestProviders>
  );

const mountQueue = (server: MockServer): ReturnType<typeof render> =>
  render(
    <TestProviders server={server}>
      <QueueProbe />
    </TestProviders>
  );

describe("useDsar — one endpoint, two callers the type keeps apart", () => {
  it("the app variant sends no email: the server reads it off the session", async () => {
    const server = mockServer({
      "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED },
    });
    mountIntake(server);
    screen.getByTestId("submit").click();
    await waitFor(() =>
      expect(screen.getByTestId("reference").textContent).toBe("5")
    );
    const post = server.calls.find((c) => c.method === "POST");
    expect(JSON.parse(post?.body ?? "{}")).toEqual({ kind: "access" });
  });

  it("the anonymous variant carries the email, the note and the captcha token", async () => {
    const server = mockServer({
      "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED },
    });
    mountIntake(server, true);
    screen.getByTestId("submit").click();
    await waitFor(() =>
      expect(screen.getByTestId("reference").textContent).toBe("5")
    );
    const post = server.calls.find((c) => c.method === "POST");
    expect(JSON.parse(post?.body ?? "{}")).toEqual({
      kind: "erasure",
      note: "please",
      email: "person@example.com",
      captcha_token: "cap-1",
    });
  });

  it("keeps the acknowledgement the person walks away with", async () => {
    // The row's creation sends the acknowledgement and stamps `ack_sent_at`,
    // which is how the three-business-day clock is met by machinery. So the
    // success arm has a reference and a date to show, and the hook holds them.
    const server = mockServer({
      "POST /dsar": { status: 201, body: DSAR_ACKNOWLEDGED },
    });
    mountIntake(server);
    screen.getByTestId("submit").click();
    await waitFor(() =>
      expect(screen.getByTestId("ack-due").textContent).toBe(
        DSAR_ACKNOWLEDGED.ack_due_at
      )
    );
  });

  it("a captcha refusal arrives as a captcha code, not as a generic 400", async () => {
    const server = mockServer({ "POST /dsar": CAPTCHA_INVALID });
    mountIntake(server, true);
    screen.getByTestId("submit").click();
    await waitFor(() =>
      expect(screen.getByTestId("error").textContent).toBe(
        "error.400.captcha_invalid"
      )
    );
    expect(screen.getByTestId("reference").textContent).toBe("");
  });
});

describe("useDsarQueue — the two deadlines, and who they blame", () => {
  it("flags an unacknowledged request past its ack deadline", async () => {
    const server = mockServer({
      "GET /dsar": { body: [DSAR_ACKNOWLEDGED, DSAR_ACK_OVERDUE, DSAR_RESOLVED] },
    });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("ready")
    );
    // The acknowledgement is AUTOMATED, so this row means the notification
    // wiring is broken — not that an operator was slow.
    expect(screen.getByTestId("ack-overdue").textContent).toBe("6");
  });

  it("does not flag a request that was acknowledged, however old", async () => {
    const server = mockServer({ "GET /dsar": { body: [DSAR_RESOLVED] } });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("ready")
    );
    expect(screen.getByTestId("ack-overdue").textContent).toBe("");
  });

  it("a resolved request past its resolve date is closed, not overdue", async () => {
    const server = mockServer({
      "GET /dsar": { body: [DSAR_RESOLVED, DSAR_ACK_OVERDUE] },
    });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("ready")
    );
    expect(screen.getByTestId("resolve-overdue").textContent).toBe("6");
  });

  it("the staff refusal is a failure with core's generic code, not an empty queue", async () => {
    const server = mockServer({ "GET /dsar": STAFF_ONLY });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("failed")
    );
    expect(screen.getByTestId("failed").textContent).toContain("permission");
    expect(screen.getByTestId("ids").textContent).toBe("");
  });
});

describe("useUpdateDsar — staff triage", () => {
  it("patches the state onto one request", async () => {
    const server = mockServer({
      "GET /dsar": { body: [DSAR_ACKNOWLEDGED] },
      "PATCH /dsar/5": {
        body: { ...DSAR_ACKNOWLEDGED, state: "in_progress" },
      },
    });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("ready")
    );
    screen.getByTestId("patch").click();
    await waitFor(() => {
      const patch = server.calls.find((c) => c.method === "PATCH");
      expect(patch).toBeDefined();
      expect(JSON.parse(patch?.body ?? "{}")).toEqual({ state: "in_progress" });
    });
  });

  it("matching a request to an account sends `user_id` and nothing else", async () => {
    // This is the moment the machine that ANSWERS the request starts — an
    // erasure becomes the cancellable closure, an access request an export —
    // which is why intake refuses to do it from an unverified email.
    const server = mockServer({
      "GET /dsar": { body: [DSAR_ACKNOWLEDGED] },
      "PATCH /dsar/5": { body: DSAR_ACKNOWLEDGED },
    });
    mountQueue(server);
    await waitFor(() =>
      expect(screen.getByTestId("load").textContent).toBe("ready")
    );
    screen.getByTestId("match").click();
    await waitFor(() => {
      const patch = server.calls.find((c) => c.method === "PATCH");
      expect(JSON.parse(patch?.body ?? "{}")).toEqual({ user_id: "u-9a1f" });
    });
  });
});
