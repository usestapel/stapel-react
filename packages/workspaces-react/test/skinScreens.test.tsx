/**
 * The screens the wave-B pair built but never PHOTOGRAPHED, and the two
 * things stapel-workspaces 0.30.0 made answerable.
 *
 * Three groups:
 *
 *  1. **A render per skin surface, at both widths and in both themes.** The
 *     four screens added for the §54 holes (`WorkspacesPage`,
 *     `InvitationsPane`, `AuditTrailPane`, `RoleSelectField`) had no render
 *     test of their own: a `mode = "light"` literal or a dimension that only
 *     works at 1024 would have shipped unnoticed. Every case asserts the skin
 *     root's own `data-stapel-skin-mode`, which is what the substrate stamps
 *     from the LIVE document mode.
 *  2. **`MemberResponse.is_self`.** Two controls the server refuses on the
 *     caller's own row — "Remove" and "Reset password" — are switched off with
 *     the reason beside them, and enabled on everybody else's. The password
 *     reset is the one that could not be seen before: it is refused with the
 *     same 404 a stranger gets, so an ungated button reads its own refusal as
 *     "this member has been removed".
 *  3. **A screen mounted with no workspace.** The nav contract routes; it does
 *     not hand a screen an ambient scope. So a screen mounted without one
 *     reads the runtime selection, and with nothing there renders the designed
 *     chooser — never a blank page, and never a throw from a provider a shell
 *     forgot to wire.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { SkinTheme } from "@stapel/tokens-antd/skin";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import { WorkspaceSelectionProvider } from "../src/model/selection.js";
import { registerWorkspacesI18n } from "../src/i18n/keys.js";
import {
  AuditTrailPane,
  InvitationsPane,
  MembersManager,
  RoleSelectField,
  WorkspacesPage,
} from "../src/default/index.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const WS = "0192f000-0000-4000-8000-000000000001";
const VIEWER = "0192a000-0000-4000-8000-000000000001";
const OTHER = "0192a000-0000-4000-8000-000000000002";

const JSDOM_WIDTH = 1024;
const PHONE_WIDTH = 390;

function setViewportWidth(px: number): void {
  Object.defineProperty(window, "innerWidth", { value: px, configurable: true });
}

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setViewportWidth(JSDOM_WIDTH);
  document.documentElement.removeAttribute("data-theme");
});
afterAll(() => server.close());

const WORKSPACE = {
  id: WS,
  name: "Acme Engineering",
  slug: "acme-eng",
  type: "work",
  owner_id: VIEWER,
  owner_display_name: "Ada Lovelace",
  settings: {},
  storage_used_bytes: 0,
  storage_limit_bytes: 5368709120,
  member_count: 2,
  my_role: "owner",
  my_capabilities: ["*"],
  can_delete: true,
  created_at: "2026-05-20T10:00:00Z",
  updated_at: "2026-05-20T10:00:00Z",
};

const ROLES = {
  roles: [
    { role: "owner", rank: 400, capabilities: ["*"], builtin: true },
    { role: "admin", rank: 300, capabilities: ["members.*"], builtin: true },
    { role: "member", rank: 200, capabilities: ["members.view"], builtin: true },
  ],
};

function member(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "0192b000-0000-4000-8000-000000000009",
    workspace_id: WS,
    user_id: OTHER,
    email: "grace@acme.test",
    display_name: "Grace Hopper",
    role: "admin",
    invited_at: "2026-05-21T10:00:00Z",
    accepted_at: "2026-05-21T10:05:00Z",
    last_accessed_at: null,
    is_self: false,
    ...overrides,
  };
}

function page(items: readonly unknown[]): Record<string, unknown> {
  return {
    items,
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: items.length,
  };
}

/** The roster the `is_self` group reads: the caller's own row and one other,
 * so "off here, on there" is one assertion pair rather than two fixtures. */
const ROSTER = page([
  member({
    id: "0192b000-0000-4000-8000-000000000001",
    user_id: VIEWER,
    email: "ada@acme.test",
    display_name: "Ada Lovelace",
    role: "owner",
    is_self: true,
  }),
  member({}),
]);

/** Every read the four screens perform, so a suite that renders one of them
 * never trips msw's unhandled-request guard on a neighbour's query. */
