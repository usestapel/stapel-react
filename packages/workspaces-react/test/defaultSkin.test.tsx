/**
 * Coverage for the settings surfaces added to this pair per the owner
 * directive (workspace settings: name/members/roles/invites): the
 * `<WorkspaceSettings/>` and `<MembersManager/>` default-skin components
 * built on this pair's existing headless hooks.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { registerWorkspacesI18n } from "../src/i18n/keys.js";
import { WorkspaceSettings, MembersManager, InviteAcceptPage } from "../src/default/index.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WS = "0192f000-0000-4000-8000-000000000001";

/** jsdom's own window is 1024x768 — the width every test that does not say
 * otherwise runs at, and the one the setup's `matchMedia` now honestly
 * evaluates `(min-width: 768px)` against. Restored after each test so a
 * phone-width case cannot leak into the next file's first render. */
const JSDOM_WIDTH = 1024;

function setViewportWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true });
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setViewportWidth(JSDOM_WIDTH);
});
afterAll(() => server.close());

const WORKSPACE = {
  id: WS,
  name: "Acme Engineering",
  slug: "acme-eng",
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

function wrap(runtime: WorkspacesRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const i18n = createI18n({ locale: "en" });
  registerWorkspacesI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <WorkspacesProvider runtime={runtime}>{children}</WorkspacesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<WorkspaceSettings/> (default skin)", () => {
  it("loads the workspace, renames it, and saves", async () => {
    server.use(
      http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)),
      http.patch(`${BASE}/${WS}`, async ({ request }) => {
        const patch = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ...WORKSPACE, ...patch });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <WorkspaceSettings workspaceId={WS} />));

    await waitFor(() => expect(screen.getByDisplayValue("Acme Engineering")).toBeDefined());
    fireEvent.change(screen.getByDisplayValue("Acme Engineering"), {
      target: { value: "Acme Eng Renamed" },
    });
    fireEvent.click(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.getByText("Save changes")).toBeDefined());
    expect(screen.getByText("acme-eng")).toBeDefined();
  });

  it("shows the danger zone (delete) only for the owner", async () => {
    server.use(
      http.get(`${BASE}/${WS}`, () =>
        HttpResponse.json({ ...WORKSPACE, my_role: "member" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <WorkspaceSettings workspaceId={WS} />));

    await waitFor(() => expect(screen.getByDisplayValue("Acme Engineering")).toBeDefined());
    expect(screen.queryByText("Delete workspace")).toBeNull();
  });

  it("deletes the workspace and calls onDeleted", async () => {
    let deleted = false;
    server.use(
      http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)),
      http.delete(`${BASE}/${WS}`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    let notified = false;
    render(
      wrap(
        runtime,
        <WorkspaceSettings workspaceId={WS} onDeleted={() => (notified = true)} />
      )
    );

    await waitFor(() => expect(screen.getByText("Delete workspace")).toBeDefined());
    fireEvent.click(screen.getByText("Delete workspace"));
    await waitFor(() =>
      expect(screen.getByText("Delete this workspace? This can't be undone.")).toBeDefined()
    );
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await waitFor(() => expect(deleted).toBe(true));
    await waitFor(() => expect(notified).toBe(true));
  });
});

/** The effective role registry MembersManager's RoleSelect now reads
 * (org-program §A2 — options come from GET /roles, not a hardcoded four). */
const ROLES = {
  roles: [
    { role: "owner", rank: 400, capabilities: ["*"], builtin: true },
    { role: "admin", rank: 300, capabilities: ["members.*"], builtin: true },
    { role: "member", rank: 200, capabilities: ["workspace.view"], builtin: true },
    { role: "viewer", rank: 100, capabilities: ["workspace.view"], builtin: true },
  ],
};

describe("<MembersManager/> (default skin)", () => {
  it("renders the roster and invites a new member", async () => {
    let inviteBody: Record<string, unknown> | undefined;
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json({ items: [MEMBER], next_anchor: null, prev_anchor: null, has_next: false, has_prev: false, count: 1 })
      ),
      http.post(`${BASE}/${WS}/members/invite`, async ({ request }) => {
        inviteBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ invitations: [] }, { status: 201 });
      })
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => expect(screen.getByText("Invite members")).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText("Type an email and press Enter"), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send invitations" }));
    await waitFor(() => expect(inviteBody).toEqual({ emails: ["new@example.com"], role: "member" }));
  });

  it("renders a read-only roster with canManage=false (labels via workspaces.role.*)", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json({ items: [MEMBER], next_anchor: null, prev_anchor: null, has_next: false, has_prev: false, count: 1 })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} canManage={false} />));

    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    expect(screen.getByText("Owner")).toBeDefined();
    expect(screen.queryByText("Invite")).toBeNull();
    expect(screen.queryByText("Remove")).toBeNull();
  });
});

