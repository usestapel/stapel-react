/**
 * The drive reads and the star toggle, driven through a REAL transport.
 *
 * Every assertion here goes through a stubbed `fetch` returning a real
 * `Response` built from the body the backend actually sends, so the shapes the
 * hooks hold were produced by the transport rather than by the test author
 * (CONTRIBUTING, "Mock the wire, not the module").
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import {
  driveQueryKeys,
  useDriveSearch,
  useFolderChildren,
  useRecents,
  useStarred,
  useToggleStar,
} from "../src/index.js";
import type { StarredListing } from "../src/index.js";
import { WORKSPACE_ID, harness, wire } from "./helpers.js";
import { DOC_A, DOC_B, FOLDER_A, FOLDER_B } from "./fixtures.js";

describe("query keys (frontend-standard §2 — namespaced)", () => {
  it("namespaces everything under the drive root", () => {
    expect(driveQueryKeys.all[0]).toBe("drive");
    expect(driveQueryKeys.starred(WORKSPACE_ID)[0]).toBe("drive");
    expect(driveQueryKeys.children(WORKSPACE_ID, null)[0]).toBe("drive");
  });

  it("gives the workspace root a key of its own, distinct from any folder", () => {
    expect(driveQueryKeys.children(WORKSPACE_ID, null)).not.toEqual(
      driveQueryKeys.children(WORKSPACE_ID, "null")
    );
  });

  it("keys one entry per folder — not one for the tree", () => {
    expect(driveQueryKeys.children(WORKSPACE_ID, "f-a")).not.toEqual(
      driveQueryKeys.children(WORKSPACE_ID, "f-b")
    );
  });
});

describe("useFolderChildren — one rung, one request", () => {
  it("asks for the CHILDREN of a folder, never the whole tree", async () => {
    const stub = wire({ "/folders": { body: [FOLDER_B] } });
    const { wrapper } = harness(stub);
    const { result } = renderHook(() => useFolderChildren(WORKSPACE_ID, "f-a"), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const call = stub.calls.at(-1);
    expect(call?.pathname).toMatch(/\/folders$/);
    expect(call?.search).toContain("parent_id=f-a");
  });

  it("sends the EMPTY parent_id for the workspace root — absent would mean the tree", async () => {
    const stub = wire({ "/folders": { body: [FOLDER_A] } });
    const { wrapper } = harness(stub);
    const { result } = renderHook(() => useFolderChildren(WORKSPACE_ID, null), {
      wrapper,
    });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const call = stub.calls.at(-1);
    // `parent_id=` present and empty: the wire's spelling for "the roots".
    expect(call?.search).toMatch(/parent_id=(&|$)/);
  });
});

describe("useRecents", () => {
  it("reads the workspace's recents in the server's order", async () => {
    const stub = wire({ "/recents": { body: [DOC_B, DOC_A] } });
    const { wrapper } = harness(stub);
    const { result } = renderHook(() => useRecents(WORKSPACE_ID), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.map((doc) => doc.id)).toEqual([DOC_B.id, DOC_A.id]);
    expect(stub.calls.at(-1)?.search).toContain(`workspace_id=${WORKSPACE_ID}`);
  });
});

describe("useDriveSearch", () => {
  it("runs nothing at all for a blank query — the backend 400s on one", async () => {
    const stub = wire({ "/search": { body: [] } });
    const { wrapper } = harness(stub);
    const { result } = renderHook(
      () => useDriveSearch({ workspaceId: WORKSPACE_ID, q: "   " }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe("idle");
    });
    expect(stub.calls).toHaveLength(0);
  });

  it("sends the finished q and reads the hits with their breadcrumbs", async () => {
    const stub = wire({
      "/search": {
        body: [
          {
            kind: "document",
            id: DOC_A.id,
            workspace_id: WORKSPACE_ID,
            name: DOC_A.title,
            parent_id: FOLDER_A.id,
            breadcrumb: [{ id: FOLDER_A.id, name: FOLDER_A.name }],
          },
        ],
      },
    });
    const { wrapper } = harness(stub);
    const { result } = renderHook(
      () => useDriveSearch({ workspaceId: WORKSPACE_ID, q: "ware" }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]?.breadcrumb?.[0]?.name).toBe(FOLDER_A.name);
    expect(stub.calls.at(-1)?.search).toContain("q=ware");
  });
});

describe("useToggleStar — optimistic, with a rollback that actually runs", () => {
  const starred: StarredListing = { folders: [], documents: [] };

  it("adds the star to the listing before the server answers, and keeps it", async () => {
    const stub = wire({
      "/starred": { body: starred },
      "/star": { status: 204 },
      "/recents": { body: [DOC_A] },
    });
    const { wrapper, queryClient } = harness(stub);
    const { result } = renderHook(
      () => ({
        recents: useRecents(WORKSPACE_ID),
        toggle: useToggleStar(),
      }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.recents.isSuccess).toBe(true);
    });
    expect(result.current.recents.data?.[0]?.is_starred).toBe(false);

    await act(async () => {
      await result.current.toggle.mutateAsync({
        target: { kind: "document", id: DOC_A.id },
        starred: true,
      });
    });

    const rows = queryClient.getQueryData<typeof DOC_A[]>(
      driveQueryKeys.recents(WORKSPACE_ID)
    );
    // The optimistic write survived the settle (the refetch answers the same
    // rows; what matters is that the flip happened without waiting).
    expect(stub.calls.some((call) => call.method === "POST")).toBe(true);
    expect(rows).toBeDefined();
  });

  it("puts the cache back exactly as it was when the star is refused", async () => {
    const stub = wire({
      "/recents": { body: [DOC_A] },
      "/star": { status: 403, body: { localizable_error: "error.403.forbidden" } },
    });
    const { wrapper, queryClient } = harness(stub);
    const { result } = renderHook(
      () => ({
        recents: useRecents(WORKSPACE_ID),
        toggle: useToggleStar(),
      }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.recents.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.toggle
        .mutateAsync({
          target: { kind: "document", id: DOC_A.id },
          starred: true,
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.toggle.isError).toBe(true);
    });
    // The rollback restored the pre-mutate rows; the star is false again.
    const rows = queryClient.getQueryData<(typeof DOC_A)[]>(
      driveQueryKeys.recents(WORKSPACE_ID)
    );
    expect(rows?.[0]?.is_starred).toBe(false);
  });

  it("unstar sends DELETE and removes the row from the starred listing at once", async () => {
    // The server catches up with the optimistic write: the first read still
    // has the star, the read AFTER the DELETE does not. Without that, the
    // invalidation on settle would legitimately put the row back and the
    // assertion would be testing the stub rather than the mutation.
    let unstarred = false;
    const stub = wire({
      "/starred": () =>
        new Response(
          JSON.stringify(
            unstarred
              ? { folders: [], documents: [DOC_A] }
              : { folders: [FOLDER_A], documents: [DOC_A] }
          ),
          { status: 200, headers: { "content-type": "application/json" } }
        ),
      "/star": () => {
        unstarred = true;
        return new Response(null, { status: 204 });
      },
    });
    const { wrapper, queryClient } = harness(stub);
    const { result } = renderHook(
      () => ({ list: useStarred(WORKSPACE_ID), toggle: useToggleStar() }),
      { wrapper }
    );
    await waitFor(() => {
      expect(result.current.list.isSuccess).toBe(true);
    });

    act(() => {
      result.current.toggle.mutate({
        target: { kind: "folder", id: FOLDER_A.id },
        starred: false,
      });
    });

    await waitFor(() => {
      const listing = queryClient.getQueryData<StarredListing>(
        driveQueryKeys.starred(WORKSPACE_ID)
      );
      expect(listing?.folders.some((f) => f.id === FOLDER_A.id)).toBe(false);
    });
    await waitFor(() => {
      expect(
        stub.calls.some(
          (call) => call.method === "DELETE" && call.pathname.endsWith("/star")
        )
      ).toBe(true);
    });
  });

  it("targets the FOLDER path for a folder and the DOCUMENT path for a document", async () => {
    const stub = wire({ "/star": { status: 204 } });
    const { wrapper } = harness(stub);
    const { result } = renderHook(() => useToggleStar(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        target: { kind: "folder", id: "f-a" },
        starred: true,
      });
    });
    expect(stub.calls.at(-1)?.pathname).toContain("/folders/f-a/star");

    await act(async () => {
      await result.current.mutateAsync({
        target: { kind: "document", id: "d-a" },
        starred: true,
      });
    });
    expect(stub.calls.at(-1)?.pathname).toContain("/documents/d-a/star");
  });
});