function readHandlers(): ReturnType<typeof http.get>[] {
  return [
    http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
    http.get(`${BASE}/instance`, () =>
      HttpResponse.json({ open_registration: true, allow_workspace_creation: true })
    ),
    http.get(`${BASE}/${WS}/members`, () => HttpResponse.json(ROSTER)),
    http.get(`${BASE}/${WS}/invitations`, () =>
      HttpResponse.json(
        page([
          {
            id: "0192c000-0000-4000-8000-000000000001",
            workspace_id: WS,
            email: "alan@acme.test",
            role: "member",
            status: "pending",
            expires_at: "2026-09-06T10:00:00Z",
            accepted_at: null,
            declined_at: null,
            revoked_at: null,
            created_at: "2026-08-23T10:00:00Z",
            invited_by_id: VIEWER,
          },
        ])
      )
    ),
    http.get(`${BASE}/${WS}/audit`, () =>
      HttpResponse.json(
        page([
          {
            id: "0192d000-0000-4000-8000-000000000001",
            action: "member_joined",
            actor_id: VIEWER,
            actor_display_name: "Ada Lovelace",
            subject_id: OTHER,
            subject_display_name: "Grace Hopper",
            subject_email: "grace@acme.test",
            role: "admin",
            metadata: {},
            created_at: "2026-08-22T09:00:00Z",
          },
        ])
      )
    ),
    http.get(`${BASE}/${WS}`, () => HttpResponse.json(WORKSPACE)),
    http.get(`${BASE}/`, () =>
      HttpResponse.json({
        workspaces: [WORKSPACE],
        preferred_workspace_id: WS,
        default_workspace_id: null,
        can_create_workspace: true,
      })
    ),
  ];
}

