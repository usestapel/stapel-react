import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import {
  useCapabilityGate,
  useInfiniteInvitations,
  useInvitations,
} from "../src/model/queries.js";
import {
  useResendInvitation,
  useResetMemberPassword,
  useRevokeInvitation,
  useUpdateSecuritySettings,
} from "../src/model/mutations.js";
import {
  capabilityLevel,
  readVerificationEnrollment,
} from "../src/model/stepUp.js";

/**
 * The invitation-administration + administrative-password-reset wave
 * (workspaces-react 0.8.0 against stapel-workspaces 0.14.0, #109/#110).
 *
 * Every test here reds out against 0.7.0: the methods, the hooks and the
 * query keys simply did not exist, and the endpoints were unreachable from
 * the frontend at all.
 */

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WS = "0192f000-0000-4000-8000-000000000001";
const USER = "0192a000-0000-4000-8000-000000000002";
const INVITE = "0192c000-0000-4000-8000-000000000001";

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: INVITE,
    workspace_id: WS,
    email: "alice@example.com",
    role: "member",
    status: "pending",
    expires_at: "2026-07-31T10:00:00Z",
    accepted_at: null,
    declined_at: null,
    revoked_at: null,
    created_at: "2026-07-24T10:00:00Z",
    invited_by_id: "0192a000-0000-4000-8000-000000000001",
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
  my_capabilities: ["workspace.view", "members.*"],
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

// ── GET /{ws}/invitations — the anchor-paginated admin table ────────────────

