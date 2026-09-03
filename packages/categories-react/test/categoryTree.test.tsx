/**
 * `useCategoryTree` — the mega-menu's one read.
 *
 * What is worth asserting is the WIRE and the CACHE: that the depth reaches
 * the server as a query parameter, that two depths are two cache entries (a
 * menu that asked for three levels must not be served the two a sibling
 * cached), and that the nested shape survives the round trip — the tree
 * endpoint is the only one in this contract that sends children inline.
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { categoriesQueryKeys, useCategoryTree } from "../src/index.js";
import { TestProviders, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { TREE, TREE_TRANSPORT } from "./fixtures.js";

const OK = { "/tree/": { body: TREE } };

function wrapperFor(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactElement {
    return <TestProviders server={server}>{props.children}</TestProviders>;
  };
}

describe("useCategoryTree", () => {
  it("asks for three levels by default, and says so on the wire", async () => {
    const server = mockServer(OK);
    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: wrapperFor(server),
    });
    await waitFor(() => {
      expect(result.current.data).toBeTruthy();
    });
    expect(server.lastQuery("/tree/")?.get("depth")).toBe("3");
  });

  it("hands back the NESTED shape, children and children_as included", async () => {
    const server = mockServer(OK);
    const { result } = renderHook(() => useCategoryTree(3), {
      wrapper: wrapperFor(server),
    });
    await waitFor(() => {
      expect(result.current.data).toBeTruthy();
    });
    const roots = result.current.data ?? [];
    expect(roots.map((n) => n.id)).toEqual([141, 1]);
    const transport = roots[0];
    expect(transport?.children?.map((n) => n.id)).toEqual([151, 161]);
    // The partition arrives as a partition — the whole point of the field.
    expect(transport?.children?.[0]?.children_as).toBe("chips");
    expect(transport?.path).toBe(TREE_TRANSPORT.path);
  });

  it("keys on depth, so two depths are two answers and not one", () => {
    expect(categoriesQueryKeys.tree(2)).not.toEqual(categoriesQueryKeys.tree(3));
    expect(categoriesQueryKeys.tree(3)[0]).toBe("categories");
  });

  it("carries a caller's depth to the server", async () => {
    const server = mockServer(OK);
    const { result } = renderHook(() => useCategoryTree(1), {
      wrapper: wrapperFor(server),
    });
    await waitFor(() => {
      expect(result.current.data).toBeTruthy();
    });
    expect(server.lastQuery("/tree/")?.get("depth")).toBe("1");
  });

  it("asks nothing while disabled", () => {
    const server = mockServer(OK);
    renderHook(() => useCategoryTree(3, { enabled: false }), {
      wrapper: wrapperFor(server),
    });
    expect(server.calls).toHaveLength(0);
  });

  it("reports a refusal rather than an empty catalogue", async () => {
    const server = mockServer({
      "/tree/": { status: 503, body: { code: "stapel.http.503", message: "down" } },
    });
    const { result } = renderHook(() => useCategoryTree(), {
      wrapper: wrapperFor(server),
    });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });
});
