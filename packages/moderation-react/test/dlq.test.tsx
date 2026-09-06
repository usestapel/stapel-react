/**
 * The dead-letter park, and the one claim the whole feature rests on: it is
 * NOT the moderator's queue.
 *
 * Every assertion here is about that separation surviving something — a wire
 * request, a grouping, a headline, a bulk write. Backend 0.7.0 split the two
 * states because a screening failure written down as a `needs_review` verdict
 * let a 78% failure rate look like a busy queue for twelve days; a console
 * that mixes them again is the same defect one layer up, and these are the
 * tests that would go red before it shipped.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DlqQueue, ModerationQueue } from "../src/default/admin/index.js";
import { groupByErrorClass } from "../src/index.js";
import { TestProviders, envelope, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  CASE_DETAIL_DLQ,
  CASE_DLQ_CONTENT,
  CASE_DLQ_CONTENT_2,
  CASE_DLQ_SCREENER,
  CASE_EVENTS_DLQ,
  CASE_QUEUED,
  POLICY,
  STATS,
} from "../demo/_fixtures.js";

const PARKED = [CASE_DLQ_CONTENT, CASE_DLQ_CONTENT_2, CASE_DLQ_SCREENER];

/**
 * The two lists answer differently, which is the point: `state=dlq` is matched
 * BEFORE the bare `/cases`, so a screen that forgot to ask for a state gets
 * the queue and a screen that asked for the park gets the park.
 */
function console_(): MockServer {
  return mockServer({
    "POST /rescan": { status: 202, body: { task_id: "t-1" } },
    "/policy": { body: POLICY },
    "/stats": { body: STATS },
    "GET state=dlq": { body: PARKED },
    "/cases/": { body: CASE_DETAIL_DLQ },
    "/cases": { body: [CASE_QUEUED] },
  });
}

/** Every `GET /cases…` the screen issued, as query strings. */
function caseReads(server: MockServer): string[] {
  return server.calls
    .filter((call) => call.method === "GET" && call.url.includes("/cases?"))
    .map((call) => call.url);
}

