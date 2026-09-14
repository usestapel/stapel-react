import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useIssue, useIssues } from "../src/index.js";
import type { IssueFeedFilters } from "../src/index.js";
import { BASE, STAFF_ONLY, TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { BOARD, FATAL, FATAL_DETAIL, MUTED, makePage } from "./fixtures.js";

/**
 * The read hooks, driven through the real transport against a server that
 * issues ETags and honours `If-None-Match` — because the behaviour under test
 * is what happens on a 304, and a server that never sends one cannot prove
 * anything about it.
 */
function wrapper(server: MockServer): (props: { children: ReactNode }) => ReactElement {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestProviders server={server}>{props.children}</TestProviders>;
  };
}

describe("useIssues", () => {
  it("reads the page envelope and reports the total apart from the rows", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    if (result.current.rows.status !== "ready") return;
    expect(result.current.rows.data).toHaveLength(5);
    // `count` is every issue matching the filters; the rows are one page.
    expect(result.current.total).toBe(5);
    expect(result.current.pageSize).toBe(50);
  });

  it("groups by service, worst first", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.groups.status).toBe("ready"));
    if (result.current.groups.status !== "ready") return;
    expect(result.current.groups.data[0]?.service).toBe("svc-billing");
  });

  it("a 304 refetch KEEPS the rows, and keeps the very same object", async () => {
    // The identity is the message: TanStack compares by reference, so handing
    // back the previous snapshot means a poll through a quiet night notifies
    // nobody and repaints nothing. A hook that rebuilt an equal object would
    // pass a `toEqual` and still repaint every minute.
    const server = mockServer({ "GET /issues": { body: BOARD } });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    if (result.current.rows.status !== "ready") return;
    const before = result.current.rows.data;

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(server.notModified.length).toBe(1));
    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.rows.status).toBe("ready");
    if (result.current.rows.status !== "ready") return;
    expect(result.current.rows.data).toBe(before);
  });

  it("offers the validator it was given on every read after the first", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    expect(server.calls[0]?.ifNoneMatch).toBeNull();
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(server.calls.length).toBe(2));
    expect(server.calls[1]?.ifNoneMatch).toBeTruthy();
  });

  it("a changed board comes back with a new body, not a 304", async () => {
    let body = BOARD;
    const server = mockServer({ "GET /issues": () => ({ body }) });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));

    body = makePage([...BOARD.results, { ...MUTED, id: "66666666-6666-4666-8666-666666666666" }]);
    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => {
      expect(
        result.current.rows.status === "ready" && result.current.rows.data.length
      ).toBe(6);
    });
    expect(server.notModified).toHaveLength(0);
  });

  it("pages by the server's own page size and resets when the filters change", async () => {
    const page1 = makePage([FATAL], { count: 120, offset: 0, limit: 50 });
    const server = mockServer({ "GET /issues": { body: page1 } });
    const { result, rerender } = renderHook(
      (props: { filters: IssueFeedFilters }) => useIssues(props.filters),
      { wrapper: wrapper(server), initialProps: { filters: {} as IssueFeedFilters } }
    );
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.hasNext).toBe(true);

    await act(async () => {
      result.current.nextPage();
    });
    await waitFor(() => expect(result.current.offset).toBe(50));
    await waitFor(() =>
      expect(server.calls.some((c) => c.url.includes("offset=50"))).toBe(true)
    );

    // A filter change is a new question, and its answer starts at page one.
    rerender({ filters: { level: "fatal" } });
    await waitFor(() => expect(result.current.offset).toBe(0));
  });

  it("passes `limit` through and pages by the size the server ECHOES", async () => {
    // `?limit=` is clamped server-side (1..200) and the envelope echoes what
    // was applied, so the cursor moves by the echo — a request for 500 rows
    // that the server cut to 200 must not skip the other 300.
    const clamped = makePage([FATAL], { count: 450, offset: 0, limit: 200 });
    const server = mockServer({ "GET /issues": { body: clamped } });
    const { result } = renderHook(() => useIssues({ limit: 500 }), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.rows.status).toBe("ready"));
    expect(new URL(server.calls[0]?.url ?? "").searchParams.get("limit")).toBe("500");
    expect(result.current.pageSize).toBe(200);
    await act(async () => {
      result.current.nextPage();
    });
    await waitFor(() => expect(result.current.offset).toBe(200));
  });

  it("sends no `limit` unless asked, so the server's default applies", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    expect(new URL(server.calls[0]?.url ?? "").searchParams.has("limit")).toBe(false);
  });

  it("names the staff refusal instead of reporting an empty board", async () => {
    const server = mockServer({ "GET /issues": STAFF_ONLY });
    const { result } = renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(result.current.rows.status).toBe("failed"));
    if (result.current.rows.status !== "failed") return;
    expect((result.current.rows.error as { code?: string }).code).toBe(
      "error.403.forbidden"
    );
  });

  it("asks the base URL the runtime was built with", async () => {
    const server = mockServer({ "GET /issues": { body: BOARD } });
    renderHook(() => useIssues(), { wrapper: wrapper(server) });
    await waitFor(() => expect(server.calls.length).toBeGreaterThan(0));
    expect(server.calls[0]?.url.startsWith(BASE.replace(/\/$/, ""))).toBe(true);
  });
});

describe("useIssue", () => {
  it("reads one issue with its events", async () => {
    const server = mockServer({ "GET /issues/": { body: FATAL_DETAIL } });
    const { result } = renderHook(() => useIssue(FATAL.id), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    if (result.current.state.status !== "ready") return;
    expect(result.current.state.data.id).toBe(FATAL.id);
    expect(result.current.events.status).toBe("ready");
    if (result.current.events.status !== "ready") return;
    expect(result.current.events.data).toHaveLength(2);
  });

  it("does not read at all without an id", async () => {
    const server = mockServer({ "GET /issues/": { body: FATAL_DETAIL } });
    renderHook(() => useIssue(undefined), { wrapper: wrapper(server) });
    await waitFor(() => expect(server.calls).toHaveLength(0));
  });

  it("a 304 on the detail keeps the events already on screen", async () => {
    const server = mockServer({ "GET /issues/": { body: FATAL_DETAIL } });
    const { result } = renderHook(() => useIssue(FATAL.id), {
      wrapper: wrapper(server),
    });
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    if (result.current.state.status !== "ready") return;
    const before = result.current.state.data;

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(server.notModified.length).toBe(1));
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.state.status).toBe("ready");
    if (result.current.state.status !== "ready") return;
    expect(result.current.state.data).toBe(before);
  });
});
