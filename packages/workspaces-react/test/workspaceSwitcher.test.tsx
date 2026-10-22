/**
 * `<WorkspaceSwitcher/>` — the `workspaces.switcher` embed. What a shell
 * relies on: it reflects and moves the ONE selection the workspace screens
 * read, a failed list is a retry and not an empty select, and with nothing to
 * switch between (or no selection wired) it draws nothing.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { I18nProvider, createI18n } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import {
  WorkspaceSelectionProvider,
  useWorkspaceSelection,
} from "../src/model/selection.js";
import { registerWorkspacesI18n } from "../src/i18n/keys.js";
import { WorkspaceSwitcher } from "../src/default/index.js";
import { navEmbeds } from "../src/nav/manifest.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";
const ORG = "0192f000-0000-4000-8000-00000000000b";
const PERSONAL = "0192f000-0000-4000-8000-00000000000a";

function workspace(id: string, name: string) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
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

const LIST = {
  workspaces: [workspace(ORG, "Org"), workspace(PERSONAL, "Personal")],
  is_guest: false,
  default_workspace_id: "",
  preferred_workspace_id: ORG,
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

/** Prints the selection the workspace screens read, beside the switcher. */
function Current(): ReactElement {
  const { current } = useWorkspaceSelection();
  return <output data-testid="current">{current?.name ?? ""}</output>;
}

function wrap(children: ReactNode, withSelection = true): ReactElement {
  const i18n = createI18n({ locale: "en" });
  registerWorkspacesI18n(i18n);
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider i18n={i18n}>
        <WorkspacesProvider runtime={runtime}>
          {withSelection ? (
            <WorkspaceSelectionProvider repository={null}>
              {children}
              <Current />
            </WorkspaceSelectionProvider>
          ) : (
            children
          )}
        </WorkspacesProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

describe("<WorkspaceSwitcher/>", () => {
  it("shows the active workspace and moves the shared selection on switch", async () => {
    server.use(http.get(`${BASE}/`, () => HttpResponse.json(LIST)));
    const put = vi.fn(() => HttpResponse.json({ preferred_workspace_id: PERSONAL }));
    server.use(http.put(`${BASE}/me/preferred-workspace`, put));
    const onSwitched = vi.fn();
    render(wrap(<WorkspaceSwitcher onSwitched={onSwitched} />));

    await waitFor(() =>
      expect(screen.getByTestId("workspace-switcher").getAttribute("data-state")).toBe("ready")
    );
    await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("Org"));
    expect(screen.getByLabelText("Active workspace")).toBeDefined();

    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(await screen.findByTitle("Personal"));

    await waitFor(() => expect(screen.getByTestId("current").textContent).toBe("Personal"));
    expect(onSwitched).toHaveBeenCalledWith(expect.objectContaining({ id: PERSONAL }));
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
  });

  it("a failed list is a retry, not an empty select", async () => {
    let calls = 0;
    server.use(
      http.get(`${BASE}/`, () => {
        calls += 1;
        return calls === 1
          ? HttpResponse.json({ detail: "down" }, { status: 503 })
          : HttpResponse.json(LIST);
      })
    );
    render(wrap(<WorkspaceSwitcher />));
    const retry = await screen.findByTestId("workspace-switcher-retry");
    expect(retry.textContent).toContain("could not be loaded");
    expect(screen.queryByTestId("workspace-switcher")).toBeNull();

    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByTestId("workspace-switcher").getAttribute("data-state")).toBe("ready")
    );
  });

  it("draws nothing when the person belongs to no workspace", async () => {
    server.use(
      http.get(`${BASE}/`, () =>
        HttpResponse.json({ ...LIST, workspaces: [], preferred_workspace_id: "" })
      )
    );
    render(wrap(<WorkspaceSwitcher />));
    await waitFor(() => expect(screen.queryByTestId("workspace-switcher")).toBeNull());
    expect(screen.queryByTestId("workspace-switcher-retry")).toBeNull();
  });

  it("draws nothing without a selection provider", () => {
    const { container } = render(wrap(<WorkspaceSwitcher />, false));
    expect(container.textContent).toBe("");
  });

  it("is declared as a member embed right after the brand", () => {
    expect(navEmbeds).toEqual([
      {
        id: "workspaces.switcher",
        slot: "topbar.start",
        component: { export: "WorkspaceSwitcher", subpath: "default" },
        order: 10,
        surface: "member",
      },
    ]);
  });
});
