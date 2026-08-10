/**
 * Which workspace am I in — the resolution, and the two properties that are
 * easy to write down and easy to break.
 *
 * The fleet has already paid for getting this wrong once: every client
 * invented `workspaces[0]`, the list is ordered by `-last_accessed_at`, and
 * the owner's pending invitations therefore sat in the org workspace while his
 * screen showed his personal one (#239). These tests pin the chain that
 * replaces the guess, and the multi-tab rule that a naive localStorage wiring
 * silently destroys.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import type { Repository } from "@stapel/core";
import { createWorkspacesRuntime } from "../src/model/runtime.js";
import type { WorkspacesRuntime } from "../src/model/runtime.js";
import { WorkspacesProvider } from "../src/headless/WorkspacesProvider.js";
import {
  WorkspaceSelectionProvider,
  useWorkspaceSelection,
} from "../src/model/selection.js";
import type { WorkspaceSelectionUrlBinding } from "../src/model/selection.js";

const BASE = "https://workspaces.stapel.test/workspaces/api/v1";

const PERSONAL = "0192f000-0000-4000-8000-00000000000a";
const ORG = "0192f000-0000-4000-8000-00000000000b";
const THIRD = "0192f000-0000-4000-8000-00000000000c";
const STRANGER = "0192f000-0000-4000-8000-0000000000ff";

function workspace(id: string, name: string, type: string) {
  return {
    id,
    name,
    slug: name.toLowerCase(),
    type,
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

/** Ordered the way the backend orders it: most recently accessed FIRST. That
 * ordering is exactly why position is not a choice — ORG leads here. */
const LIST = {
  workspaces: [
    workspace(ORG, "Org", "work"),
    workspace(PERSONAL, "Personal", "personal"),
    workspace(THIRD, "Third", "work"),
  ],
  is_guest: false,
  default_workspace_id: "",
  preferred_workspace_id: "",
};

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** An in-memory stand-in for core's encrypted repository — the seam the
 * provider takes so a test does not need a SessionManager. */
function memoryRepo(seed?: string): Repository<string> & { store: Map<string, string> } {
  const store = new Map<string, string>();
  if (seed) store.set("selected", seed);
  return {
    store,
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

function serveList(body: unknown = LIST) {
  server.use(http.get(`${BASE}/`, () => HttpResponse.json(body)));
}

function wrap(
  runtime: WorkspacesRuntime,
  children: ReactNode,
  binding: WorkspaceSelectionUrlBinding & {
    repository?: Repository<string> | null;
  }
): ReactElement {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <WorkspacesProvider runtime={runtime}>
        <WorkspaceSelectionProvider {...binding}>
          {children}
        </WorkspaceSelectionProvider>
      </WorkspacesProvider>
    </QueryClientProvider>
  );
}

function mount(
  binding: WorkspaceSelectionUrlBinding & {
    repository?: Repository<string> | null;
  } = {}
) {
  const runtime = createWorkspacesRuntime({ baseUrl: BASE });
  return renderHook(() => useWorkspaceSelection(), {
    wrapper: ({ children }) => wrap(runtime, children, binding),
  });
}

describe("the resolution chain", () => {
  it("prefers the URL over everything else", async () => {
    serveList({ ...LIST, preferred_workspace_id: PERSONAL, default_workspace_id: ORG });
    const { result } = mount({
      urlWorkspaceId: THIRD,
      repository: memoryRepo(ORG),
    });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(result.current.source).toBe("url");
  });

  it("falls to local storage when the URL names nothing", async () => {
    serveList({ ...LIST, preferred_workspace_id: PERSONAL });
    const { result } = mount({ repository: memoryRepo(THIRD) });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(result.current.source).toBe("local");
  });

  it("falls to the backend preference when this device has no history", async () => {
    serveList({ ...LIST, preferred_workspace_id: THIRD, default_workspace_id: ORG });
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(result.current.source).toBe("preference");
  });

  it("falls to the instance default when the person has stated no choice", async () => {
    serveList({ ...LIST, default_workspace_id: THIRD });
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(result.current.source).toBe("instance-default");
  });

  it("falls to the personal workspace, NOT the first row — this is #239", async () => {
    // The list leads with ORG because it is ordered by last access. A client
    // taking position would land there; the whole defect was that this is not
    // a choice, it is "wherever you happened to be last".
    serveList();
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.current?.id).toBe(PERSONAL));
    expect(result.current.source).toBe("personal");
    expect(LIST.workspaces[0].id).toBe(ORG); // the trap itself, stated
  });

  it("uses the first row only when nothing else can answer", async () => {
    serveList({
      workspaces: [workspace(ORG, "Org", "work"), workspace(THIRD, "Third", "work")],
      is_guest: false,
      default_workspace_id: "",
      preferred_workspace_id: "",
    });
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.current?.id).toBe(ORG));
    expect(result.current.source).toBe("positional");
  });

  it("resolves to nothing, without crashing, for someone in no workspace", async () => {
    serveList({
      workspaces: [],
      is_guest: true,
      default_workspace_id: "",
      preferred_workspace_id: "",
    });
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));
    expect(result.current.current).toBeNull();
    expect(result.current.source).toBeNull();
  });

  it("never resolves against an unfetched list", async () => {
    serveList();
    const { result } = mount({ urlWorkspaceId: ORG, repository: memoryRepo() });
    // The id is known synchronously from the URL; the membership check is not.
    expect(result.current.current).toBeNull();
    await waitFor(() => expect(result.current.current?.id).toBe(ORG));
  });
});

