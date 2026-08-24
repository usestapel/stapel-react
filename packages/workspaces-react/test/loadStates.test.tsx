/**
 * THE INCIDENT, AS A TEST.
 *
 * 2026-08-09, app.ironmemo.com: the workspace-list route was mounted one path
 * segment too deep, so `GET /workspaces/api/v1/` answered 404 to every
 * request. Every screen built on this pair said "you have no workspaces" and
 * greyed out the upload button, for hours, while the network tab showed the
 * outage.
 *
 * These tests assert WHAT A PERSON SEES in each of the three states, not that
 * a prop exists. The load-bearing assertion in each failure case is the
 * negative one: the failed screen must NOT carry the empty copy. A test that
 * only checked `state.status === "failed"` would have passed against the
 * broken build too, because the broken build's problem was never that the
 * information was wrong — it was that the screen said something else.
 *
 * The wire is mocked, not the module (CONTRIBUTING, "Mock the wire, not the
 * module"): a real 404 `Response` through the real transport. A hand-shaped
 * `{status: 404}` object would reproduce the very assumption under test.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n, matchList } from "@stapel/core";
import type { Repository } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import {
  WorkspaceSelectionProvider,
  useWorkspaceSelection,
} from "../src/model/selection.js";
import { registerWorkspacesI18n } from "../src/i18n/keys.js";
import { MembersManager } from "../src/default/MembersManager.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
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

const ROLES = {
  roles: [{ role: "owner", rank: 400, capabilities: ["*"], builtin: true }],
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** The wire shape a mis-mounted Django route actually returns: an HTML 404
 * page, no error envelope — which is what makes `stapel.http.404` the code. */
function notFoundHtml(): HttpResponse {
  return new HttpResponse("<h1>Not Found</h1>", {
    status: 404,
    headers: { "Content-Type": "text/html" },
  });
}

function memoryRepo(): Repository<string> {
  const store = new Map<string, string>();
  return {
    get: (key) => Promise.resolve(store.get(key)),
    set: (key, value) => {
      store.set(key, value);
      return Promise.resolve();
    },
    del: (key) => {
      store.delete(key);
      return Promise.resolve();
    },
    keys: () => Promise.resolve([...store.keys()]),
    clear: () => {
      store.clear();
      return Promise.resolve();
    },
  };
}

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

// ── the selection surface the product consumes ──────────────────────────────

/** A minimal host, written the way a host is now FORCED to write one: the
 * rows are unreachable without answering for the other three states. */
function SelectionScreen(): ReactElement {
  const selection = useWorkspaceSelection();
  return (
    <div data-testid="screen">
      {matchList(selection.state, {
        loading: () => <span>Loading your workspaces…</span>,
        failed: () => <span>We could not load your workspaces.</span>,
        empty: () => <span>You have no workspaces.</span>,
        ready: (workspaces) => <span>{workspaces.length} workspace(s)</span>,
      })}
    </div>
  );
}

function renderSelection(): void {
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
  render(
    wrap(
      runtime,
      <WorkspaceSelectionProvider repository={memoryRepo()}>
        <SelectionScreen />
      </WorkspaceSelectionProvider>
    )
  );
}

describe("useWorkspaceSelection — the three states a person can be in", () => {
  it("LOADING: says it is loading, and does not claim the person has none", async () => {
    server.use(
      http.get(`${BASE}/`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10_000));
        return HttpResponse.json({ workspaces: [] });
      })
    );
    renderSelection();
    await waitFor(() =>
      expect(screen.getByTestId("screen").textContent).toBe(
        "Loading your workspaces…"
      )
    );
  });

  it("EMPTY: says the person has none — the one case where that is true", async () => {
    server.use(
      http.get(`${BASE}/`, () => HttpResponse.json({ workspaces: [] }))
    );
    renderSelection();
    await waitFor(() =>
      expect(screen.getByTestId("screen").textContent).toBe(
        "You have no workspaces."
      )
    );
  });

  it("FAILED: says the load failed, and never that the person has none", async () => {
    server.use(http.get(`${BASE}/`, () => notFoundHtml()));
    renderSelection();
    await waitFor(() =>
      expect(screen.getByTestId("screen").textContent).toBe(
        "We could not load your workspaces."
      )
    );
    // The assertion the 2026-08-09 build would have failed.
    expect(screen.queryByText("You have no workspaces.")).toBeNull();
  });

  it("FAILED: exposes the failure on the bag, which it previously could not at all", async () => {
    server.use(http.get(`${BASE}/`, () => notFoundHtml()));
    let seen: ReturnType<typeof useWorkspaceSelection> | null = null;
    function Probe(): ReactElement {
      seen = useWorkspaceSelection();
      return <span data-testid="probe">{seen.state.status}</span>;
    }
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(
      wrap(
        runtime,
        <WorkspaceSelectionProvider repository={memoryRepo()}>
          <Probe />
        </WorkspaceSelectionProvider>
      )
    );
    await waitFor(() =>
      expect(screen.getByTestId("probe").textContent).toBe("failed")
    );
    const selection = seen as unknown as ReturnType<typeof useWorkspaceSelection>;
    expect(selection.current).toBeNull();
    // `current: null` alone is what the old shape offered, and it is exactly
    // as true for a person with no workspaces. The status is what separates
    // them.
    expect(selection.state.status).toBe("failed");
  });
});

