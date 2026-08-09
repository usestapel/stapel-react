import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import {
  useCapabilityGate,
  useInvitations,
  useMembers,
} from "../src/model/queries.js";
import {
  useRenameInvitation,
  useRenameMember,
} from "../src/model/mutations.js";
import { explainWorkspacesError } from "../src/i18n/errorsMap.js";

/**
 * Roster-side name edit (workspaces-react 0.10.0 against stapel-workspaces
 * 0.19.0): the two PATCHes an owner/admin uses to fix how a person is shown,
 * without waiting for that person.
 *
 * Every test here reds out against 0.9.0 — the endpoints were unreachable
 * from the frontend, so the product's only option was a raw HTTP call, which
 * is exactly the thing that gets the invalidation wrong.
 *
 * Errors are driven through MSW with the REAL envelope the backend sends, so
 * the value under assertion is produced by the real transport, never
 * hand-shaped here (CONTRIBUTING.md, "Mock the wire, not the module").
 */

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WS = "0192f000-0000-4000-8000-000000000001";
const OTHER_WS = "0192f000-0000-4000-8000-000000000009";
const USER = "0192a000-0000-4000-8000-000000000002";
const INVITE = "0192c000-0000-4000-8000-000000000001";

const MEMBER_NAME_PATH = `${BASE}/${WS}/members/${USER}/name`;
const INVITE_NAME_PATH = `${BASE}/${WS}/invitations/${INVITE}/name`;

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: "0192b000-0000-4000-8000-000000000001",
    workspace_id: WS,
    user_id: USER,
    email: "ada@example.com",
    role: "member",
    invited_at: "2026-07-24T10:00:00Z",
    accepted_at: "2026-07-25T10:00:00Z",
    last_accessed_at: null,
    provisioned: false,
    suspended_at: null,
    suspension_reason: null,
    display_name: "Ada Lovelacce",
    ...overrides,
  };
}

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITE,
    workspace_id: WS,
    email: "grace@example.com",
    role: "member",
    status: "pending",
    expires_at: "2026-08-31T10:00:00Z",
    accepted_at: null,
    declined_at: null,
    revoked_at: null,
    created_at: "2026-08-09T10:00:00Z",
    invited_by_id: "0192a000-0000-4000-8000-000000000001",
    display_name: "Grace Hoper",
    ...overrides,
  };
}

function page(items: unknown[], overrides: Record<string, unknown> = {}) {
  return {
    items,
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
    ...overrides,
  };
}

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
  my_role: "admin",
  my_capabilities: ["workspace.view", "members.role.change"],
  created_at: "2026-05-20T10:00:00Z",
  updated_at: "2026-05-20T10:00:00Z",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function wrap(
  runtime: WorkspacesRuntime,
  queryClient: QueryClient,
  children: ReactNode
): ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
    </QueryClientProvider>
  );
}

// ── PATCH /{ws}/members/{user}/name ─────────────────────────────────────────

