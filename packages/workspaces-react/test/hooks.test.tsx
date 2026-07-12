import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { WorkspaceList } from "../src/headless/WorkspaceList.js";
import { Members } from "../src/headless/Members.js";
import { AcceptInvitation } from "../src/headless/AcceptInvitation.js";
import { useWorkspaces } from "../src/model/queries.js";
import { useAcceptInvitation } from "../src/model/mutations.js";

/** Base the msw handlers mount on (mirrors stapel-workspaces `/workspaces/api`). */
const BASE = "https://workspaces.stapel.test/workspaces/api";
const WS = "0192f000-0000-4000-8000-000000000001";

const WORKSPACE = {
  id: WS,
  name: "Acme Engineering",
  slug: "acme-eng",
  type: "work",
  owner_id: "0192a000-0000-4000-8000-000000000001",
  settings: {},
  storage_used_bytes: 0,
  storage_limit_bytes: 5368709120,
  member_count: 2,
  my_role: "owner",
  created_at: "2026-05-20T10:00:00Z",
  updated_at: "2026-05-20T10:00:00Z",
};

const WORKSPACE_LIST = { workspaces: [WORKSPACE] };

const MEMBER = {
  id: "0192b000-0000-4000-8000-000000000001",
  workspace_id: WS,
  user_id: "0192a000-0000-4000-8000-000000000001",
  email: "owner@example.com",
  role: "owner",
  invited_at: "2026-05-20T10:00:00Z",
  accepted_at: "2026-05-20T10:05:00Z",
  last_accessed_at: null,
};

const MEMBER_LIST = {
  items: [MEMBER],
  next_anchor: null,
  prev_anchor: null,
  has_next: false,
  has_prev: false,
  count: 1,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrap(runtime: WorkspacesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
    </QueryClientProvider>
  );
}

describe("useWorkspaces (happy path)", () => {
  it("fetches and returns the caller's workspaces", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json(WORKSPACE_LIST)));
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useWorkspaces(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.workspaces?.[0]?.name).toBe("Acme Engineering");
  });
});

describe("<WorkspaceList> (list + create)", () => {
  it("loads the list and creates a workspace", async () => {
    const CREATED = { ...WORKSPACE, id: "0192f000-0000-4000-8000-0000000000ff", name: "New workspace" };
    server.use(
      http.get(`${BASE}/`, () => HttpResponse.json(WORKSPACE_LIST)),
      http.post(`${BASE}/`, () => HttpResponse.json(CREATED, { status: 201 }))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <WorkspaceList>
          {({ workspaces, created, create }) => (
            <div>
              <span data-testid="ws-count">{workspaces.length}</span>
              <span data-testid="ws-created">{created?.name ?? "none"}</span>
              <button onClick={() => create({ name: "New workspace", type: "work" })}>
                create
              </button>
            </div>
          )}
        </WorkspaceList>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("ws-count").textContent).toBe("1")
    );
    screen.getByText("create").click();
    await waitFor(() =>
      expect(screen.getByTestId("ws-created").textContent).toBe("New workspace")
    );
  });
});

describe("<Members> (roster + invite)", () => {
  it("loads the roster and invites a member", async () => {
    server.use(
      http.get(`${BASE}/${WS}/members`, () => HttpResponse.json(MEMBER_LIST)),
      http.post(`${BASE}/${WS}/members/invite`, () =>
        HttpResponse.json(
          {
            invitations: [
              {
                id: "0192c000-0000-4000-8000-000000000001",
                workspace_id: WS,
                email: "new@example.com",
                role: "member",
                expires_at: "2026-07-01T00:00:00Z",
                accepted_at: null,
                revoked_at: null,
                created_at: "2026-06-24T00:00:00Z",
              },
            ],
          },
          { status: 201 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <Members workspaceId={WS}>
          {({ members, isInviting, invite }) => (
            <div>
              <span data-testid="member-count">{members.length}</span>
              <span data-testid="inviting">{String(isInviting)}</span>
              <button
                onClick={() => invite({ emails: ["new@example.com"], role: "member" })}
              >
                invite
              </button>
            </div>
          )}
        </Members>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("member-count").textContent).toBe("1")
    );
    screen.getByText("invite").click();
    await waitFor(() =>
      expect(screen.getByTestId("inviting").textContent).toBe("false")
    );
  });
});

describe("<AcceptInvitation> (happy path)", () => {
  it("accepts a token and joins the workspace", async () => {
    server.use(
      http.post(`${BASE}/invitations/accept`, () => HttpResponse.json(MEMBER))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <AcceptInvitation>
          {({ isAccepted, accept }) => (
            <div>
              <span data-testid="accepted">{String(isAccepted)}</span>
              <button onClick={() => accept("good-token")}>accept</button>
            </div>
          )}
        </AcceptInvitation>
      )
    );
    expect(screen.getByTestId("accepted").textContent).toBe("false");
    screen.getByText("accept").click();
    await waitFor(() =>
      expect(screen.getByTestId("accepted").textContent).toBe("true")
    );
  });
});

describe("useAcceptInvitation (localizable error — negative case)", () => {
  it("surfaces the backend's error code on an expired invitation", async () => {
    // The canon override this pair declares (backend errors.json): an expired
    // invitation is `contact_support`, NOT the heuristic's retry — the token is
    // dead and only the owner can re-invite. The code flows through the
    // StapelClient error envelope unchanged.
    server.use(
      http.post(`${BASE}/invitations/accept`, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.invitation_expired",
            error: "Invitation has expired",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useAcceptInvitation(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    result.current.mutate({ token: "expired-token" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.400.invitation_expired");
  });
});
