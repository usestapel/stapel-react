import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { render, renderHook, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { Can } from "../src/headless/Can.js";
import { RoleSelect } from "../src/headless/RoleSelect.js";
import { useRoles, useInvitationPreview, useCapabilities } from "../src/model/queries.js";
import { capabilityMatches, hasCapability } from "../src/model/capabilities.js";
import { maskEmail, emailMatchesMask } from "../src/model/emailMask.js";
import { createInviteAcceptFlow } from "../src/flows/inviteAcceptFlow.js";
import { createWorkspacesApi } from "../src/api/workspacesApi.js";
import { registerWorkspacesI18n } from "../src/i18n/keys.js";

/**
 * Org-program wave (workspaces-react 0.7.0, spec §A2/§B4): the capability
 * matcher port, the email-mask port, the registry-driven role surface, the
 * AllowAny invitation preview, and the InviteAcceptFlow machine — every
 * §B4 branch.
 */

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WS = "0192f000-0000-4000-8000-000000000001";
const TOKEN = "tok-invite-1";

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

const ROLES = {
  roles: [
    { role: "owner", rank: 400, capabilities: ["*"], builtin: true },
    { role: "admin", rank: 300, capabilities: ["workspace.view", "members.*"], builtin: true },
    { role: "secretary", rank: 250, capabilities: ["meetings.spotlight"], builtin: false },
    { role: "member", rank: 200, capabilities: ["workspace.view"], builtin: true },
  ],
};

/** Preview factory — `pending`, invited email masked as the backend would. */
function preview(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    workspace_name: "Acme Engineering",
    role: "member",
    email_masked: "i***@e***.com",
    status: "pending",
    email_registered: false,
    expires_at: "2026-07-31T10:00:00Z",
    ...overrides,
  };
}

const MEMBER = {
  id: "0192b000-0000-4000-8000-000000000003",
  workspace_id: WS,
  user_id: "0192a000-0000-4000-8000-000000000003",
  email: "invitee@example.com",
  role: "member",
  invited_at: "2026-06-01T10:00:00Z",
  accepted_at: "2026-06-02T10:00:00Z",
  last_accessed_at: null,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeApi() {
  return createWorkspacesApi(
    // A bare client is enough for flow tests — no React tree needed.
    createWorkspacesRuntime({ baseUrl: BASE }).client
  );
}

function wrap(runtime: WorkspacesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerWorkspacesI18n(i18n);
  // A client-merged label for a deployment role — RoleSelect's labelFor
  // resolves it; `secretary` below stays UNlabelled to prove the raw-name
  // fallback.
  i18n.registerBundle("en", { "workspaces.role.admin": "Administrator" });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

// ── capability matcher (backend port — semantics must not drift) ─────────────

describe("capabilityMatches (ported matcher)", () => {
  it("matches exact strings", () => {
    expect(capabilityMatches("members.view", "members.view")).toBe(true);
    expect(capabilityMatches("members.view", "members.invite")).toBe(false);
  });

  it("matches the global wildcard", () => {
    expect(capabilityMatches("anything.at.all", "*")).toBe(true);
  });

  it("matches prefix wildcards, including deeper segments", () => {
    expect(capabilityMatches("members.remove", "members.*")).toBe(true);
    expect(capabilityMatches("members.role.change", "members.*")).toBe(true);
    expect(capabilityMatches("meetings.kick", "members.*")).toBe(false);
    // Prefix is segment-anchored via the dot: "member.x" must NOT match.
    expect(capabilityMatches("member.x", "members.*")).toBe(false);
  });

  it("hasCapability denies by default", () => {
    expect(hasCapability(undefined, "workspace.view")).toBe(false);
    expect(hasCapability([], "workspace.view")).toBe(false);
    expect(hasCapability(["*"], "workspace.view")).toBe(true);
  });
});

// ── email mask (backend port — mask equality drives §B4 routing) ─────────────

describe("maskEmail (ported _mask_email)", () => {
  it("masks like the backend example", () => {
    expect(maskEmail("mary@example.com")).toBe("m***@e***.com");
  });

  it("keeps only the first chars and the TLD", () => {
    expect(maskEmail("invitee@corp.example.io")).toBe("i***@c***.io");
  });

  it("matches case-insensitively", () => {
    expect(emailMatchesMask("Invitee@Example.com", "i***@e***.com")).toBe(true);
    expect(emailMatchesMask("other@example.com", "i***@e***.com")).toBe(false);
  });
});

// ── roles endpoint + RoleSelect ──────────────────────────────────────────────

describe("useRoles / RoleSelect", () => {
  it("fetches the effective registry", async () => {
    server.use(http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)));
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useRoles(), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((r) => r.role)).toEqual([
      "owner",
      "admin",
      "secretary",
      "member",
    ]);
  });

  it("labels builtin roles via workspaces.role.* (client merge wins) and falls back to the raw name", async () => {
    server.use(http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)));
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <RoleSelect>
          {({ roles, labelFor }) => (
            <ul>
              {roles.map((r) => (
                <li key={r.role} data-testid={`role-${r.role}`}>
                  {labelFor(r.role)}
                </li>
              ))}
            </ul>
          )}
        </RoleSelect>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("role-owner").textContent).toBe("Owner")
    );
    // Client-bundle merge overrode the pair's default label.
    expect(screen.getByTestId("role-admin").textContent).toBe("Administrator");
    // No workspaces.role.secretary anywhere → the RAW key, never a dotted key.
    expect(screen.getByTestId("role-secretary").textContent).toBe("secretary");
  });
});

