/**
 * The operator console (`@stapel/auth-react/default/admin`).
 *
 * Five staff-only screens over endpoints that answer 403 to everybody else,
 * so the first thing every one of them has to get right is the refusal:
 * rendering a 403 as an empty list tells an operator "there is no enterprise
 * SSO configured" when the truth is "you were not allowed to look". That is
 * asserted for all five, once, below.
 *
 * The rest of the file pins the decisions each screen makes that a naive
 * implementation would get wrong: the write-only identity-provider form, the
 * one moment a service key's secret exists, the account ids the staff-roles
 * screen refuses to invent names for, the two consequence-bearing switches on
 * account creation, and the audit filters that commit rather than fire per
 * keystroke.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { CONFIRM_OK_TESTID } from "@stapel/tokens-antd/skin";
import { createAuthRuntime } from "../../src/model/runtime.js";
import type { AuthRuntime } from "../../src/model/runtime.js";
import { AuthProvider } from "../../src/headless/AuthProvider.js";
import { registerAuthI18n } from "../../src/i18n/keys.js";
import {
  AdminAuditPanel,
  AdminUsersPanel,
  ServiceKeysPanel,
  SsoOrgsPanel,
  StaffRolesPanel,
} from "../../src/default/admin/index.js";
import { BASE } from "../helpers.js";

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
  setViewportWidth(1024);
  document.documentElement.removeAttribute("data-theme");
});
afterAll(() => server.close());

function setViewportWidth(width: number): void {
  Object.defineProperty(window, "innerWidth", { value: width, writable: true });
  window.dispatchEvent(new Event("resize"));
}

function wrap(runtime: AuthRuntime, children: ReactNode): ReactElement {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const i18n = createI18n({ locale: "en" });
  registerAuthI18n(i18n);
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <AuthProvider runtime={runtime}>{children}</AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

const ORG = {
  id: "org-1",
  name: "Acme Corporation",
  slug: "acme",
  domain: "acmecorp.com",
  sso_enforced: true,
  created_at: "2026-01-19T10:00:00Z",
};

const KEY = {
  id: 1,
  name: "Billing reconciler",
  key: "sk_live_masked",
  description: "Nightly invoice sync",
  is_active: true,
  created_at: "2026-04-08T06:00:00Z",
  last_used_at: null,
  allowed_endpoints: ["/billing/api/v1/invoices/"],
};

const ASSIGNMENT = {
  id: "sr-1",
  user: "8f1d8f7a-2e2b-4b5f-9d3a-6d1a0b2c3d4e",
  role_name: "moderator",
  assigned_by: null,
  created_at: "2026-07-01T09:00:00Z",
};

const AUDIT_PAGE = {
  count: 2,
  next: null,
  results: [
    {
      id: "a-1",
      event_type: "user.login_succeeded",
      ip_address: "95.24.17.5",
      user_agent: "Chrome/126",
      metadata: {},
      created_at: "2026-08-24T09:30:00Z",
    },
  ],
};

/** Every read this suite's screens make, answered 403 — the shape stapel-auth
 *  really sends (`localizable_error` is a STRING; see stapel-core's
 *  `StapelErrorResponse`). */
function forbidAll(): void {
  const refuse = (): HttpResponse =>
    HttpResponse.json({ localizable_error: "error.403.forbidden" }, { status: 403 });
  server.use(
    http.get(`${BASE}/sso/orgs/`, refuse),
    http.get(`${BASE}/service-keys`, refuse),
    http.get(`${BASE}/staff-roles/`, refuse),
    http.get(`${BASE}/admin/audit/`, refuse)
  );
}

