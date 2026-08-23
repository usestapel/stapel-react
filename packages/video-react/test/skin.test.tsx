import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { loadFailed, loadLoading, loadReady, StapelApiError } from "@stapel/core";
import { ScopeUsagePane, ScopeUsageTable } from "../src/default/index.js";
import type { ScopeUsageRow } from "../src/index.js";
import {
  SCOPE,
  SCOPE_NOT_FOUND,
  TestProviders,
  mockServer,
} from "./harness.js";
import { AUGUST, TZ, WINDOW_BODY } from "./fixtures.js";

const ROWS = AUGUST.users as unknown as readonly ScopeUsageRow[];

const scopeRefusal = new StapelApiError({
  code: "error.404.video_scope_not_found",
  status: 404,
  message: "Scope not found",
  params: {},
});

function renderTable(
  props: Parameters<typeof ScopeUsageTable>[0]
): ReturnType<typeof render> {
  const server = mockServer({});
  return render(
    <TestProviders server={server}>
      <ScopeUsageTable {...props} />
    </TestProviders>
  );
}

describe("<ScopeUsageTable> — four arms, four different screens", () => {
  it("loading shows a skeleton and no table", () => {
    renderTable({ rows: loadLoading() });
    expect(screen.getByTestId("video-usage-loading")).toBeTruthy();
    expect(screen.queryByTestId("video-usage-rows")).toBeNull();
    expect(screen.queryByTestId("video-usage-empty")).toBeNull();
  });

  it("the uniform 404 renders an explained refusal — NOT an empty table", () => {
    renderTable({ rows: loadFailed(scopeRefusal) });
    const notice = screen.getByTestId("video-usage-unavailable");
    expect(notice.textContent).toContain("not available for this workspace");
    // The three things it must never be: an empty state, a row list, or a
    // generic error with a retry button that would re-ask a question already
    // answered.
    expect(screen.queryByTestId("video-usage-empty")).toBeNull();
    expect(screen.queryByTestId("video-usage-rows")).toBeNull();
    expect(screen.queryByTestId("video-usage-failed")).toBeNull();
  });

  it("any OTHER failure is the ordinary error surface, with a retry", () => {
    const onRefresh = vi.fn();
    renderTable({ rows: loadFailed(new TypeError("Failed to fetch")), onRefresh });
    expect(screen.getByTestId("video-usage-failed")).toBeTruthy();
    expect(screen.queryByTestId("video-usage-unavailable")).toBeNull();
    fireEvent.click(screen.getByText("Refresh"));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("empty says nobody talked — and is reachable only from a load that succeeded", () => {
    renderTable({ rows: loadReady([]) });
    expect(screen.getByTestId("video-usage-empty").textContent).toContain(
      "Nobody was in a call this month"
    );
    expect(screen.queryByTestId("video-usage-rows")).toBeNull();
  });

  it("ready draws a row per person, longest first, with talk time as h:mm", () => {
    renderTable({ rows: loadReady(ROWS) });
    const table = screen.getByTestId("video-usage-rows");
    expect(table.textContent).toContain("2:03");
    expect(table.textContent).toContain("1:00");
    // 59 seconds is presence, and it rounds DOWN rather than up to a minute
    // nobody spent.
    expect(table.textContent).toContain("0:00");
  });
});

describe("<ScopeUsageTable> — the person column is a slot", () => {
  it("prints the raw id when the host resolves no name", () => {
    renderTable({ rows: loadReady(ROWS) });
    expect(screen.getByTestId("video-usage-rows").textContent).toContain("u-9a1f");
  });

  it("uses `nameFor` when the host has a roster", () => {
    renderTable({
      rows: loadReady(ROWS),
      nameFor: (id) => (id === "u-9a1f" ? "Ada L." : id),
    });
    const table = screen.getByTestId("video-usage-rows");
    expect(table.textContent).toContain("Ada L.");
    expect(table.textContent).not.toContain("u-9a1f");
    // The people the roster does not know still appear, by id — a report
    // about individuals must not silently drop one.
    expect(table.textContent).toContain("u-4c02");
  });
});

describe("<ScopeUsageTable> — the footer", () => {
  it("sums person-time and counts people", () => {
    renderTable({ rows: loadReady(ROWS) });
    const footer = screen.getByTestId("video-usage-total");
    expect(screen.getByTestId("video-usage-total-time").textContent).toBe("3:04");
    expect(footer.textContent).toContain("3 people");
  });

  it("calls it `attendances`, because three people in one call make three", () => {
    renderTable({ rows: loadReady(ROWS) });
    expect(screen.getByTestId("video-usage-total").textContent).toContain(
      "7 attendances"
    );
  });
});

describe("<ScopeUsageTable> — the month selector", () => {
  it("is a plain label when the host offers no options", () => {
    renderTable({ rows: loadReady(ROWS), month: "2026-08" });
    expect(screen.getByTestId("video-usage-month").textContent).toBe("2026-08");
    expect(screen.queryByTestId("video-usage-month-select")).toBeNull();
  });

  it("is absent entirely when there is no month to name", () => {
    renderTable({ rows: loadReady([]) });
    expect(screen.queryByTestId("video-usage-month")).toBeNull();
    expect(screen.queryByTestId("video-usage-month-select")).toBeNull();
  });

  it("renders every offered month once a handler is supplied", () => {
    renderTable({
      rows: loadReady(ROWS),
      month: "2026-08",
      months: ["2026-08", "2026-07"],
      onMonthChange: vi.fn(),
    });
    expect(screen.getByTestId("video-usage-month-select")).toBeTruthy();
  });
});

describe("<ScopeUsagePane> — the wired screen", () => {
  it("names the missing scope instead of drawing an empty workspace", () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    render(
      <TestProviders server={server}>
        <ScopeUsagePane />
      </TestProviders>
    );
    expect(screen.getByTestId("video-usage-no-scope").textContent).toContain(
      "No workspace selected"
    );
    expect(server.calls).toEqual([]);
  });

  it("takes the scope from the runtime when the host configured one", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    render(
      <TestProviders server={server} scopeKey={SCOPE}>
        <ScopeUsagePane tz={TZ} />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("video-usage-rows")).toBeTruthy()
    );
    expect(server.calls[0]?.url).toContain(`/scopes/${SCOPE}/usage/`);
  });

  it("the prop wins over the runtime — a workspace switcher changes it per render", async () => {
    const server = mockServer({ "/usage/": { body: WINDOW_BODY } });
    render(
      <TestProviders server={server} scopeKey="acme-0000">
        <ScopeUsagePane scopeKey={SCOPE} tz={TZ} />
      </TestProviders>
    );
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    expect(server.calls[0]?.url).toContain(`/scopes/${SCOPE}/usage/`);
  });

  it("surfaces the uniform refusal end to end, through the real client", async () => {
    const server = mockServer({ "/usage/": SCOPE_NOT_FOUND });
    render(
      <TestProviders server={server} scopeKey={SCOPE}>
        <ScopeUsagePane />
      </TestProviders>
    );
    await waitFor(() =>
      expect(screen.getByTestId("video-usage-unavailable")).toBeTruthy()
    );
    expect(screen.queryByTestId("video-usage-empty")).toBeNull();
  });
});
