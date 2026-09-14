import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import {
  FixIssueDialog,
  IssueDetail,
  IssuesFeed,
  MuteIssueDialog,
  levelFamily,
  statusFamily,
} from "../src/default/index.js";
import { ISSUE_LEVELS, ISSUE_STATUSES } from "../src/index.js";
import {
  ISSUE_NOT_FOUND,
  STAFF_ONLY,
  TestProviders,
  UNAUTHORIZED,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import {
  BOARD,
  FATAL,
  FATAL_DETAIL,
  MUTED,
  REGRESSED_DETAIL,
  SWEPT_DETAIL,
  makeIssue,
  makePage,
} from "./fixtures.js";

/**
 * The §54 default skin, rendered against the real wire.
 *
 * The load-bearing assertions are the ones about what a screen says when it
 * has NOTHING to show: an error tracker that draws a refusal, a filtered
 * miss and a quiet fleet the same way has told an operator "nothing is
 * broken" three times, and only one of them was true.
 */
function mount(server: MockServer, node: ReactElement): void {
  render(<TestProviders server={server}>{node}</TestProviders>);
}

describe("<IssuesFeed>", () => {
  it("draws every row, grouped by the service that reported it", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    mount(server, <IssuesFeed />);
    await screen.findByTestId("alerts-feed-groups");
    expect(await screen.findByTestId("alerts-feed-group-svc-billing")).toBeTruthy();
    expect(await screen.findByTestId("alerts-feed-group-svc-api")).toBeTruthy();
    expect(screen.getByText(FATAL.title)).toBeTruthy();
  });

  it("files every LEVEL under the family the fleet paints it in", async () => {
    const rows = ISSUE_LEVELS.map((level, index) =>
      makeIssue({
        id: `0000000${index}-0000-4000-8000-00000000000${index}`,
        service: `svc-${level}`,
        title: `a ${level}`,
        level,
      })
    );
    const server = mockServer({ "GET /issues": { body: makePage(rows) } });
    mount(server, <IssuesFeed />);
    await screen.findByTestId("alerts-feed-groups");
    for (const row of rows) {
      const tag = await screen.findByTestId(`alerts-feed-level-${row.id}`);
      expect(tag.getAttribute("data-stapel-status")).toBe(levelFamily(row.level));
    }
  });

  it("files every STATUS under its family, including the one nobody can set", async () => {
    const rows = ISSUE_STATUSES.map((status, index) =>
      makeIssue({
        id: `1000000${index}-0000-4000-8000-00000000000${index}`,
        service: "svc-api",
        title: `a ${status} issue`,
        status,
      })
    );
    const server = mockServer({ "GET /issues": { body: makePage(rows) } });
    mount(server, <IssuesFeed />);
    await screen.findByTestId("alerts-feed-groups");
    for (const row of rows) {
      const tag = await screen.findByTestId(`alerts-feed-status-${row.id}`);
      expect(tag.getAttribute("data-stapel-status")).toBe(statusFamily(row.status));
    }
  });

  it("says “nothing has failed”, and says something else when a filter is set", async () => {
    const server = mockServer({ "GET /issues": { body: makePage([]) } });
    mount(server, <IssuesFeed />);
    const empty = await screen.findByTestId("alerts-feed-empty");
    expect(empty.textContent).toContain("Nothing has failed");
    // Set a filter: the SAME zero rows must now read as a filtered miss, with
    // the way out beside it.
    fireEvent.click(screen.getByTestId("alerts-feed-filters-open"));
    await waitFor(() =>
      expect(
        screen.getByTestId("alerts-feed-empty").textContent
      ).toContain("No issue matches these filters")
    );
    expect(screen.getByTestId("alerts-feed-empty-clear")).toBeTruthy();
  });

  it("names the staff wall rather than drawing an empty board", async () => {
    const server = mockServer({ "GET /issues": STAFF_ONLY });
    mount(server, <IssuesFeed />);
    const refusal = await screen.findByTestId("alerts-feed-staff-only");
    expect(refusal.textContent).toContain("staff-only");
    expect(screen.queryByTestId("alerts-feed-empty")).toBeNull();
  });

  it("tells a lost session apart from a wrong account", async () => {
    const server = mockServer({ "GET /issues": UNAUTHORIZED });
    mount(server, <IssuesFeed />);
    expect(await screen.findByTestId("alerts-feed-signed-out")).toBeTruthy();
    expect(screen.queryByTestId("alerts-feed-staff-only")).toBeNull();
  });

  it("offers a way in only when the host gave it one", async () => {
    const server = mockServer({ "GET /issues": { body: makePage([FATAL]) } });
    mount(server, <IssuesFeed issueHref={(id) => `/admin/alerts/${id}`} />);
    const open = await screen.findByTestId(`alerts-feed-open-${FATAL.id}`);
    expect(open.getAttribute("href")).toBe(`/admin/alerts/${FATAL.id}`);
  });
});