// ── the default skin that renders a list ────────────────────────────────────

describe("<MembersManager/> — the roster's three states on screen", () => {
  function renderManager(): void {
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <MembersManager workspaceId={WS} />));
  }

  it("EMPTY: renders the empty copy for a roster that really is empty", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json({
          items: [],
          next_anchor: null,
          prev_anchor: null,
          has_next: false,
          has_prev: false,
          count: 0,
        })
      )
    );
    renderManager();
    await waitFor(() =>
      expect(screen.getByTestId("members-list-empty")).toBeDefined()
    );
    expect(screen.getByText("No members yet.")).toBeDefined();
    expect(screen.queryByTestId("members-list-failed")).toBeNull();
  });

  it("READY: renders the rows", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json({
          items: [MEMBER],
          next_anchor: null,
          prev_anchor: null,
          has_next: false,
          has_prev: false,
          count: 1,
        })
      )
    );
    renderManager();
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    expect(screen.queryByTestId("members-list-empty")).toBeNull();
    expect(screen.queryByTestId("members-list-failed")).toBeNull();
  });

  it("FAILED: states the failure, offers a retry, and shows NO empty state", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => HttpResponse.json(ROLES)),
      http.get(`${BASE}/${WS}/members`, () => notFoundHtml())
    );
    renderManager();
    await waitFor(() =>
      expect(screen.getByTestId("members-list-failed")).toBeDefined()
    );
    expect(screen.getByText("Try again")).toBeDefined();
    // The shared `LoadList` renders exactly one arm: a failed read never
    // reaches the empty arm, so the "you have none" lie is unspellable.
    expect(screen.queryByTestId("members-list-empty")).toBeNull();
    expect(screen.queryByText("No members yet.")).toBeNull();
    expect(screen.queryByText("No data")).toBeNull();
  });

  it("FAILED role registry: says WE failed, and the roster read is untouched", async () => {
    server.use(
      http.get(`${BASE}/roles`, () => notFoundHtml()),
      http.get(`${BASE}/${WS}/members`, () =>
        HttpResponse.json({
          items: [MEMBER],
          next_anchor: null,
          prev_anchor: null,
          has_next: false,
          has_prev: false,
          count: 1,
        })
      )
    );
    renderManager();
    // Two independent reads, two independent sentences: the roster loaded, and
    // the registry failure is stated beside the control it disables — the row's
    // role picker, which is not rendered as an enabled `<Select options={[]}/>`.
    await waitFor(() => expect(screen.getByText("owner@example.com")).toBeDefined());
    await waitFor(() =>
      expect(
        screen.getByTestId(`member-role-${MEMBER.user_id}-blocked`).textContent
      ).toContain("We could not load the role list")
    );
    expect(screen.queryByTestId("members-list-failed")).toBeNull();
  });
});

// ── a disabled control states its reason ────────────────────────────────────

describe("<WorkspaceSettings/> — a switched-off control says why", () => {
  it("names the permission that blocks the save, as readable text", async () => {
    const { WorkspaceSettings } = await import("../src/default/WorkspaceSettings.js");
    server.use(
      http.get(`${BASE}/${WS}`, () =>
        HttpResponse.json({ ...WORKSPACE, my_role: "member" })
      )
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <WorkspaceSettings workspaceId={WS} />));
    // The gate is the SHARED `GatedButton`: the reason is a real text node
    // beside the control, stamped `data-stapel-gated-reason` and pointed at by
    // the button's `aria-describedby` — not a `title` a disabled button can
    // never surface.
    await waitFor(() =>
      expect(screen.getByTestId("workspace-save-gate")).toBeDefined()
    );
    expect(
      screen
        .getByTestId("workspace-save-gate")
        .querySelector("[data-stapel-gated-reason]")?.textContent
    ).toBe("Your role cannot change this workspace's settings.");
    // The field itself states the same block, in its own gate.
    expect(
      screen
        .getByTestId("workspace-name-field")
        .querySelector("[data-stapel-gated-reason]")
    ).not.toBeNull();
  });

  it("names the empty name field once the person IS the owner", async () => {
    const { WorkspaceSettings } = await import("../src/default/WorkspaceSettings.js");
    server.use(
      http.get(`${BASE}/${WS}`, () => HttpResponse.json({ ...WORKSPACE, name: "  " }))
    );
    const runtime = createWorkspacesRuntime({ baseUrl: BASE });
    render(wrap(runtime, <WorkspaceSettings workspaceId={WS} />));
    await waitFor(() =>
      expect(
        screen
          .getByTestId("workspace-save-gate")
          .querySelector("[data-stapel-gated-reason]")?.textContent
      ).toBe("Enter a workspace name.")
    );
  });
});
