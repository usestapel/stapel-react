/**
 * `useObjectUrlPreview` — the revoke that always gets forgotten.
 *
 * Every assertion here is about PAIRING, not about the URL string: an object
 * URL that is created and never revoked pins its blob for the life of the
 * document, silently. jsdom has no `URL.createObjectURL`, so the suite
 * installs a counting pair — which is also the only way to observe the thing
 * under test, since a real browser gives no signal either.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useObjectUrlPreview } from "../src/index.js";

const created: string[] = [];
const revoked: string[] = [];
let originalCreate: typeof URL.createObjectURL | undefined;
let originalRevoke: typeof URL.revokeObjectURL | undefined;

beforeEach(() => {
  created.length = 0;
  revoked.length = 0;
  originalCreate = URL.createObjectURL as typeof URL.createObjectURL | undefined;
  originalRevoke = URL.revokeObjectURL as typeof URL.revokeObjectURL | undefined;
  let counter = 0;
  URL.createObjectURL = ((): string => {
    counter += 1;
    const url = `blob:test-${String(counter)}`;
    created.push(url);
    return url;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((url: string): void => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;
});

afterEach(() => {
  if (originalCreate) URL.createObjectURL = originalCreate;
  if (originalRevoke) URL.revokeObjectURL = originalRevoke;
});

/** Everything created has been revoked — the only property that matters. */
function balanced(): boolean {
  return created.every((url) => revoked.includes(url));
}

describe("useObjectUrlPreview", () => {
  it("has nothing to preview until there is a file", () => {
    const { result } = renderHook(() => useObjectUrlPreview(null));
    expect(result.current).toBeNull();
    expect(created).toHaveLength(0);
  });

  it("previews the picked file", () => {
    const file = new Blob(["png"], { type: "image/png" });
    const { result } = renderHook(() => useObjectUrlPreview(file));
    expect(result.current).toBe(created[0]);
    expect(revoked).toHaveLength(0);
  });

  it("revokes the previous preview when the pick is replaced", () => {
    const first = new Blob(["one"], { type: "image/png" });
    const second = new Blob(["two"], { type: "image/png" });
    const { result, rerender } = renderHook(
      ({ file }: { file: Blob | null }) => useObjectUrlPreview(file),
      { initialProps: { file: first as Blob | null } }
    );
    const firstUrl = result.current;

    rerender({ file: second });

    expect(revoked).toContain(firstUrl);
    expect(result.current).not.toBe(firstUrl);
    expect(balanced()).toBe(false); // the live one is still live
    expect(revoked).toHaveLength(1);
  });

  it("revokes when the pick is cleared, and answers null", () => {
    const file = new Blob(["one"], { type: "image/png" });
    const { result, rerender } = renderHook(
      ({ f }: { f: Blob | null }) => useObjectUrlPreview(f),
      { initialProps: { f: file as Blob | null } }
    );
    rerender({ f: null });
    expect(result.current).toBeNull();
    expect(balanced()).toBe(true);
  });

  it("revokes on unmount — the leak nobody writes by hand", () => {
    const file = new Blob(["one"], { type: "image/png" });
    const { unmount } = renderHook(() => useObjectUrlPreview(file));
    expect(created).toHaveLength(1);
    unmount();
    expect(balanced()).toBe(true);
  });

  it("leaves nothing behind across a run of picks", () => {
    const files: Blob[] = Array.from({ length: 5 }, (_, i) =>
      new Blob([`file-${String(i)}`], { type: "image/png" })
    );
    const { rerender, unmount } = renderHook(
      ({ f }: { f: Blob | null }) => useObjectUrlPreview(f),
      { initialProps: { f: files[0] as Blob | null } }
    );
    for (const file of files.slice(1)) rerender({ f: file });
    unmount();
    expect(created).toHaveLength(5);
    expect(balanced()).toBe(true);
  });
});
