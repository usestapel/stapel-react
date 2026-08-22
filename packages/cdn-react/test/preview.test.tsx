/**
 * The object-URL lifetime (spec §8.2 — revoke the objectURL).
 *
 * The leak this guards against is invisible until a long session with many
 * picks starts swapping: `createObjectURL` pins the blob and nothing collects
 * it. The pair does not re-derive the three revokes — it uses core's
 * `useObjectUrlPreview`, whose whole job is that lifetime — so these tests
 * assert the WIRING is real, by counting create/revoke calls.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { useUploadImage, useUploadPreview, useUploadQueue } from "../src/index.js";
import type { UploadItem } from "../src/index.js";
import { TestHarness, mockServer } from "./harness.js";
import type { MockServer } from "./harness.js";
import { imageFile, imageRow, MISS, uploaded } from "./fixtures.js";

let created: string[] = [];
let revoked: string[] = [];

beforeEach(() => {
  created = [];
  revoked = [];
  let n = 0;
  // jsdom implements neither, so these are the only implementations in play —
  // which makes the counts exact rather than approximate.
  URL.createObjectURL = vi.fn(() => {
    n += 1;
    const url = `blob:test/${String(n)}`;
    created.push(url);
    return url;
  });
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function wrapperFor(server: MockServer) {
  return function Wrapper(props: { children: ReactNode }): ReactNode {
    return <TestHarness server={server}>{props.children}</TestHarness>;
  };
}

function storingServer(): MockServer {
  return mockServer({
    "/file/exists/": { body: MISS },
    "/upload/image/": { status: 201, body: uploaded(imageRow({ hash: "a".repeat(64) })) },
  });
}

describe("single-slot preview", () => {
  it("creates a preview for the pick and revokes it on unmount", async () => {
    const server = storingServer();
    const { result, unmount } = renderHook(() => useUploadImage(), {
      wrapper: wrapperFor(server),
    });

    await act(async () => {
      await result.current.upload(imageFile());
    });
    await waitFor(() => {
      expect(result.current.previewUrl).not.toBeNull();
    });
    expect(created).toHaveLength(1);
    expect(revoked).toEqual([]);

    unmount();
    expect(revoked).toEqual(created);
  });

  it("a second pick revokes the first preview before showing the second", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadImage(), {
      wrapper: wrapperFor(server),
    });

    await act(async () => {
      await result.current.upload(imageFile("a.jpg"));
    });
    await waitFor(() => {
      expect(created).toHaveLength(1);
    });
    await act(async () => {
      await result.current.upload(imageFile("b.jpg", "other"));
    });

    await waitFor(() => {
      expect(created).toHaveLength(2);
    });
    expect(revoked).toContain(created[0]);
  });

  it("reset clears the pick, and its preview with it", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadImage(), {
      wrapper: wrapperFor(server),
    });

    await act(async () => {
      await result.current.upload(imageFile());
    });
    await waitFor(() => {
      expect(created).toHaveLength(1);
    });
    act(() => {
      result.current.reset();
    });

    await waitFor(() => {
      expect(revoked).toEqual(created);
    });
    expect(result.current.previewUrl).toBeNull();
  });
});

describe("queue tile preview", () => {
  function Tile(props: { item: UploadItem }): ReactNode {
    const preview = useUploadPreview(props.item);
    return <span data-testid="url">{preview.url ?? ""}</span>;
  }

  it("removing a tile revokes exactly that tile's URL", async () => {
    const server = storingServer();
    const { result } = renderHook(() => useUploadQueue({ max: 10 }), {
      wrapper: wrapperFor(server),
    });

    act(() => {
      result.current.add([imageFile("a.jpg")]);
    });
    await waitFor(() => {
      expect(result.current.items).toHaveLength(1);
    });

    const item = result.current.items[0] as UploadItem;
    const view = render(<Tile item={item} />);
    await waitFor(() => {
      expect(created).toHaveLength(1);
    });

    view.unmount();
    expect(revoked).toEqual(created);
  });

  it("falls back to the CDN thumbnail when there is no local pick", () => {
    const restored: UploadItem = {
      id: "x",
      file: null,
      phase: "done",
      ref: `product/${"a".repeat(64)}`,
      image: imageRow({ hash: "a".repeat(64) }) as never,
      deduped: false,
      dedupSkipped: undefined,
      variantsReady: true,
      error: null,
    };
    const view = render(<Tile item={restored} />);
    expect(view.getByTestId("url").textContent).toContain("/120/");
    expect(created).toEqual([]);
  });
});