describe("useInvitations (GET /{ws}/invitations)", () => {
  it("sends the status + search filters and returns the page", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${BASE}/${WS}/invitations`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(page([invitation()]));
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () =>
        useInvitations(WS, { status: "never_accepted", search: "alice@" }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items?.[0]?.email).toBe("alice@example.com");
    expect(seen[0]?.searchParams.get("status")).toBe("never_accepted");
    expect(seen[0]?.searchParams.get("search")).toBe("alice@");
  });

  it("paginates by ANCHOR, not by page number", async () => {
    const seen: URL[] = [];
    server.use(
      http.get(`${BASE}/${WS}/invitations`, ({ request }) => {
        seen.push(new URL(request.url));
        return HttpResponse.json(page([invitation()]));
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useInvitations(WS, { anchor: "anchor-2", direction: "next" }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = seen[0] as URL;
    expect(query.searchParams.get("anchor")).toBe("anchor-2");
    expect(query.searchParams.get("direction")).toBe("next");
    // The failure this guards: an offset/page-number pager silently skewing
    // the moment an invitation is revoked mid-scroll.
    expect(query.searchParams.has("page")).toBe(false);
    expect(query.searchParams.has("offset")).toBe(false);
  });

  it("walks the anchor chain page by page (infinite list)", async () => {
    const anchors: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/${WS}/invitations`, ({ request }) => {
        const anchor = new URL(request.url).searchParams.get("anchor");
        anchors.push(anchor);
        return anchor === null
          ? HttpResponse.json(
              page([invitation({ id: "inv-1" })], {
                next_anchor: "anchor-2",
                has_next: true,
              })
            )
          : HttpResponse.json(page([invitation({ id: "inv-2" })]));
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () => useInfiniteInvitations(WS, { status: "pending" }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    // The second request carried the FIRST page's next_anchor — nothing else.
    expect(anchors).toEqual([null, "anchor-2"]);
    expect(result.current.hasNextPage).toBe(false);
  });
});

// ── revoke / resend ─────────────────────────────────────────────────────────

describe("useRevokeInvitation (POST .../revoke)", () => {
  it("posts to the revoke path and returns the updated row", async () => {
    server.use(
      http.post(`${BASE}/${WS}/invitations/${INVITE}/revoke`, () =>
        HttpResponse.json(
          invitation({ status: "revoked", revoked_at: "2026-07-26T09:00:00Z" })
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useRevokeInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate(INVITE);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Revoke ≠ decline: both stay distinguishable in `status` forever.
    expect(result.current.data?.status).toBe("revoked");
    expect(result.current.data?.declined_at).toBeNull();
  });

  it("surfaces the backend's own key when the invitation is already used", async () => {
    server.use(
      http.post(`${BASE}/${WS}/invitations/${INVITE}/revoke`, () =>
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
    const { result } = renderHook(() => useRevokeInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate(INVITE);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.code).toBe("error.400.invitation_already_used");
  });
});

describe("useResendInvitation (POST .../resend)", () => {
  it("returns the row with the RESTARTED ttl and refetches the table", async () => {
    let listFetches = 0;
    server.use(
      http.get(`${BASE}/${WS}/invitations`, () => {
        listFetches += 1;
        return HttpResponse.json(page([invitation()]));
      }),
      http.post(`${BASE}/${WS}/invitations/${INVITE}/resend`, () =>
        HttpResponse.json(invitation({ expires_at: "2026-08-09T10:00:00Z" }))
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const list = renderHook(() => useInvitations(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(listFetches).toBe(1);

    const { result } = renderHook(() => useResendInvitation(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate(INVITE);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // The token was rotated and the TTL restarted — a table still showing the
    // old expiry would be lying about a live credential.
    expect(result.current.data?.expires_at).toBe("2026-08-09T10:00:00Z");
    await waitFor(() => expect(listFetches).toBe(2));
  });
});

// ── administrative password reset ──────────────────────────────────────────

describe("useResetMemberPassword (POST .../password/reset)", () => {
  const RESET_PATH = `${BASE}/${WS}/members/${USER}/password/reset`;

  it("returns the one-shot password and keeps it OUT of the query cache", async () => {
    server.use(
      http.post(RESET_PATH, () =>
        HttpResponse.json({
          user_id: USER,
          generated_password: "Tr0ub4dor-&3-once",
          sessions_revoked: 2,
          first_login_policies_applied: ["password_change"],
          notified: true,
        })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useResetMemberPassword(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.generated_password).toBe("Tr0ub4dor-&3-once");
    expect(result.current.data?.sessions_revoked).toBe(2);
    expect(result.current.data?.first_login_policies_applied).toEqual([
      "password_change",
    ]);

    // The credential must never reach a query — core's runtime persists the
    // WHOLE per-user query cache to localStorage, so a `setQueryData` here
    // would write a live password to disk and to every devtools panel.
    const persisted = JSON.stringify(dehydrate(queryClient));
    expect(persisted).not.toContain("Tr0ub4dor-&3-once");
    expect(persisted).not.toContain("generated_password");
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((query) =>
          JSON.stringify(query.state.data ?? null).includes("Tr0ub4dor")
        )
    ).toBe(false);
  });

  it("omits generated_password when the admin chose one", async () => {
    let body: unknown = null;
    server.use(
      http.post(RESET_PATH, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          user_id: USER,
          generated_password: null,
          sessions_revoked: 1,
          first_login_policies_applied: [],
          notified: false,
        });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useResetMemberPassword(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({
      userId: USER,
      body: { password: "chosen-by-admin", first_login_policies: [], reason: "SUP-42" },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({
      password: "chosen-by-admin",
      first_login_policies: [],
      reason: "SUP-42",
    });
    // An EXPLICIT empty list is a deliberate, auditable choice — not "unset".
    expect(result.current.data?.first_login_policies_applied).toEqual([]);
    expect(result.current.data?.notified).toBe(false);
  });

  it("expresses the step-up demand BEFORE the call, and reads the enrollment 403", async () => {
    server.use(
      http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)),
      http.post(RESET_PATH, () =>
        HttpResponse.json(
          {
            localizable_error: "error.403.verification_required",
            error: "Verification required",
            params: {},
            // The ENROLLMENT envelope: no challenge_id, because the caller
            // holds no factor to challenge. Core cannot drive this one.
            verification: {
              scope: "sensitive",
              factors: ["totp", "passkey"],
              enroll: true,
            },
          },
          { status: 403 }
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();

    // 1. Before any click: the gate already knows this is a `high` capability.
    const gate = renderHook(
      () => useCapabilityGate(WS, "members.password.reset"),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(gate.result.current.allowed).toBe(true));
    expect(gate.result.current.level).toBe("high");
    expect(gate.result.current.requiresStepUp).toBe(true);
    expect(gate.result.current.stepUpScope).toBe("sensitive");

    // 2. And when the app skipped that and clicked anyway, the refusal is
    //    readable as "enroll a factor first", not as a dead end.
    const { result } = renderHook(() => useResetMemberPassword(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ userId: USER });
    await waitFor(() => expect(result.current.isError).toBe(true));
    const enrollment = readVerificationEnrollment(result.current.error);
    expect(enrollment).toEqual({
      scope: "sensitive",
      factors: ["totp", "passkey"],
    });
  });
});

describe("step-up level port", () => {
  it("mirrors the backend's BUILTIN_CAPABILITY_LEVELS", () => {
    expect(capabilityLevel("members.password.reset")).toBe("high");
    expect(capabilityLevel("members.provision")).toBe("high");
    expect(capabilityLevel("workspace.security.manage")).toBe("high");
    expect(capabilityLevel("members.invite")).toBe("standard");
  });

  it("does not mistake a step-up CHALLENGE for an enrollment demand", () => {
    // A challenge carries a challenge_id: core intercepts and replays it, so
    // the consumer must NOT be told to send the user to enrollment.
    expect(
      readVerificationEnrollment({
        verification: {
          challenge_id: "chal-1",
          scope: "sensitive",
          factors: ["totp"],
        },
      })
    ).toBeNull();
    expect(readVerificationEnrollment({ localizable_error: "error.403.forbidden" })).toBeNull();
    expect(readVerificationEnrollment(null)).toBeNull();
  });

  it("gates on the CAPABILITY, so a product role is not locked out by its name", async () => {
    // `secretary` is a deployment role: no `role === "admin"` test will ever
    // let it through, whatever the capability registry grants it.
    server.use(
      http.get(`${BASE}/${WS}`, () =>
        HttpResponse.json({
          ...WORKSPACE,
          my_role: "secretary",
          my_capabilities: ["workspace.view", "members.invite"],
        })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(
      () => ({
        invite: useCapabilityGate(WS, "members.invite"),
        reset: useCapabilityGate(WS, "members.password.reset"),
      }),
      { wrapper: ({ children }) => wrap(runtime, queryClient, children) }
    );
    await waitFor(() => expect(result.current.invite.allowed).toBe(true));
    expect(result.current.invite.requiresStepUp).toBe(false);
    // …and it is still denied what the registry did not grant.
    expect(result.current.reset.allowed).toBe(false);
  });
});

// ── security settings (provisioned_user_policies is a LIST) ────────────────

describe("useUpdateSecuritySettings (PATCH /{ws} settings.security)", () => {
  it("sends the policies as a LIST and preserves the rest of settings", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/${WS}`, () =>
        HttpResponse.json({
          ...WORKSPACE,
          settings: {
            branding: { logo: "acme.png" },
            security: { require_mfa: false, policies_configured: false },
          },
        })
      ),
      http.patch(`${BASE}/${WS}`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...WORKSPACE, settings: sent.settings });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useUpdateSecuritySettings(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({
      provisioned_user_policies: ["password_change", "mfa_enroll"],
      require_mfa: true,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sent).toEqual({
      settings: {
        branding: { logo: "acme.png" },
        security: {
          require_mfa: true,
          // A LIST since 0.13.0 (#90) — independent demands, not alternatives.
          provisioned_user_policies: ["password_change", "mfa_enroll"],
        },
      },
    });
    // `policies_configured` is derived and read-only — never echoed back.
    const security = (
      (sent as unknown as { settings: { security: Record<string, unknown> } })
        .settings
    ).security;
    expect("policies_configured" in security).toBe(false);
    expect("provisioned_user_policy" in security).toBe(false);
  });

  it("sends an explicit empty list rather than dropping it", async () => {
    let sent: Record<string, unknown> | null = null;
    server.use(
      http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)),
      http.patch(`${BASE}/${WS}`, async ({ request }) => {
        sent = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...WORKSPACE, settings: sent.settings });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const queryClient = makeClient();
    const { result } = renderHook(() => useUpdateSecuritySettings(WS), {
      wrapper: ({ children }) => wrap(runtime, queryClient, children),
    });
    result.current.mutate({ provisioned_user_policies: [] });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(sent).toEqual({
      settings: { security: { provisioned_user_policies: [] } },
    });
  });
});