describe("useRenameMember (PATCH .../members/{user}/name)", () => {
  it("patches the name path and returns the STORED name", async () => {
    let sent: unknown = null;
    let method: string | null = null;
    server.use(
      http.patch(MEMBER_NAME_PATH, async ({ request }) => {
        method = request.method;
        sent = await request.json();
        return HttpResponse.json({ display_name: "Ada Lovelace" });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "  Ada Lovelace  " });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(method).toBe("PATCH");
    expect(sent).toEqual({ display_name: "  Ada Lovelace  " });
    // The reply is what the name IS after the write (trimmed, canon-checked),
    // not an echo of the request — so the caller renders the server's answer.
    expect(result.current.data?.display_name).toBe("Ada Lovelace");
  });

  it("carries an explicit null through, because clearing is a real outcome", async () => {
    let sent: unknown = null;
    server.use(
      http.patch(MEMBER_NAME_PATH, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ display_name: "" });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // A dropped key would mean "leave it alone" to a hand-rolled caller and
    // "clear it" to this backend; the hook must not leave that ambiguous.
    expect(sent).toEqual({ display_name: null });
    expect(result.current.data?.display_name).toBe("");
  });

  it("invalidates EVERY workspace's roster, not just the one on screen", async () => {
    const fetches: Record<string, number> = { [WS]: 0, [OTHER_WS]: 0 };
    server.use(
      http.get(`${BASE}/:workspaceId/members`, ({ params }) => {
        const id = params.workspaceId as string;
        fetches[id] = (fetches[id] ?? 0) + 1;
        return HttpResponse.json(page([member({ workspace_id: id })]));
      }),
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json({ display_name: "Ada Lovelace" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();

    const rosters = renderHook(
      () => ({
        here: useMembers(WS),
        elsewhere: useMembers(OTHER_WS),
      }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(rosters.result.current.here.isSuccess).toBe(true));
    await waitFor(() =>
      expect(rosters.result.current.elsewhere.isSuccess).toBe(true)
    );
    expect(fetches[WS]).toBe(1);
    expect(fetches[OTHER_WS]).toBe(1);

    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "Ada Lovelace" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The write lands on the CANONICAL profile name, which every roster looks
    // up live — so the same person renders their old name on every other
    // workspace's member list until those drop too. This is the whole reason
    // the key is the workspace-less prefix.
    await waitFor(() => expect(fetches[WS]).toBe(2));
    await waitFor(() => expect(fetches[OTHER_WS]).toBe(2));
  });

  it("invalidates every PAGE and every search filter of a roster", async () => {
    let fetches = 0;
    server.use(
      http.get(`${BASE}/${WS}/members`, () => {
        fetches += 1;
        return HttpResponse.json(page([member()]));
      }),
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json({ display_name: "Ada Lovelace" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const lists = renderHook(
      () => ({
        unfiltered: useMembers(WS),
        // A rename can move a row OUT of an active search — the filtered
        // page is stale for a reason the row itself cannot express.
        filtered: useMembers(WS, { search: "lovelacce" }),
      }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(lists.result.current.unfiltered.isSuccess).toBe(true));
    await waitFor(() => expect(lists.result.current.filtered.isSuccess).toBe(true));
    expect(fetches).toBe(2);

    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "Ada Lovelace" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(fetches).toBe(4));
  });
});

// ── PATCH /{ws}/invitations/{id}/name ───────────────────────────────────────

describe("useRenameInvitation (PATCH .../invitations/{id}/name)", () => {
  it("patches the invitation's name path and refreshes that table", async () => {
    let sent: unknown = null;
    let listFetches = 0;
    server.use(
      http.get(`${BASE}/${WS}/invitations`, () => {
        listFetches += 1;
        return HttpResponse.json(page([invitation()]));
      }),
      http.patch(INVITE_NAME_PATH, async ({ request }) => {
        sent = await request.json();
        return HttpResponse.json({ display_name: "Grace Hopper" });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const list = renderHook(() => useInvitations(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(listFetches).toBe(1);

    const { result } = renderHook(() => useRenameInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({
      invitationId: INVITE,
      displayName: "Grace Hopper",
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sent).toEqual({ display_name: "Grace Hopper" });
    expect(result.current.data?.display_name).toBe("Grace Hopper");
    await waitFor(() => expect(listFetches).toBe(2));
  });

  it("keeps its blast radius to this workspace's invitations", async () => {
    let rosterFetches = 0;
    server.use(
      http.get(`${BASE}/${WS}/members`, () => {
        rosterFetches += 1;
        return HttpResponse.json(page([member()]));
      }),
      http.get(`${BASE}/${WS}/invitations`, () =>
        HttpResponse.json(page([invitation()]))
      ),
      http.patch(INVITE_NAME_PATH, () =>
        HttpResponse.json({ display_name: "Grace Hopper" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const roster = renderHook(() => useMembers(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(roster.result.current.isSuccess).toBe(true));
    expect(rosterFetches).toBe(1);

    const { result } = renderHook(() => useRenameInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ invitationId: INVITE, displayName: "Grace Hopper" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The hint is a workspace-local column on ONE invitation — not the shared
    // canonical name — so the member rename's wide sweep would be wrong here.
    // The roster query is MOUNTED: had it been invalidated it would have
    // refetched on the wire, and this count would read 2.
    expect(rosterFetches).toBe(1);
  });

  it("surfaces the terminal-state refusal as its own key", async () => {
    server.use(
      http.patch(INVITE_NAME_PATH, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.invitation_already_used",
            error: "Invitation already accepted",
            params: {},
          },
          { status: 400 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ invitationId: INVITE, displayName: "Grace Hopper" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // An accepted invitation's name is the member's name now — the refusal
    // says which endpoint to use, it is not a shrug.
    expect(result.current.error?.code).toBe(
      "error.400.invitation_already_used"
    );
  });
});

// ── the capability, ahead of the button and behind it ───────────────────────

describe("rename is gated on members.role.change", () => {
  it("denies the affordance BEFORE the call when the role lacks it", async () => {
    server.use(
      http.get(`${BASE}/${WS}`, () =>
        HttpResponse.json({
          ...WORKSPACE,
          my_role: "member",
          my_capabilities: ["workspace.view", "members.invite"],
        })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () => ({
        rename: useCapabilityGate(WS, "members.role.change"),
        invite: useCapabilityGate(WS, "members.invite"),
      }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.invite.allowed).toBe(true));
    // members.invite is NOT enough: the hint is the member's name after
    // acceptance, so a name edit rides with the role change, not the invite.
    expect(result.current.rename.allowed).toBe(false);
    // …and it is `standard`, so no step-up is demanded on top of it.
    expect(result.current.rename.level).toBe("standard");
    expect(result.current.rename.requiresStepUp).toBe(false);
  });

  it("surfaces the backend's capability refusal, params and all", async () => {
    server.use(
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json(
          {
            localizable_error: "error.403.missing_capability",
            error: "Your role does not include the members.role.change capability",
            params: { capability: "members.role.change" },
          },
          { status: 403 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "Ada Lovelace" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.403.missing_capability");
    expect(result.current.error?.status).toBe(403);
    expect(result.current.error?.params).toEqual({
      capability: "members.role.change",
    });
    expect(explainWorkspacesError(result.current.error?.code ?? "")).toBe(
      "contact_support"
    );
  });
});

// ── validation: stapel-profiles' canon, in this module's dialect ────────────

describe("name validation surfaces as the single error dialect", () => {
  it.each([
    "error.400.display_name_too_short",
    "error.400.display_name_forbidden_chars",
    "error.400.display_name_invisible_chars",
    "error.400.display_name_emoji",
  ])("keys %s and marks it fix_input", async (code) => {
    server.use(
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json(
          { localizable_error: code, error: "Bad name", params: {} },
          { status: 400 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "\u200b" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // Borrowed verbatim from stapel-profiles, so a host renders the same
    // sentence wherever a display name is typed.
    expect(result.current.error?.code).toBe(code);
    expect(result.current.error?.status).toBe(400);
    expect(explainWorkspacesError(code)).toBe("fix_input");
  });

  it("reports over-length as the fleet-standard max_length key, with its params", async () => {
    server.use(
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json(
          {
            localizable_error: "error.400.field.max_length",
            error: "display_name must be at most 35 characters",
            params: { field: "display_name", max_length: 35 },
          },
          { status: 400 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "A".repeat(36) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // No bespoke `display_name_too_long`: the ceiling is the serializer's
    // max_length, and it is reported the way every other field's is, so one
    // interpolation renders it.
    expect(result.current.error?.code).toBe("error.400.field.max_length");
    expect(result.current.error?.params).toEqual({
      field: "display_name",
      max_length: 35,
    });
  });

  it("does not invalidate a roster the rejected write never moved", async () => {
    let fetches = 0;
    server.use(
      http.get(`${BASE}/${WS}/members`, () => {
        fetches += 1;
        return HttpResponse.json(page([member()]));
      }),
      http.patch(MEMBER_NAME_PATH, () =>
        HttpResponse.json(
          {
            localizable_error: "error.503.profiles_unavailable",
            error: "The profiles service is unavailable; try again later",
            params: {},
          },
          { status: 503 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const roster = renderHook(() => useMembers(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(roster.result.current.isSuccess).toBe(true));

    const { result } = renderHook(() => useRenameMember(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER, displayName: "Ada Lovelace" });
    await waitFor(() => expect(result.current.isError).toBe(true));
    // An honest refusal where stapel-profiles does not run in the process —
    // never a 200 over a write that did not happen, and so nothing to refetch.
    expect(result.current.error?.code).toBe("error.503.profiles_unavailable");
    expect(explainWorkspacesError(result.current.error?.code ?? "")).toBe(
      "wait_and_retry"
    );
    expect(fetches).toBe(1);
  });
});
