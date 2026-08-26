/**
 * `<TaskSheet>` — the edits, and the two states where it must refuse.
 *
 * The assertions here are about REQUESTS: a save-on-blur that never PATCHes is
 * the defect this file exists to catch, and it is invisible to a render-only
 * test. So every case reads what the pair actually put on the wire.
 */
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TaskSheet } from "../src/default/index.js";
import { Harness, TASK_ID, setViewport } from "./helpers.js";

const PHONE = 390;
const DESKTOP = 1280;

const columns = [
  {
    id: "c1",
    board_id: "b",
    key: "todo",
    name: "To do",
    name_key: "",
    order: 0,
    category: "backlog",
    wip_limit: null,
  },
  {
    id: "c2",
    board_id: "b",
    key: "done",
    name: "Done",
    name_key: "",
    order: 1,
    category: "done",
    wip_limit: null,
  },
];

const checklist = [
  { id: "s1", text: "Collect the numbers", state: "done", order: 0 },
  { id: "s2", text: "Write the summary", state: "pending", order: 1 },
  { id: "s3", text: "Ask legal", state: "failed", order: 2 },
];

const comments = [
  {
    id: "m1",
    task_id: TASK_ID,
    author_id: null,
    body: "The numbers are in the sheet.",
    created_at: "2026-08-12T11:20:00Z",
  },
];

function taskRow(over: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    board_id: "b",
    column: "todo",
    category: "backlog",
    position: "1",
    title: "Draft the launch post",
    description: "Two paragraphs.",
    creator_id: null,
    assignee_ids: ["11111111-2222-4333-8444-555555555555"],
    priority: 3,
    due_at: "2026-09-02T00:00:00Z",
    parent_id: null,
    blocked_by_ids: [],
    features: {},
    completed_at: null,
    is_archived: false,
    checklist,
    created_at: "2026-08-01T09:00:00Z",
    ...over,
  };
}

interface Sent {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
}

/** A fetch that records every write and answers the three reads. */
function recordingFetch(sent: Sent[], task = taskRow()): typeof globalThis.fetch {
  return ((input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      sent.push({
        method,
        url,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });
    }
    const body = url.includes("/comments")
      ? comments
      : url.includes("/checklist")
        ? checklist
        : task;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
  }) as typeof globalThis.fetch;
}

function renderSheet(sent: Sent[], task = taskRow()) {
  return render(
    <Harness fetch={recordingFetch(sent, task)}>
      <TaskSheet
        open
        taskId={TASK_ID}
        onClose={() => undefined}
        columns={columns}
        onColumnChange={() => undefined}
      />
    </Harness>
  );
}

afterEach(() => {
  cleanup();
});

describe("<TaskSheet> — save on blur, per field", () => {
  it("PATCHes the title when it loses focus, and only when it changed", async () => {
    const sent: Sent[] = [];
    setViewport(DESKTOP);
    renderSheet(sent);
    const title = await screen.findByTestId("tasks-task-title");

    // Blur with no edit: nothing goes to the server.
    fireEvent.blur(title);
    expect(sent).toEqual([]);

    fireEvent.change(title, { target: { value: "A better title" } });
    fireEvent.blur(title);
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.method).toBe("PATCH");
    expect(sent[0]?.url).toContain(`tasks/${TASK_ID}`);
    expect(sent[0]?.body).toEqual({ title: "A better title" });
  });

  it("refuses to save an empty title rather than blanking the card", async () => {
    const sent: Sent[] = [];
    setViewport(DESKTOP);
    renderSheet(sent);
    const title = await screen.findByTestId("tasks-task-title");
    fireEvent.change(title, { target: { value: "   " } });
    fireEvent.blur(title);
    expect(sent).toEqual([]);
  });

  it("PATCHes the description on blur, with only that field", async () => {
    const sent: Sent[] = [];
    setViewport(DESKTOP);
    renderSheet(sent);
    const description = await screen.findByTestId("tasks-task-description");
    fireEvent.change(description, { target: { value: "Three paragraphs." } });
    fireEvent.blur(description);
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toEqual({ description: "Three paragraphs." });
  });

  it("sends a cleared due date as null, not as an empty string", async () => {
    const sent: Sent[] = [];
    setViewport(DESKTOP);
    renderSheet(sent);
    const due = await screen.findByTestId("tasks-task-due");
    fireEvent.change(due, { target: { value: "" } });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.body).toEqual({ due_at: null });
  });
});