describe("the park is a different list from the queue", () => {
  it("the queue asks for state=queued — an unfiltered read now carries dlq rows", async () => {
    const server = console_();
    render(
      <TestProviders server={server}>
        <ModerationQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-queue-rows");
    const reads = caseReads(server);
    expect(reads.length).toBeGreaterThan(0);
    for (const url of reads) expect(url).toContain("state=queued");
    // Nothing may go out without a state at all: that read is the mixture.
    expect(reads.some((url) => !url.includes("state="))).toBe(false);
  });

  it("the DLQ tab lists the parked rows and none of the queue's", async () => {
    const server = console_();
    render(
      <TestProviders server={server}>
        <ModerationQueue initialTab="dlq" />
      </TestProviders>
    );
    const park = await screen.findByTestId("moderation-queue-dlq-groups");
    expect(park.textContent).toContain(CASE_DLQ_CONTENT.target_key);
    expect(park.textContent).toContain(CASE_DLQ_SCREENER.target_key);
    // The queue's own row is not in it — the two tabs are two reads.
    expect(park.textContent).not.toContain(CASE_QUEUED.target_key);
    expect(caseReads(server).some((url) => url.includes("state=dlq"))).toBe(true);
  });
});

describe("grouped by what broke, because that is what gets repaired", () => {
  it("puts the two faults in two groups, biggest first", () => {
    const groups = groupByErrorClass(PARKED);
    expect(groups.map((group) => group.errorClass)).toEqual([
      "ContentUnavailable",
      "ScreeningUnavailable",
    ]);
    expect(groups.map((group) => group.count)).toEqual([2, 1]);
    // Oldest dead letter first inside a group: "since when" is the question.
    expect(groups[0]?.rows.map((row) => row.id)).toEqual([
      CASE_DLQ_CONTENT.id,
      CASE_DLQ_CONTENT_2.id,
    ]);
  });

  it("draws a card per class and keeps the message behind one click", async () => {
    render(
      <TestProviders server={console_()}>
        <DlqQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-dlq-group-ContentUnavailable");
    await screen.findByTestId("moderation-dlq-group-ScreeningUnavailable");
    expect(screen.queryByTestId(`moderation-dlq-error-${CASE_DLQ_CONTENT.id}`)).toBeNull();

    fireEvent.click(screen.getByTestId(`moderation-dlq-toggle-${CASE_DLQ_CONTENT.id}`));
    const shown = await screen.findByTestId(
      `moderation-dlq-error-${CASE_DLQ_CONTENT.id}`
    );
    expect(shown.textContent).toContain("moderation_content");
  });
});

describe("a dead letter is sent back, one row or all of them", () => {
  it("one row rescans that case and nothing else", async () => {
    const server = console_();
    render(
      <TestProviders server={server}>
        <DlqQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-dlq-groups");
    fireEvent.click(screen.getByTestId(`moderation-dlq-rescan-${CASE_DLQ_SCREENER.id}`));
    await waitFor(() => {
      expect(
        server.calls.filter(
          (call) => call.method === "POST" && call.url.includes("/rescan")
        ).length
      ).toBe(1);
    });
    expect(
      server.calls.find(
        (call) => call.method === "POST" && call.url.includes("/rescan")
      )?.url
    ).toContain(CASE_DLQ_SCREENER.id);
  });

  it("optimistically moves the rescanned row out of `dlq`, in place", async () => {
    render(
      <TestProviders server={console_()}>
        <DlqQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-dlq-groups");
    const row = screen.getByTestId(`moderation-dlq-row-${CASE_DLQ_SCREENER.id}`);
    expect(row.textContent).toContain("Never screened");
    fireEvent.click(screen.getByTestId(`moderation-dlq-rescan-${CASE_DLQ_SCREENER.id}`));
    // Shown as queued where it stands, not vanished: a row that disappears
    // under the finger cannot be told from one that failed to send.
    await waitFor(() =>
      expect(
        screen.getByTestId(`moderation-dlq-row-${CASE_DLQ_SCREENER.id}`).textContent
      ).toContain("Waiting for a person")
    );
  });

  it("«rescan them all» calls it per row and counts as it goes", async () => {
    const server = console_();
    render(
      <TestProviders server={server}>
        <DlqQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-dlq-groups");
    fireEvent.click(screen.getByTestId("moderation-dlq-rescan-all"));
    await waitFor(() => {
      expect(
        server.calls.filter(
          (call) => call.method === "POST" && call.url.includes("/rescan")
        ).length
      ).toBe(PARKED.length);
    });
    // One POST per parked case, and every one of them named.
    for (const row of PARKED) {
      expect(
        server.calls.some(
          (call) => call.method === "POST" && call.url.includes(`${row.id}/rescan`)
        )
      ).toBe(true);
    }
    const progress = await screen.findByTestId("moderation-dlq-progress");
    expect(progress.textContent).toContain(`${PARKED.length} of ${PARKED.length}`);
  });

  it("a row the server refuses stays in the park, and is counted", async () => {
    const server = mockServer({
      "POST /rescan": envelope(409, "error.409.moderation_case_resolved"),
      "/policy": { body: POLICY },
      "/stats": { body: STATS },
      "GET state=dlq": { body: [CASE_DLQ_SCREENER] },
      "/cases": { body: [] },
    });
    render(
      <TestProviders server={server}>
        <DlqQueue />
      </TestProviders>
    );
    await screen.findByTestId("moderation-dlq-groups");
    fireEvent.click(screen.getByTestId("moderation-dlq-rescan-all"));
    const failed = await screen.findByTestId("moderation-dlq-progress-failed");
    expect(failed.textContent).toContain("1");
    expect(
      screen.getByTestId(`moderation-dlq-row-${CASE_DLQ_SCREENER.id}`).textContent
    ).toContain("Never screened");
  });
});

describe("the headline is two numbers and never their sum", () => {
  it("prints queue_total and dlq_total, and not open_total", async () => {
    render(
      <TestProviders server={console_()}>
        <ModerationQueue />
      </TestProviders>
    );
    const stats = await screen.findByTestId("moderation-queue-stats");
    await waitFor(() => expect(stats.textContent).toContain("Waiting for a moderator"));
    expect(stats.textContent).toContain(String(STATS.queue_total));
    expect(stats.textContent).toContain("Never screened");
    expect(stats.textContent).toContain(String(STATS.dlq_total));
    // 18 is `open_total` — queue plus park plus the transient states. Drawing
    // it is what let an outage read as work.
    expect(stats.textContent).not.toContain(String(STATS.open_total));
  });
});

describe("the case card says a dead letter is not a decision", () => {
  it("badges the state and shows the failure the audit row carries", async () => {
    const server = mockServer({
      "/policy": { body: POLICY },
      "/stats": { body: STATS },
      "GET state=dlq": { body: [CASE_DLQ_CONTENT] },
      "/cases/": (call) =>
        call.url.includes("/events")
          ? { body: CASE_EVENTS_DLQ }
          : { body: CASE_DETAIL_DLQ },
      "/cases": { body: [] },
    });
    render(
      <TestProviders server={server}>
        <DlqQueue />
      </TestProviders>
    );
    // Reached the way a reader reaches it: from the park.
    await screen.findByTestId("moderation-dlq-groups");
    fireEvent.click(screen.getByTestId(`moderation-dlq-open-${CASE_DLQ_CONTENT.id}`));
    const badge = await screen.findByTestId("moderation-dlq-case-dlq");
    expect(badge.textContent).toContain("DLQ");
    expect(badge.textContent).toContain("ContentUnavailable");
    expect(badge.textContent).toContain("never screened");
    const detail = await screen.findByTestId("moderation-dlq-case-dlq-error");
    expect(detail.textContent).toContain("moderation_content");
  });
});