describe("a URL that names a workspace the person cannot open", () => {
  it("lands them somewhere sane and says so, instead of a blank screen", async () => {
    serveList();
    const onUrlWorkspaceChange = vi.fn();
    const { result } = mount({
      urlWorkspaceId: STRANGER,
      onUrlWorkspaceChange,
      repository: memoryRepo(),
    });
    await waitFor(() => expect(result.current.current?.id).toBe(PERSONAL));
    expect(result.current.urlWorkspaceInvalid).toBe(true);
    expect(result.current.current).not.toBeNull();
  });

  it("corrects the address bar with a REPLACE, so back cannot return to it", async () => {
    serveList();
    const onUrlWorkspaceChange = vi.fn();
    mount({ urlWorkspaceId: STRANGER, onUrlWorkspaceChange, repository: memoryRepo() });
    await waitFor(() => expect(onUrlWorkspaceChange).toHaveBeenCalled());
    expect(onUrlWorkspaceChange).toHaveBeenCalledWith(PERSONAL, {
      reason: "invalid-url",
      history: "replace",
    });
  });

  it("writes nothing anywhere — a bad id must not become a stored default", async () => {
    serveList();
    const repo = memoryRepo();
    const put = vi.fn(() => HttpResponse.json({ preferred_workspace_id: "" }));
    server.use(http.put(`${BASE}/me/preferred-workspace`, put));
    const { result } = mount({ urlWorkspaceId: STRANGER, repository: repo });
    await waitFor(() => expect(result.current.urlWorkspaceInvalid).toBe(true));
    expect(repo.store.size).toBe(0);
    expect(put).not.toHaveBeenCalled();
  });

  it("corrects once, not in a loop", async () => {
    serveList();
    const onUrlWorkspaceChange = vi.fn();
    const { rerender } = mount({
      urlWorkspaceId: STRANGER,
      onUrlWorkspaceChange,
      repository: memoryRepo(),
    });
    await waitFor(() => expect(onUrlWorkspaceChange).toHaveBeenCalledTimes(1));
    rerender();
    rerender();
    expect(onUrlWorkspaceChange).toHaveBeenCalledTimes(1);
  });
});

describe("the write policy — context versus choice", () => {
  it("an explicit switch writes all three layers", async () => {
    serveList();
    const repo = memoryRepo();
    const bodies: unknown[] = [];
    server.use(
      http.put(`${BASE}/me/preferred-workspace`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ preferred_workspace_id: THIRD });
      })
    );
    const onUrlWorkspaceChange = vi.fn();
    const { result } = mount({ onUrlWorkspaceChange, repository: repo });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));

    act(() => {
      result.current.switchTo(THIRD);
    });

    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(onUrlWorkspaceChange).toHaveBeenCalledWith(THIRD, {
      reason: "switch",
      history: "push",
    });
    await waitFor(() => expect(repo.store.get("selected")).toBe(THIRD));
    await waitFor(() => expect(bodies).toEqual([{ workspace_id: THIRD }]));
  });

  it("resolving from a shared link writes NOTHING — one link must not repoint a home", async () => {
    serveList();
    const repo = memoryRepo();
    const put = vi.fn(() => HttpResponse.json({ preferred_workspace_id: "" }));
    server.use(http.put(`${BASE}/me/preferred-workspace`, put));
    const { result } = mount({ urlWorkspaceId: THIRD, repository: repo });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(repo.store.size).toBe(0);
    expect(put).not.toHaveBeenCalled();
  });

  it("does not block the switch on the backend write", async () => {
    serveList();
    server.use(
      http.put(`${BASE}/me/preferred-workspace`, () =>
        HttpResponse.json({ error: "boom" }, { status: 500 })
      )
    );
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));
    act(() => {
      result.current.switchTo(THIRD);
    });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
  });

  it("refuses to switch to a workspace the person is not in", async () => {
    serveList();
    const repo = memoryRepo();
    const { result } = mount({ repository: repo });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));
    const before = result.current.current?.id;
    act(() => {
      result.current.switchTo(STRANGER);
    });
    expect(result.current.current?.id).toBe(before);
    expect(repo.store.size).toBe(0);
  });

  it("DELETES a stale stored pointer rather than rewriting it to the fallback", async () => {
    // Ossifying a guess would let it outrank a later-corrected backend
    // preference or instance default.
    serveList();
    const repo = memoryRepo(STRANGER);
    const { result } = mount({ repository: repo });
    await waitFor(() => expect(result.current.current?.id).toBe(PERSONAL));
    await waitFor(() => expect(repo.store.has("selected")).toBe(false));
  });
});