/** One anchor page of members. `has_next: false` is what tells the skin the
 * page IS the roster — the only condition under which it may count owners. */
function membersPage(items: unknown[], overrides: Record<string, unknown> = {}) {
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

function memberRow(id: string, email: string, role: string) {
  return {
    id: `0192b000-0000-4000-8000-0000000000${id}`,
    workspace_id: WS,
    user_id: `0192a000-0000-4000-8000-0000000000${id}`,
    email,
    role,
    invited_at: "2026-05-20T10:00:00Z",
    accepted_at: "2026-05-20T10:05:00Z",
    last_accessed_at: null,
  };
}

const LAST_OWNER_REASON =
  "This is the workspace's only owner. Give someone else the owner role first.";

/**
 * The dialog surface is a DESIGN-SYSTEM rule inherited from
 * `@stapel/tokens-antd/skin`, not a local preference — so these assert the
 * rendered surface rather than restating the rule in prose. The stamp comes
 * from `SkinDialog` itself; a regression in the bridge reddens here too.
 */
describe("<MembersManager/> invite dialog — sheet on a phone, modal above it", () => {
  function serve(): void {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () => HttpResponse.json(membersPage([MEMBER])))
    );
  }

  async function openInviteDialog(): Promise<HTMLElement> {
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => expect(screen.getByTestId("members-invite-dialog")).toBeDefined());
    return screen.getByTestId("members-invite-dialog");
  }

  it("is a bottom sheet at a 390px phone viewport", async () => {
    serve();
    // BEFORE the render: the surface is read on the first client render, so a
    // width set afterwards would only prove the resize path.
    setViewportWidth(390);
    const body = await openInviteDialog();
    expect(body.getAttribute("data-stapel-dialog-surface")).toBe("sheet");
    // The sheet's dismissal is not gesture-only: the handle is a real button
    // carrying this pair's own i18n copy.
    expect(screen.getByRole("button", { name: "Close" })).toBeDefined();
  });

  it("is a centred modal at 1024", async () => {
    serve();
    setViewportWidth(1024);
    const body = await openInviteDialog();
    expect(body.getAttribute("data-stapel-dialog-surface")).toBe("modal");
  });
});

