import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { useIssueStatus } from "../src/index.js";
import {
  STATUS_NOT_SETTABLE,
  TestProviders,
  mockServer,
} from "./harness.js";
import type { MockServer } from "./harness.js";
import { FATAL, MUTED } from "./fixtures.js";

/**
 * The write half. Every assertion is on the BODY that reached the wire,
 * because the three defects this pair has to avoid are all body-shaped: a
 * close that patched a status instead of posting a release, a mute that
 * omitted the deadline key (a note, not a mute), and a blank field recorded
 * as an empty claim.
 */
function wrapper(server: MockServer): (props: { children: ReactNode }) => ReactElement {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestProviders server={server}>{props.children}</TestProviders>;
  };
}

describe("useIssueStatus().fix", () => {
  it("POSTs to /fix with the version and the sha", async () => {
    const server = mockServer({ "POST /fix": { body: { ...FATAL, status: "fixed" } } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });

    await act(async () => {
      result.current.fix.mutate({
        issueId: FATAL.id,
        version: "0.42.1",
        sha: "9c1d0ab",
        level: "fatal",
      });
    });
    await waitFor(() => expect(result.current.fix.isSuccess).toBe(true));

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

  it("never sends the analytics-only level to the server", async () => {
    const server = mockServer({ "POST /fix": { body: FATAL } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.fix.mutate({ issueId: FATAL.id, version: "1.0.0", level: "fatal" });
    });
    await waitFor(() => expect(result.current.fix.isSuccess).toBe(true));
    expect(server.calls[0]?.body).not.toContain("level");
  });

  it("omits an empty field rather than recording an empty claim", async () => {
    const server = mockServer({ "POST /fix": { body: FATAL } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.fix.mutate({ issueId: FATAL.id, version: "  ", sha: "" });
    });
    await waitFor(() => expect(result.current.fix.isSuccess).toBe(true));
    // Both fields are optional upstream and both are RECORDED — `version: ""`
    // would be a recorded claim of nothing, which reads differently from a
    // close that never claimed a release.
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({});
  });
});

describe("useIssueStatus().mute", () => {
  it("sends the deadline alone — the store infers the status from it", async () => {
    // `muted_until` on its own is a mute: the field has no meaning in any
    // other status, so the patch carries the deadline and says nothing about
    // the status.
    const server = mockServer({ "PATCH /issues/": { body: MUTED } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.mute.mutate({
        issueId: MUTED.id,
        mutedUntil: "2026-09-20T09:00:00.000Z",
        note: "known",
      });
    });
    await waitFor(() => expect(result.current.mute.isSuccess).toBe(true));
    expect(server.calls[0]?.method).toBe("PATCH");
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      muted_until: "2026-09-20T09:00:00.000Z",
      note: "known",
    });
  });

  it("sends an explicit null for a mute with no deadline", async () => {
    const server = mockServer({ "PATCH /issues/": { body: MUTED } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.mute.mutate({ issueId: MUTED.id, mutedUntil: null });
    });
    await waitFor(() => expect(result.current.mute.isSuccess).toBe(true));
    // Omitting the key would be a patch of nothing: no deadline, no status,
    // no mute. The key IS the mute, so "forever" is an explicit null.
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      muted_until: null,
    });
  });
});

describe("useIssueStatus().reopen and .annotate", () => {
  it("reopen patches the status back to new", async () => {
    const server = mockServer({ "PATCH /issues/": { body: { ...FATAL, status: "new" } } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.reopen.mutate({ issueId: FATAL.id });
    });
    await waitFor(() => expect(result.current.reopen.isSuccess).toBe(true));
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({ status: "new" });
  });

  it("annotate patches a note with no claim about the status", async () => {
    const server = mockServer({ "PATCH /issues/": { body: FATAL } });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.annotate.mutate({ issueId: FATAL.id, note: "looking at it" });
    });
    await waitFor(() => expect(result.current.annotate.isSuccess).toBe(true));
    expect(JSON.parse(server.calls[0]?.body ?? "{}")).toEqual({
      note: "looking at it",
    });
  });

  it("surfaces the store's refusal by code", async () => {
    const server = mockServer({ "PATCH /issues/": STATUS_NOT_SETTABLE });
    const { result } = renderHook(() => useIssueStatus(), { wrapper: wrapper(server) });
    await act(async () => {
      result.current.reopen.mutate({ issueId: FATAL.id });
    });
    await waitFor(() => expect(result.current.reopen.isError).toBe(true));
    expect(result.current.reopen.error?.code).toBe(
      "error.400.alerts_status_not_settable"
    );
  });
});
