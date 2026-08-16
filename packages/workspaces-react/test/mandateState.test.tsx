/**
 * `useMandateState()` — the one place the frontend answers "does this person
 * hold a mandate anywhere".
 *
 * `is_guest` has ridden the workspace-list response since stapel-workspaces
 * 0.19 and had ZERO readers: a signed-in guest was indistinguishable from a
 * member to every screen in the fleet, so every screen drew every door and
 * the backend refused each one in turn.
 *
 * The property this file exists for is the FOURTH state. "We could not ask"
 * must never render as "you may not" — so a list still in flight, and a list
 * that 502'd, both resolve to `unresolved` with a reason, and neither ever
 * resolves to `guest`. The bug this forecloses is the cheap one: read
 * `is_guest` as `data?.is_guest ?? true` and every outage silently demotes
 * every member to a guest and locks them out of their own product.
 *
 * Mocked at the WIRE (CONTRIBUTING "Mock the wire, not the module"): a real
 * transport produces the value the hook reads, so a shape the backend never
 * sends cannot pass here.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { act } from "react";
import { createSessionManager } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { useMandateState } from "../src/model/mandate.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";

function workspace(id: string) {
  return {
    id,
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
  };
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: WorkspacesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
    </QueryClientProvider>
  );
}

function mount() {
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
  return renderHook(() => useMandateState(), {
    wrapper: ({ children }) => wrap(runtime, children),
  });
}

describe("useMandateState — the settled principals", () => {
  it("reads a member off a list that carries memberships", async () => {
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json({ workspaces: [workspace("0192f000-0000-4000-8000-00000000000b")], is_guest: false })
      )
    );
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => expect(result.current.mandate).toBe("member"));
  });

  it("reads a guest off the wire's own is_guest, not off an empty array", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [], is_guest: true })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("still answers guest against a backend too old to send is_guest", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [] })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("believes is_guest over the array it disagrees with", async () => {
    // A membership the caller holds but which is suspended: rows present,
    // mandate absent. The server evaluated the predicate; we do not re-derive.
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json({ workspaces: [workspace("0192f000-0000-4000-8000-00000000000c")], is_guest: true })
      )
    );
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("answers anonymous on the first render — it does not wait on a list to say so", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [], is_guest: true })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAnonymous());

    const { result } = mount();
    // No waitFor: an anonymous session is settled evidence on its own, so the
    // landing renders immediately instead of flashing a spinner at somebody
    // who was never going to have a mandate.
    expect(result.current.mandate).toBe("anonymous");

    // And it stays anonymous once the list lands — the list cannot promote
    // an anonymous session to a guest.
    await waitFor(() => expect(result.current.mandate).toBe("anonymous"));
  });

  it("answers anonymous for a confirmed absence of any session", async () => {
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markUnauthenticated());

    const { result } = mount();
    await waitFor(() => expect(result.current.mandate).toBe("anonymous"));
  });
});

describe("useMandateState — 'we could not ask' is never 'you may not'", () => {
  it("waits, rather than guessing, while the session is still bootstrapping", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [], is_guest: true })));
    const session = createSessionManager({ doRefresh: async () => null });
    expect(session.isReady()).toBe(false);

    const { result } = mount();
    expect(result.current.mandate).toBe("unresolved");
    expect(result.current.mandate === "unresolved" && result.current.reason).toBe("asking");

    act(() => session.markAuthenticated());
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("waits while the list is in flight", async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${BASE}/`, async () => {
        await held;
        return HttpResponse.json({ workspaces: [], is_guest: true });
      })
    );
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    expect(result.current.mandate).toBe("unresolved");
    expect(result.current.mandate === "unresolved" && result.current.reason).toBe("asking");

    release?.();
    await waitFor(() => expect(result.current.mandate).toBe("guest"));
  });

  it("says the answer is UNAVAILABLE when the backend is down — it does not demote a member to a guest", async () => {
    server.use(http.get(`${BASE}/`, () => new HttpResponse(null, { status: 502 })));
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => {
      expect(result.current.mandate === "unresolved" && result.current.reason).toBe("unavailable");
    });
    expect(result.current.mandate).not.toBe("guest");
    expect(result.current.mandate === "unresolved" && result.current.reason === "unavailable" && result.current.error).toBeDefined();
  });

  it("carries the thrown value so the outage can be explained, not merely felt", async () => {
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json(
          { localizable_error: "error.503.mandate_unavailable", error: "Cannot verify workspace mandate right now", params: {} },
          { status: 503 }
        )
      )
    );
    const session = createSessionManager({ doRefresh: async () => null });
    act(() => session.markAuthenticated());

    const { result } = mount();
    await waitFor(() => {
      expect(result.current.mandate === "unresolved" && result.current.reason).toBe("unavailable");
    });
    const state = result.current;
    const error = state.mandate === "unresolved" && state.reason === "unavailable" ? state.error : undefined;
    expect((error as { code?: string }).code).toBe("error.503.mandate_unavailable");
  });
});