describe("<IssueDetail>", () => {
  it("renders the traceback and the redacted context of every occurrence", async () => {
    const server = mockServer({ "GET /issues/": { body: FATAL_DETAIL } });
    mount(server, <IssueDetail issueId={FATAL.id} />);
    await screen.findByTestId("alerts-issue-title");
    // The expander is collapsed by default — sixty frames inline would put
    // every control below the fold — so open the first occurrence.
    // Two occurrences carry the same message, and the issue TITLE contains it
    // too — the header of the first occurrence is the one to open.
    fireEvent.click(screen.getAllByText(/violates unique constraint/i)[0] as HTMLElement);
    const trace = await screen.findByTestId(
      `alerts-issue-trace-${FATAL_DETAIL.events[0]?.id ?? ""}`
    );
    expect(trace.textContent).toContain("IntegrityError");
    const context = screen.getByTestId(
      `alerts-issue-context-${FATAL_DETAIL.events[0]?.id ?? ""}`
    );
    expect(context.textContent).toContain("<redacted>");
  });

  it("reports a regression with the release that was supposed to stop it", async () => {
    const server = mockServer({ "GET /issues/": { body: REGRESSED_DETAIL } });
    mount(server, <IssueDetail issueId={REGRESSED_DETAIL.id} />);
    const notice = await screen.findByTestId("alerts-issue-regressed");
    expect(notice.textContent).toContain("came back");
    expect(notice.textContent).toContain("0.41.0");
  });

  it("says the events were swept without saying the issue never happened", async () => {
    const server = mockServer({ "GET /issues/": { body: SWEPT_DETAIL } });
    mount(server, <IssueDetail issueId={SWEPT_DETAIL.id} />);
    const empty = await screen.findByTestId("alerts-issue-events-empty");
    expect(empty.textContent).toContain("No occurrence is still stored");
  });

  it("draws `muted until` only while the issue is muted (BACKEND-GAP A-4)", async () => {
    const muted = mockServer({ "GET /issues/": { body: { ...MUTED, events: [] } } });
    mount(muted, <IssueDetail issueId={MUTED.id} />);
    expect(await screen.findByTestId("alerts-issue-muted-until")).toBeTruthy();
  });

  it("does not draw a stale deadline on an issue that has moved on", async () => {
    // The store writes `muted_until` when a mute is set and does not clear it
    // when the status changes, so a fixed row can still carry last month's
    // date. Reading it outside the muted status would print a mute nobody set.
    const stale = { ...SWEPT_DETAIL, muted_until: "2026-01-01T00:00:00Z" };
    const server = mockServer({ "GET /issues/": { body: stale } });
    mount(server, <IssueDetail issueId={stale.id} />);
    await screen.findByTestId("alerts-issue-title");
    expect(screen.queryByTestId("alerts-issue-muted-until")).toBeNull();
  });

  it("names a missing issue, and says why one can be missing", async () => {
    const server = mockServer({ "GET /issues/": ISSUE_NOT_FOUND });
    mount(server, <IssueDetail issueId="nope" />);
    const missing = await screen.findByTestId("alerts-issue-not-found");
    expect(missing.textContent).toContain("open issue is never swept");
  });

  it("offers Reopen only for an issue that is not already new", async () => {
    const open = mockServer({ "GET /issues/": { body: FATAL_DETAIL } });
    const { unmount } = render(
      <TestProviders server={open}>
        <IssueDetail issueId={FATAL.id} />
      </TestProviders>
    );
    await screen.findByTestId("alerts-issue-title");
    expect(screen.queryByTestId("alerts-issue-reopen")).toBeNull();
    unmount();

    const closed = mockServer({ "GET /issues/": { body: SWEPT_DETAIL } });
    mount(closed, <IssueDetail issueId={SWEPT_DETAIL.id} />);
    expect(await screen.findByTestId("alerts-issue-reopen")).toBeTruthy();
  });
});