describe("multi-tab independence", () => {
  it("switching in one tab does not move another", async () => {
    serveList();
    server.use(
      http.put(`${BASE}/me/preferred-workspace`, () =>
        HttpResponse.json({ preferred_workspace_id: THIRD })
      )
    );
    // Two tabs = two providers over ONE shared storage, which is exactly the
    // real situation. Tab B's identity comes from its URL.
    const shared = memoryRepo();
    const tabA = mount({ repository: shared });
    const tabB = mount({ urlWorkspaceId: ORG, repository: shared });

    await waitFor(() => expect(tabB.result.current.current?.id).toBe(ORG));
    await waitFor(() => expect(tabA.result.current.state.status).not.toBe("loading"));

    act(() => {
      tabA.result.current.switchTo(THIRD);
    });

    await waitFor(() => expect(tabA.result.current.current?.id).toBe(THIRD));
    // The shared store now says THIRD. Tab B must not care: it is read once
    // at boot and never subscribed to.
    await waitFor(() => expect(shared.store.get("selected")).toBe(THIRD));
    expect(tabB.result.current.current?.id).toBe(ORG);
  });

  it("does not subscribe to storage events at all", async () => {
    serveList();
    const spy = vi.spyOn(window, "addEventListener");
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));
    const storageListeners = spy.mock.calls.filter(([type]) => type === "storage");
    expect(storageListeners).toEqual([]);
    spy.mockRestore();
  });
});

describe("host wiring", () => {
  it("runs without a URL binding at all", async () => {
    serveList({ ...LIST, preferred_workspace_id: THIRD });
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
  });

  it("runs with no local layer at all", async () => {
    serveList({ ...LIST, preferred_workspace_id: THIRD });
    const { result } = mount({ repository: null });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
  });

  it("throws outside the provider rather than reading as 'no workspace yet'", () => {
    expect(() => renderHook(() => useWorkspaceSelection())).toThrow(
      /WorkspaceSelectionProvider/
    );
  });
});

describe("value identity (#251)", () => {
  // Consumers put `current` straight into useEffect dependency arrays. A bag
  // that changes identity every render re-runs those effects every render, and
  // when the effect also sets state that is an unbounded render loop whose only
  // symptom is a spinner that never resolves, with nothing in the console.
  it("keeps the bag and its fields stable across renders when nothing changed", async () => {
    serveList();
    const { result, rerender } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));

    const before = result.current;
    rerender();
    rerender();

    expect(result.current).toBe(before);
    expect(result.current.state).toBe(before.state);
    expect(result.current.current).toBe(before.current);
    expect(result.current.refetch).toBe(before.refetch);
    expect(result.current.switchTo).toBe(before.switchTo);
  });

  it("CHANGES identity when the workspace actually switches", async () => {
    serveList();
    server.use(
      http.put(`${BASE}/me/preferred-workspace`, () =>
        HttpResponse.json({ preferred_workspace_id: THIRD })
      )
    );
    const { result } = mount({ repository: memoryRepo() });
    await waitFor(() => expect(result.current.state.status).not.toBe("loading"));
    const before = result.current;
    act(() => {
      result.current.switchTo(THIRD);
    });
    await waitFor(() => expect(result.current.current?.id).toBe(THIRD));
    expect(result.current).not.toBe(before);
  });
});