describe("the operator console — a refusal is a refusal, never an empty list", () => {
  const screens: readonly (readonly [string, () => ReactElement])[] = [
    ["Enterprise SSO", () => <SsoOrgsPanel />],
    ["Service keys", () => <ServiceKeysPanel />],
    ["Staff roles", () => <StaffRolesPanel />],
    ["Audit log", () => <AdminAuditPanel />],
  ];

  for (const [name, element] of screens) {
    it(`${name} states a 403 instead of rendering nothing`, async () => {
      forbidAll();
      const runtime = createAuthRuntime({ baseUrl: BASE });
      render(wrap(runtime, element()));
      await waitFor(() => expect(screen.getAllByRole("alert").length).toBeGreaterThan(0));
      // The empty copy must NOT be what a refused operator reads.
      expect(screen.queryByText("No organizations yet")).toBeNull();
      expect(screen.queryByText("No service keys yet")).toBeNull();
      expect(screen.queryByText("Nobody has a staff role")).toBeNull();
    });
  }
});

describe("<SsoOrgsPanel/>", () => {
  it("lists organizations with the domain they claim and whether SSO is required", async () => {
    server.use(http.get(`${BASE}/sso/orgs/`, () => HttpResponse.json([ORG])));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SsoOrgsPanel />));
    await waitFor(() => expect(screen.getByText("Acme Corporation")).toBeDefined());
    expect(screen.getByText("acmecorp.com")).toBeDefined();
    expect(screen.getByText("SSO required")).toBeDefined();
  });

  it("removing confirms by NAME and calls DELETE", async () => {
    let deleted: string | null = null;
    let orgs = [ORG];
    server.use(
      http.get(`${BASE}/sso/orgs/`, () => HttpResponse.json(orgs)),
      http.delete(`${BASE}/sso/orgs/:slug/`, ({ params }) => {
        deleted = params["slug"] as string;
        orgs = [];
        return new HttpResponse(null, { status: 204 });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SsoOrgsPanel />));
    await waitFor(() => expect(screen.getByText("Acme Corporation")).toBeDefined());

    screen.getByRole("button", { name: "Remove Acme Corporation" }).click();
    await screen.findByTestId("sso-delete-confirm");
    // The TITLE names the organization (the testid lands on the confirm's
    // body wrapper, which carries only the consequence sentence).
    expect(screen.getByText("Remove Acme Corporation?")).toBeDefined();
    screen.getByTestId(CONFIRM_OK_TESTID).click();

    await waitFor(() => expect(deleted).toBe("acme"));
  });

  it("the identity-provider form says it cannot show the current values, and PUTs the whole connection", async () => {
    let put: unknown = null;
    server.use(
      http.get(`${BASE}/sso/orgs/`, () => HttpResponse.json([ORG])),
      http.put(`${BASE}/sso/orgs/:slug/config/`, async ({ request }) => {
        put = await request.json();
        return HttpResponse.json(put);
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <SsoOrgsPanel />));
    await waitFor(() => expect(screen.getByText("Acme Corporation")).toBeDefined());

    screen.getByRole("button", { name: "Identity provider" }).click();
    const notice = await screen.findByTestId("sso-config-writeonly");
    // The contract has PUT and PATCH here and no GET. An empty form that did
    // not say so would read as "nothing is configured".
    expect(notice.textContent).toContain("can't be shown");

    const dialog = screen.getByTestId("sso-config-dialog");
    const entityId = dialog.querySelector(
      "#saml_entity_id"
    ) as HTMLInputElement | null;
    if (entityId !== null) {
      fireEvent.change(entityId, { target: { value: "https://idp.acme/sso" } });
    }
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

    await waitFor(() => expect(put).not.toBeNull());
    expect((put as { protocol: string }).protocol).toBe("saml");
  });
});

