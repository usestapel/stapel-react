/**
 * `useMandateSource()` — this module's derivation, in the shape core's
 * `<MandateProvider>` takes.
 *
 * The property under test is a DEPENDENCY, not a value: a screen that needs
 * to know whether the caller holds a mandate should not have to import the
 * package that computes it. Here the reader imports `useMandate` from
 * `@stapel/core` and nothing else, and still gets the answer this module
 * derived from `is_guest` — which is what makes the same reader work in a
 * public storefront, where there is no workspace list to ask at all.
 *
 * `mandateState.test.tsx` is untouched: the derivation did not change, only
 * how it is handed over.
 *
 * Mocked at the WIRE (CONTRIBUTING "Mock the wire, not the module").
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { act } from "react";
import { MandateProvider, createSessionManager, useMandate } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { useMandateSource } from "../src/model/mandate.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The three lines a tenant app writes at its root, and nothing more. */
function MandateBridge(props: { children: ReactNode }): ReactElement {
  return <MandateProvider source={useMandateSource()}>{props.children}</MandateProvider>;
}

function wrap(runtime: WorkspacesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspacesProvider runtime={runtime}>
        <MandateBridge>{children}</MandateBridge>
      </WorkspacesProvider>
    </QueryClientProvider>
  );
}

/** The reader: `@stapel/core` only, no workspaces import anywhere in sight. */
function mountReader() {
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
  return renderHook(() => useMandate(), {
    wrapper: ({ children }) => wrap(runtime, children),
  });
}

describe("useMandateSource", () => {
  it("delivers a member to a reader that only knows @stapel/core", async () => {
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json({
          workspaces: [
            {
              id: "0192f000-0000-4000-8000-00000000000b",
              name: "Org",
              slug: "org",
              type: "work",
              owner_id: "0192a000-0000-4000-8000-000000000001",
              settings: {},
              storage_used_bytes: 0,
              storage_limit_bytes: 5368709120,
              member_count: 1,
              my_role: "owner",
              created_at: "2026-05-20T10:00:00Z",
              updated_at: "2026-05-20T10:00:00Z",
            },
          ],
          is_guest: false,
        })
      )
    );
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mountReader();
    await waitFor(() => expect(result.current.mandate).toBe("member"));
  });

  it("carries the guest verdict through unchanged", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [], is_guest: true })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mountReader();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("carries an outage as an outage — the seam adds no verdict of its own", async () => {
    server.use(http.get(`${BASE}/`, () => new HttpResponse(null, { status: 502 })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mountReader();
    await waitFor(() => {
      expect(result.current.mandate === "unresolved" && result.current.reason).toBe(
        "unavailable"
      );
    });
    // The fallback core uses for a MISSING provider must not be what a wired
    // app sees during an outage: the thrown value has to survive the trip.
    const state = result.current;
    const error =
      state.mandate === "unresolved" && state.reason === "unavailable"
        ? state.error
        : undefined;
    expect((error as { status?: number }).status).toBe(502);
  });

  it("does not churn the reader when only the render churns", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [], is_guest: true })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result, rerender } = mountReader();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
    const settled = result.current;

    rerender();

    // Identity, through the REAL source: `useMandateState` recomputes from a
    // fresh query object every render, and the provider is what keeps that
    // from re-firing every effect keyed on the axis, forever.
    expect(result.current).toBe(settled);
  });
});