describe("<MembersManager/> — a control never offers what the backend would refuse", () => {
  it("switches off Remove for the last owner and PRINTS the reason", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json(
          membersPage([MEMBER, memberRow("02", "ada@example.com", "admin")])
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByText("ada@example.com")).toBeDefined());
    const [ownerRemove, adminRemove] = screen.getAllByRole("button", { name: "Remove" });
    // The sole owner: off, and the reason is TEXT beside it — a disabled
    // button receives no pointer events, so a tooltip would be unreadable.
    expect((ownerRemove as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(LAST_OWNER_REASON)).toBeDefined();
    // Everyone else is untouched: the gate is about the last owner, not about
    // switching the column off.
    expect((adminRemove as HTMLButtonElement).disabled).toBe(false);
  });

  it("leaves Remove on when a second owner exists", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json(
          membersPage([MEMBER, memberRow("03", "grace@example.com", "owner")])
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByText("grace@example.com")).toBeDefined());
    for (const button of screen.getAllByRole("button", { name: "Remove" })) {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
    expect(screen.queryByText(LAST_OWNER_REASON)).toBeNull();
  });

  it("claims nothing about the last owner when the page is not the whole roster", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json(
          // `has_next` — one owner ON THIS PAGE is not one owner in the
          // workspace, so the skin must not gate on a count it does not have.
          membersPage([MEMBER], { has_next: true, next_anchor: "a2" })
        )
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    expect((screen.getByRole("button", { name: "Remove" }) as HTMLButtonElement).disabled).toBe(
      false
    );
    expect(screen.queryByText(LAST_OWNER_REASON)).toBeNull();
  });

  it("renders NO enabled role picker when the role registry read fails", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/${WS}/members`, () => HttpResponse.json(membersPage([MEMBER])))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByTestId("members-roles-error")).toBeDefined());
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    // An enabled Select over `options: []` is a control that cannot do the one
    // thing it exists for. There is no picker at all — the role still reads.
    expect(screen.queryAllByRole("combobox")).toEqual([]);
    expect(screen.getByText("Owner")).toBeDefined();
  });

  it("blocks the invite submit — with the reason — while the registry is unreadable", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => new HttpResponse(null, { status: 500 })),
      http.get(`${BASE}/${WS}/members`, () => HttpResponse.json(membersPage([MEMBER])))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));

    await waitFor(() => expect(screen.getByTestId("members-roles-error")).toBeDefined());
    fireEvent.click(screen.getByText("Invite"));
    await waitFor(() => expect(screen.getByTestId("members-invite-dialog")).toBeDefined());
    fireEvent.change(screen.getByPlaceholderText("Type an email and press Enter"), {
      target: { value: "new@example.com" },
    });
    const submit = screen.getByRole("button", { name: "Send invitations" });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    // Two sentences, one text: the alert above the roster and the reason under
    // the switched-off submit. Both say the same true thing.
    expect(
      screen.getAllByText(
        "We could not load the role list, so roles cannot be changed right now. It is not a workspace without roles."
      ).length
    ).toBeGreaterThan(1);
  });
});

describe("<InviteAcceptPage/> (default skin — §B4 route component)", () => {
  const TOKEN = "tok-page-1";
  const PREVIEW = {
    workspace_name: "Acme Engineering",
    role: "member",
    email_masked: "i***@e***.com",
    status: "pending",
    email_registered: false,
    expires_at: "2026-07-31T10:00:00Z",
  };
  const NEW_MEMBER = {
    id: "0192b000-0000-4000-8000-000000000009",
    workspace_id: WS,
    user_id: "0192a000-0000-4000-8000-000000000009",
    email: "invitee@example.com",
    role: "member",
    invited_at: "2026-06-01T10:00:00Z",
    accepted_at: "2026-06-02T10:00:00Z",
    last_accessed_at: null,
  };

  it("walks the whole new-user path: claim → grant seam → initial-setup slot → accept", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () => HttpResponse.json(PREVIEW)),
      http.post(`${BASE}/invitations/${TOKEN}/claim`, () =>
        HttpResponse.json({ grant_token: "grant-page-1" })
      ),
      http.post(`${BASE}/invitations/accept`, () => HttpResponse.json(NEW_MEMBER))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    const granted: string[] = [];
    render(
      wrap(
        runtime,
        <InviteAcceptPage
          token={TOKEN}
          sessionEmail={null}
          // THE SEAM: the host exchanges at auth-react; here we just record —
          // the resolved promise advances the page automatically.
          onLoginGrant={(grant) => {
            granted.push(grant);
          }}
          renderInitialSetup={({ onDone }) => (
            <button data-testid="setup-slot" onClick={onDone}>
              setup-done
            </button>
          )}
        />
      )
    );

    // newUser: the deliberate create-account CTA.
    await waitFor(() =>
      expect(screen.getByText("Create account and continue")).toBeDefined()
    );
    fireEvent.click(screen.getByText("Create account and continue"));

    // grant handed out → auto-advance to the basic-data (initial-setup) slot.
    await waitFor(() => expect(granted).toEqual(["grant-page-1"]));
    await waitFor(() => expect(screen.getByTestId("setup-slot")).toBeDefined());
    fireEvent.click(screen.getByTestId("setup-slot"));

    // accept prompt → join.
    await waitFor(() =>
      expect(screen.getByText("Join workspace")).toBeDefined()
    );
    fireEvent.click(screen.getByText("Join workspace"));
    await waitFor(() =>
      expect(screen.getByText("You've joined Acme Engineering.")).toBeDefined()
    );
  });

  it("renders the terminal copy for a non-pending invitation", async () => {
    server.use(
      http.get(`${BASE}/invitations/${TOKEN}`, () =>
        HttpResponse.json({ ...PREVIEW, status: "expired" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <InviteAcceptPage token={TOKEN} sessionEmail={null} />));
    await waitFor(() =>
      expect(
        screen.getByText("This invitation has expired. Ask for a new one.")
      ).toBeDefined()
    );
  });
});