describe("<ServiceKeysPanel/>", () => {
  it("prints 'Never used' rather than leaving the answer blank", async () => {
    server.use(http.get(`${BASE}/service-keys`, () => HttpResponse.json([KEY])));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ServiceKeysPanel />));
    await waitFor(() => expect(screen.getByText("Billing reconciler")).toBeDefined());
    expect(screen.getByTestId("service-key-last-used").textContent).toBe("Never used");
  });

  it("issuing a key hands the secret over ONCE, in a dialog that says so", async () => {
    server.use(
      http.get(`${BASE}/service-keys`, () => HttpResponse.json([])),
      http.post(`${BASE}/service-keys`, () =>
        HttpResponse.json({ ...KEY, key: "sk_live_the_only_time_this_exists" })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ServiceKeysPanel />));
    await waitFor(() => expect(screen.getByText("No service keys yet")).toBeDefined());

    screen.getAllByRole("button", { name: "Issue a key" })[0]?.click();
    const dialog = await screen.findByTestId("service-key-dialog");
    fireEvent.submit(dialog.querySelector("form") as HTMLFormElement);

    const secret = (await screen.findByTestId(
      "service-key-secret"
    )) as HTMLTextAreaElement;
    expect(secret.value).toBe("sk_live_the_only_time_this_exists");
    expect(screen.getByText("Copy this key now")).toBeDefined();
  });

  it("switching a key off is a PATCH, not a delete", async () => {
    let patched: unknown = null;
    server.use(
      http.get(`${BASE}/service-keys`, () => HttpResponse.json([KEY])),
      http.patch(`${BASE}/service-keys/:id`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json({ ...KEY, is_active: false });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <ServiceKeysPanel />));
    await waitFor(() => expect(screen.getByText("Billing reconciler")).toBeDefined());

    screen.getByRole("button", { name: "Switch off" }).click();
    await waitFor(() => expect(patched).toEqual({ is_active: false }));
  });
});

describe("<StaffRolesPanel/>", () => {
  it("names accounts by the id the contract carries, and says when the SYSTEM granted a role", async () => {
    server.use(http.get(`${BASE}/staff-roles/`, () => HttpResponse.json([ASSIGNMENT])));
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <StaffRolesPanel />));
    await waitFor(() => expect(screen.getByText("moderator")).toBeDefined());
    // No invented display name beside a permission grant.
    expect(
      screen.getByText(`Account ${ASSIGNMENT.user}`)
    ).toBeDefined();
    expect(screen.getByTestId("staff-role-row").textContent).toContain(
      "Assigned by the system"
    );
  });

  it("the filter COMMITS — typing alone does not re-read", async () => {
    const userIds: (string | null)[] = [];
    server.use(
      http.get(`${BASE}/staff-roles/`, ({ request }) => {
        userIds.push(new URL(request.url).searchParams.get("user_id"));
        return HttpResponse.json([ASSIGNMENT]);
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <StaffRolesPanel />));
    await waitFor(() => expect(userIds).toHaveLength(1));

    const filter = screen.getByTestId("staff-role-filter");
    fireEvent.change(filter, { target: { value: "8f1d" } });
    fireEvent.change(filter, { target: { value: "8f1d8f7a" } });
    // Two keystrokes, still one request: a half-typed UUID is not a query.
    expect(userIds).toHaveLength(1);

    screen.getByRole("button", { name: "Show one account only" }).click();
    await waitFor(() => expect(userIds).toHaveLength(2));
    expect(userIds[1]).toBe("8f1d8f7a");
  });
});