describe("<FixIssueDialog>", () => {
  it("posts the version and the sha to /fix", async () => {
    const server = mockServer({ "POST /fix": { body: { ...FATAL, status: "fixed" } } });
    mount(
      server,
      <FixIssueDialog
        open
        onClose={() => undefined}
        issueId={FATAL.id}
        level="fatal"
      />
    );
    fireEvent.change(await screen.findByTestId("alerts-fix-version"), {
      target: { value: "0.42.1" },
    });
    fireEvent.change(screen.getByTestId("alerts-fix-sha"), {
      target: { value: "9c1d0ab" },
    });
    fireEvent.click(screen.getByTestId("alerts-fix-submit"));

    await waitFor(() => expect(server.calls.length).toBe(1));
    const call = server.calls[0];
    expect(call?.method).toBe("POST");
    expect(new URL(call?.url ?? "").pathname).toBe(
      `/alerts/api/v1/issues/${FATAL.id}/fix`
    );
    expect(JSON.parse(call?.body ?? "{}")).toEqual({
      version: "0.42.1",
      sha: "9c1d0ab",
    });
  });

  it("warns about closing with nothing to point at, and still allows it", async () => {
    const server = mockServer({ "POST /fix": { body: FATAL } });
    mount(
      server,
      <FixIssueDialog open onClose={() => undefined} issueId={FATAL.id} />
    );
    expect(await screen.findByTestId("alerts-fix-blank")).toBeTruthy();
    fireEvent.click(screen.getByTestId("alerts-fix-submit"));
    await waitFor(() => expect(server.calls.length).toBe(1));
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({});
  });
});

describe("<MuteIssueDialog>", () => {
  it("patches a status AND a deadline together", async () => {
    const server = mockServer({ "PATCH /issues/": { body: MUTED } });
    mount(
      server,
      <MuteIssueDialog open onClose={() => undefined} issueId={MUTED.id} />
    );
    fireEvent.click(await screen.findByTestId("alerts-mute-submit"));
    await waitFor(() => expect(server.calls.length).toBe(1));
    const body = JSON.parse(server.calls[0]?.body ?? "{}") as {
      status?: string;
      muted_until?: string | null;
    };
    expect(body.status).toBe("muted");
    expect(typeof body.muted_until).toBe("string");
  });

  it("warns when a mute is asked for with no deadline at all", async () => {
    const server = mockServer({ "PATCH /issues/": { body: MUTED } });
    mount(
      server,
      <MuteIssueDialog open onClose={() => undefined} issueId={MUTED.id} />
    );
    fireEvent.click(await screen.findByTestId("alerts-mute-window-forever"));
    expect(await screen.findByTestId("alerts-mute-forever")).toBeTruthy();
    fireEvent.click(screen.getByTestId("alerts-mute-submit"));
    await waitFor(() => expect(server.calls.length).toBe(1));
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      status: "muted",
      muted_until: null,
    });
  });
});