// ── invitation preview (AllowAny — not session-gated) ────────────────────────

describe("useInvitationPreview", () => {
  it("fetches the public preview by token", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useInvitationPreview(TOKEN), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.status).toBe("pending");
    expect(result.current.data?.email_registered).toBe(true);
  });

  it("stays disabled without a token", () => {
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useInvitationPreview(null), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    expect(result.current.fetchStatus).toBe("idle");
  });
});

// ── Can + useCapabilities ────────────────────────────────────────────────────

describe("<Can> / useCapabilities", () => {
  it("exposes my_capabilities with the wildcard matcher", async () => {
    server.use(http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)));
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const { result } = renderHook(() => useCapabilities(WS), {
      wrapper: ({ children }) => wrap(runtime, children),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.capabilities).toEqual(["workspace.view", "members.*"]);
    expect(result.current.can("members.invite")).toBe(true);
    expect(result.current.can("meetings.kick")).toBe(false);
  });

  it("gates static children and renders the render-prop verdict", async () => {
    server.use(http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)));
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <div>
          <Can capability="members.remove" workspaceId={WS}>
            <span data-testid="allowed-child">yes</span>
          </Can>
          <Can
            capability="meetings.kick"
            workspaceId={WS}
            fallback={<span data-testid="denied-fallback">no</span>}
          >
            <span data-testid="denied-child">yes</span>
          </Can>
          <Can capability="meetings.kick" workspaceId={WS}>
            {({ allowed }) => (
              <span data-testid="verdict">{allowed ? "on" : "off"}</span>
            )}
          </Can>
        </div>
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId("allowed-child")).not.toBeNull()
    );
    expect(screen.queryByTestId("denied-child")).toBeNull();
    expect(screen.queryByTestId("denied-fallback")).not.toBeNull();
    expect(screen.getByTestId("verdict").textContent).toBe("off");
  });
});

// ── InviteAcceptFlow — every §B4 branch ──────────────────────────────────────