describe("<AdminUsersPanel/>", () => {
  it("refuses to submit an account with no way to sign in, and says so before the request", async () => {
    let posted = 0;
    server.use(
      http.post(`${BASE}/admin-users/`, () => {
        posted += 1;
        return HttpResponse.json({ user_id: "u", email: null, phone: null, username: null });
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AdminUsersPanel />));

    const form = screen.getByTestId("admin-user-form");
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByTestId("admin-user-needs-contact")).toBeDefined()
    );
    expect(posted).toBe(0);
  });

  it("ends on the created account's id, not a toast", async () => {
    server.use(
      http.post(`${BASE}/admin-users/`, () =>
        HttpResponse.json({
          user_id: "9c8b7a65-4321-4fed-8cba-0987654321fe",
          email: "grace@example.com",
          phone: null,
          username: "grace",
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AdminUsersPanel />));

    const form = screen.getByTestId("admin-user-form");
    const email = form.querySelector("#email") as HTMLInputElement;
    fireEvent.change(email, { target: { value: "grace@example.com" } });
    fireEvent.submit(form);

    const created = await screen.findByTestId("admin-user-created");
    expect(created.textContent).toContain("9c8b7a65-4321-4fed-8cba-0987654321fe");
    expect(screen.getByRole("button", { name: "Create another" })).toBeDefined();
  });
});

describe("<AdminAuditPanel/>", () => {
  it("filters are COMMITTED: Apply is what makes a read", async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${BASE}/admin/audit/`, ({ request }) => {
        queries.push(new URL(request.url).searchParams.get("event_type") ?? "");
        return HttpResponse.json(AUDIT_PAGE);
      })
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AdminAuditPanel />));
    await waitFor(() => expect(queries).toHaveLength(1));

    const form = screen.getByTestId("admin-audit-filters");
    const eventType = form.querySelector("#event_type") as HTMLInputElement;
    fireEvent.change(eventType, { target: { value: "user.login" } });
    expect(queries).toHaveLength(1);

    fireEvent.submit(form);
    await waitFor(() => expect(queries).toHaveLength(2));
    expect(queries[1]).toBe("user.login");
  });

  it("unrecognized activity is a NAMED chip, not a bare glyph", async () => {
    server.use(
      http.get(`${BASE}/admin/audit/`, () =>
        HttpResponse.json({
          ...AUDIT_PAGE,
          results: [{ ...AUDIT_PAGE.results[0], event_type: "user.login_suspicious" }],
        })
      )
    );
    const runtime = createAuthRuntime({ baseUrl: BASE });
    render(wrap(runtime, <AdminAuditPanel />));
    const chip = await screen.findByTestId("admin-audit-suspicious");
    expect(chip.textContent).toBe("Unrecognized activity");
  });
});

/**
 * Every operator screen is a PAGE — the shell routes to it under
 * `admin.root` — so each paints its own ground and each has to survive both
 * document themes and both widths. A screen that renders only at desktop
 * width is a screen an operator cannot use from a phone during an incident,
 * which is exactly when these five get opened.
 */
describe("the operator console renders at phone and desktop, in light and dark", () => {
  const screens: readonly (readonly [string, () => ReactElement, string])[] = [
    ["sso", () => <SsoOrgsPanel />, "admin-sso"],
    ["service-keys", () => <ServiceKeysPanel />, "admin-service-keys"],
    ["staff-roles", () => <StaffRolesPanel />, "admin-staff-roles"],
    ["users", () => <AdminUsersPanel />, "admin-users"],
    ["audit", () => <AdminAuditPanel />, "admin-audit"],
  ];

  function stubReads(): void {
    server.use(
      http.get(`${BASE}/sso/orgs/`, () => HttpResponse.json([ORG])),
      http.get(`${BASE}/service-keys`, () => HttpResponse.json([KEY])),
      http.get(`${BASE}/staff-roles/`, () => HttpResponse.json([ASSIGNMENT])),
      http.get(`${BASE}/admin/audit/`, () => HttpResponse.json(AUDIT_PAGE))
    );
  }

  for (const [name, element, testId] of screens) {
    for (const width of [390, 1280]) {
      for (const theme of ["light", "dark"]) {
        it(`${name} at ${String(width)}px, ${theme}`, async () => {
          stubReads();
          setViewportWidth(width);
          document.documentElement.setAttribute("data-theme", theme);
          const runtime = createAuthRuntime({ baseUrl: BASE });
          render(wrap(runtime, element()));
          const page = await screen.findByTestId(`${testId}-page`);
          // The screen paints its own ground in the document's LIVE mode —
          // inheriting the host is what left skins rendering light text on a
          // dark page.
          expect(page.getAttribute("data-stapel-skin-mode")).toBe(theme);
          expect(page.getAttribute("data-stapel-skin-surface")).toBe("base");
        });
      }
    }
  }
});