function wrap(children: ReactNode): ReactElement {
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
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

// ── 1. a render per skin surface × width × theme ─────────────────────────────

const SURFACES: readonly {
  readonly name: string;
  readonly testId: string;
  readonly render: () => ReactElement;
}[] = [
  {
    name: "<WorkspacesPage/>",
    testId: "workspaces-page",
    render: () => <WorkspacesPage />,
  },
  {
    name: "<InvitationsPane/>",
    testId: "invitations-pane",
    render: () => <InvitationsPane workspaceId={WS} />,
  },
  {
    name: "<AuditTrailPane/>",
    testId: "audit-trail",
    render: () => <AuditTrailPane workspaceId={WS} />,
  },
  {
    name: "<RoleSelectField/>",
    // The field is not a screen: it has no skin root of its own, so the case
    // mounts it the way a screen does — inside one.
    testId: "role-field-host",
    render: () => (
      <SkinTheme data-testid="role-field-host">
        <RoleSelectField
          value="admin"
          onChange={() => undefined}
          label="Role of Grace Hopper"
          testId="role-field"
        />
      </SkinTheme>
    ),
  },
];

describe("every default-skin surface renders at both widths, in both themes", () => {
  for (const surface of SURFACES) {
    for (const width of [PHONE_WIDTH, JSDOM_WIDTH]) {
      for (const mode of ["light", "dark"] as const) {
        it(`${surface.name} at ${width}px in ${mode}`, async () => {
          server.use(...readHandlers());
          setViewportWidth(width);
          // Stamped BEFORE the first render, exactly as the viewer frame and
          // a host's theme boot do — `useThemeMode` reads the live document.
          document.documentElement.setAttribute("data-theme", mode);

          render(wrap(surface.render()));

          const root = await screen.findByTestId(surface.testId);
          expect(root.getAttribute("data-stapel-skin-mode")).toBe(mode);
          // Not a blank shell: the surface reached a state with content in it.
          await waitFor(() => expect(root.textContent).not.toBe(""));
        });
      }
    }
  }
});

// ── 2. is_self: the two controls the server refuses on the caller's row ──────

describe("MemberResponse.is_self gates the self-refusing controls", () => {
  it("switches Remove and Reset password OFF on the caller's own row, with reasons", async () => {
    server.use(...readHandlers());
    render(wrap(<MembersManager workspaceId={WS} />));

    const remove = await screen.findByTestId(`member-remove-${VIEWER}`);
    const reset = await screen.findByTestId(`member-reset-password-${VIEWER}`);
    expect((remove as HTMLButtonElement).disabled).toBe(true);
    expect((reset as HTMLButtonElement).disabled).toBe(true);
    // The reason is BESIDE the control, and it is the reason a person can act
    // on — not "forbidden".
    expect(
      screen.getByText(
        "This is you. Ask another owner or admin to remove you from the workspace."
      )
    ).toBeDefined();
    expect(
      screen.getByText(
        "This is you. Change your own password in your account settings — this acts on somebody else's account."
      )
    ).toBeDefined();
  });

  it("leaves both ON for another member's row", async () => {
    server.use(...readHandlers());
    render(wrap(<MembersManager workspaceId={WS} />));

    const remove = await screen.findByTestId(`member-remove-${OTHER}`);
    const reset = await screen.findByTestId(`member-reset-password-${OTHER}`);
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect((reset as HTMLButtonElement).disabled).toBe(false);
  });

  /**
   * A backend older than 0.30.0 sends no `is_self` at all. The absence must
   * read as "the server did not say" — nothing is claimed and nothing is
   * greyed out — never as a guess about which row is the reader's.
   */
  it("claims nothing when the backend sends no is_self", async () => {
    // Overrides go FIRST: msw resolves with the first matching handler.
    server.use(
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json(
          page([
            member({
              id: "0192b000-0000-4000-8000-000000000001",
              user_id: VIEWER,
              email: "ada@acme.test",
              display_name: "Ada Lovelace",
              role: "admin",
              is_self: undefined,
            }),
            member({}),
          ])
        )
      ),
      ...readHandlers()
    );
    render(wrap(<MembersManager workspaceId={WS} />));

    const reset = await screen.findByTestId(`member-reset-password-${VIEWER}`);
    expect((reset as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("administrative password reset (#110)", () => {
  it("resets another member's password and shows the one-shot credential once", async () => {
    server.use(
      http.post(`${BASE}/${WS}/members/${OTHER}/password/reset`, () =>
        HttpResponse.json({
          user_id: OTHER,
          sessions_revoked: 2,
          generated_password: "correct-horse-battery",
          first_login_policies_applied: ["password_change"],
          notified: false,
        })
      ),
      ...readHandlers()
    );
    render(wrap(<MembersManager workspaceId={WS} />));

    fireEvent.click(await screen.findByTestId(`member-reset-password-${OTHER}`));
    // The step-up is announced BEFORE the click that triggers it, not
    // discovered through a 403.
    expect(await screen.findByTestId("members-reset-stepup")).toBeDefined();

    fireEvent.click(screen.getByTestId("members-reset-submit"));

    const shown = await screen.findByTestId("members-reset-password");
    expect(shown.textContent).toBe("correct-horse-battery");
    // `notified: false` means the account had no channel — the admin is the
    // only one who can tell them, so the screen says so.
    expect(screen.getByTestId("members-reset-not-notified")).toBeDefined();

    // Closing takes the credential with it: the mutation is reset, so the
    // dialog cannot re-display a live password on the next open.
    fireEvent.click(screen.getByTestId("members-reset-done"));
    await waitFor(() =>
      expect(screen.queryByTestId("members-reset-password")).toBeNull()
    );
  });
});

// ── 3. a workspace-scoped screen mounted without a workspace ────────────────

describe("a nav-mounted screen with no workspace in the route", () => {
  it("renders the designed chooser instead of a blank page (no selection provider)", async () => {
    server.use(...readHandlers());
    render(wrap(<MembersManager />));

    expect(
      await screen.findByTestId("members-manager-workspace-choose")
    ).toBeDefined();
    expect(screen.getByText("Choose a workspace")).toBeDefined();
    // And the roster is NOT drawn against a workspace nobody named.
    expect(screen.queryByTestId("members-rows")).toBeNull();
  });

  it("reads the ACTIVE workspace from the runtime selection when one is wired", async () => {
    server.use(...readHandlers());
    render(
      wrap(
        <WorkspaceSelectionProvider repository={null}>
          <MembersManager />
        </WorkspaceSelectionProvider>
      )
    );

    // The same roster the explicit-prop cases render — resolved from the
    // selection chain, with no route param anywhere.
    expect(await screen.findByTestId(`member-row-${OTHER}`)).toBeDefined();
  });

  it("says the person belongs to no workspace, which is a different sentence", async () => {
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json({
          workspaces: [],
          preferred_workspace_id: null,
          default_workspace_id: null,
          can_create_workspace: false,
        })
      ),
      ...readHandlers()
    );
    render(
      wrap(
        <WorkspaceSelectionProvider repository={null}>
          <AuditTrailPane />
        </WorkspaceSelectionProvider>
      )
    );

    expect(await screen.findByTestId("audit-trail-workspace-none")).toBeDefined();
    expect(screen.getByText("You are not in a workspace yet")).toBeDefined();
  });
});