describe("<TaskSheet> — the checklist has THREE states, not a checkbox", () => {
  it("toggles done and pending through the checkbox", async () => {
    const sent: Sent[] = [];
    setViewport(PHONE);
    renderSheet(sent);
    await screen.findByTestId("tasks-step-s2");
    fireEvent.click(screen.getByLabelText("Mark Write the summary done"));
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.url).toContain(`tasks/${TASK_ID}/checklist/s2/state`);
    expect(sent[0]?.body).toEqual({ state: "done" });
  });

  it("names the checkbox after what clicking it will DO", async () => {
    setViewport(PHONE);
    renderSheet([]);
    await screen.findByTestId("tasks-step-check-s2");
    expect(screen.getByLabelText("Mark Write the summary done")).toBeTruthy();
    expect(screen.getByLabelText("Mark Collect the numbers not done")).toBeTruthy();
  });

  it("shows a failed step as failed, and offers the state menu with a label", async () => {
    setViewport(PHONE);
    renderSheet([]);
    await screen.findByTestId("tasks-step-s3");
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.getByLabelText("More actions for Ask legal")).toBeTruthy();
  });
});

describe("<TaskSheet> — comments", () => {
  it("Enter sends and Shift+Enter does not", async () => {
    const sent: Sent[] = [];
    setViewport(DESKTOP);
    renderSheet(sent);
    const input = await screen.findByTestId("tasks-comment-input");

    fireEvent.change(input, { target: { value: "Looks good" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    expect(sent).toEqual([]);

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => {
      expect(sent).toHaveLength(1);
    });
    expect(sent[0]?.url).toContain(`tasks/${TASK_ID}/comments`);
    expect(sent[0]?.body).toEqual({ body: "Looks good" });
  });

  it("the send button states why it is off while the box is empty", async () => {
    setViewport(PHONE);
    renderSheet([]);
    await screen.findByTestId("tasks-comment-input");
    const gate = document.querySelector('[data-testid="tasks-comment-send-gate"]');
    expect(gate?.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(gate?.textContent).toContain("Write something first");
  });
});

describe("<TaskSheet> — the two refusals it owes", () => {
  it("an archived card is read-only, with ONE reason repeated beside the controls", async () => {
    setViewport(DESKTOP);
    renderSheet([], taskRow({ is_archived: true }));
    await screen.findByTestId("tasks-task-archived");
    const titleGate = document.querySelector('[data-testid="tasks-task-title-gate"]');
    expect(titleGate?.getAttribute("data-stapel-gated")).toBe("blocked");
    expect(titleGate?.textContent).toContain("This card is archived");
    expect(
      document
        .querySelector('[data-testid="tasks-task-description-gate"]')
        ?.getAttribute("data-stapel-gated")
    ).toBe("blocked");
  });

  it("with no people picker wired, assignees are readable and the reason is stated", async () => {
    setViewport(PHONE);
    renderSheet([]);
    await screen.findByTestId("tasks-task-no-picker");
    expect(
      screen.getByText(/has not wired a people picker/)
    ).toBeTruthy();
    // …and the ids are still shown, shortened, rather than hidden.
    expect(screen.getByText("11")).toBeTruthy();
  });

  it("is a bottom sheet on a phone and a modal above the breakpoint", async () => {
    setViewport(PHONE);
    renderSheet([]);
    await screen.findByTestId("tasks-task-body");
    expect(
      document
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("sheet");
    cleanup();

    setViewport(DESKTOP);
    renderSheet([]);
    await screen.findByTestId("tasks-task-body");
    expect(
      document
        .querySelector("[data-stapel-dialog-surface]")
        ?.getAttribute("data-stapel-dialog-surface")
    ).toBe("modal");
  });
});
