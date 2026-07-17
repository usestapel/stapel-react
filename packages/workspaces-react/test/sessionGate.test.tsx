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
import { useWorkspaces } from "../src/model/queries.js";

/**
 * Owner-diagnosed live incident (2026-07-17): `useWorkspaces()` is the
 * top-level list hook with no `workspaceId` to naturally gate it (unlike
 * `useWorkspace(id)`/`useMembers(id)`) — it used to fire the instant a
 * component mounted, racing a session still bootstrapping (e.g. right after
 * a QR `session_share` scan set fresh cookies this JS runtime hadn't caught
 * up to yet). It now gates on `@stapel/core`'s `useActiveSessionReady()`
 * (the FRAMEWORK-level ready-gate — zero manual `enabled` at the call
 * site): a live-registered `SessionManager` (however it got there — here,
 * standing in for `@stapel/auth-react`'s `createAuthRuntime`) that hasn't
 * finished `"initializing"` must hold the query off, and MUST let it
 * through the instant the session settles.
 *
 * `createSessionManager` registers itself as the process-global "active"
 * manager (`getActiveSessionManager()`), so this file is isolated from
 * `test/hooks.test.tsx` deliberately (a stray active manager would leak
 * into other files' `useWorkspaces()` calls otherwise).
 */
const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WORKSPACE_LIST = { workspaces: [] };

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

describe("useWorkspaces() — gated on the active session's readiness", () => {
  it("does not fire while the active session is 'initializing', then fires the instant it's ready", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/`, () => {
        calls += 1;
        return HttpResponse.json(WORKSPACE_LIST);
      })
    );
    const session = createSessionManager({ doRefresh: async () => null });
    expect(session.isReady()).toBe(false);

    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useWorkspaces(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });

    // Session still initializing — the query must not have fired at all.
    expect(result.current.isPending).toBe(true);
    expect(calls).toBe(0);

    act(() => {
      session.markAuthenticated();
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls).toBe(1);
  });
});