describe("inviteAcceptFlow (§B4 machine)", () => {
  it("session & email match → acceptPrompt → accept → accepted", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      ),
      http.post(`${BASE}/invitations/accept`, async ({ request }) => {
        expect(await request.json()).toEqual({ token: TOKEN });
        return HttpResponse.json(MEMBER);
      })
    );
    const onAccepted = vi.fn();
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN, onAccepted });
    await flow.load("invitee@example.com");
    expect(flow.machine.getState().step).toBe("acceptPrompt");

    await flow.accept();
    const s = flow.machine.getState();
    expect(s.step).toBe("accepted");
    if (s.step === "accepted") expect(s.member.id).toBe(MEMBER.id);
    expect(onAccepted).toHaveBeenCalledOnce();
  });

  it("session & email mismatch → wrongAccount; sessionEstablished with the right account re-routes", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load("other@example.com");
    expect(flow.machine.getState().step).toBe("wrongAccount");

    flow.sessionEstablished("invitee@example.com");
    expect(flow.machine.getState().step).toBe("acceptPrompt");
  });

  it("no session & registered → loginRequired → sessionEstablished → acceptPrompt", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load(null);
    expect(flow.machine.getState().step).toBe("loginRequired");

    flow.sessionEstablished("invitee@example.com");
    expect(flow.machine.getState().step).toBe("acceptPrompt");
  });

  it("no session & new user → claim → grantIssued (grant handed out) → basicData → acceptPrompt → decline", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview())
      ),
      http.post(`${BASE}/invitations/${TOKEN}/claim`, () =>
        HttpResponse.json({ grant_token: "grant-1" })
      ),
      http.post(
        `${BASE}/invitations/${TOKEN}/decline`,
        () => new HttpResponse(null, { status: 204 })
      )
    );
    const onLoginGrant = vi.fn();
    const onDeclined = vi.fn();
    const flow = createInviteAcceptFlow({
      api: makeApi(),
      token: TOKEN,
      onLoginGrant,
      onDeclined,
    });
    await flow.load(null);
    expect(flow.machine.getState().step).toBe("newUser");

    await flow.claim();
    const issued = flow.machine.getState();
    expect(issued.step).toBe("grantIssued");
    if (issued.step === "grantIssued") expect(issued.grantToken).toBe("grant-1");
    // THE SEAM: the grant leaves through the callback; the host exchanges it
    // at auth (auth-react's exchangeLoginGrant) — never this pair.
    expect(onLoginGrant).toHaveBeenCalledWith("grant-1");

    flow.grantExchanged();
    expect(flow.machine.getState().step).toBe("basicData");

    flow.completeBasicData();
    expect(flow.machine.getState().step).toBe("acceptPrompt");

    await flow.decline();
    expect(flow.machine.getState().step).toBe("declined");
    expect(onDeclined).toHaveBeenCalledOnce();
  });

  it("non-pending statuses park in unavailable", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ status: "expired" }))
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load("invitee@example.com");
    const s = flow.machine.getState();
    expect(s.step).toBe("unavailable");
    if (s.step === "unavailable") expect(s.status).toBe("expired");
  });

  it("preview failure → previewError with the localizable code", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(
          { localizable_error: "error.404.invitation_not_found" },
          { status: 404 }
        )
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load(null);
    const s = flow.machine.getState();
    expect(s.step).toBe("previewError");
    if (s.step === "previewError") {
      expect(s.error.code).toBe("error.404.invitation_not_found");
    }
  });

  it("claim 409 (email already registered) → claimError, retryable", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview())
      ),
      http.post(`${BASE}/invitations/${TOKEN}/claim`, () =>
        HttpResponse.json(
          { localizable_error: "error.409.email_already_registered" },
          { status: 409 }
        )
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load(null);
    await flow.claim();
    const s = flow.machine.getState();
    expect(s.step).toBe("claimError");
    if (s.step === "claimError") {
      expect(s.error.code).toBe("error.409.email_already_registered");
      expect(s.error.status).toBe(409);
    }
  });

  it("accept failure → acceptError (challenge preserved for retry)", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      ),
      http.post(`${BASE}/invitations/accept`, () =>
        HttpResponse.json(
          { localizable_error: "error.400.invitation_expired" },
          { status: 400 }
        )
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load("invitee@example.com");
    await flow.accept();
    const s = flow.machine.getState();
    expect(s.step).toBe("acceptError");
    if (s.step === "acceptError") {
      expect(s.error.code).toBe("error.400.invitation_expired");
    }
    // The prompt data survives — accept() may be retried from acceptError.
    await flow.accept();
    expect(flow.machine.getState().step).toBe("acceptError");
  });

  it("guards: claim/accept are no-ops outside their steps", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json(preview({ email_registered: true }))
      )
    );
    const flow = createInviteAcceptFlow({ api: makeApi(), token: TOKEN });
    await flow.load(null); // → loginRequired
    await flow.claim(); // not a claim step — must not fire the request
    expect(flow.machine.getState().step).toBe("loginRequired");
    await flow.accept(); // not an accept step either
    expect(flow.machine.getState().step).toBe("loginRequired");
  });
});
