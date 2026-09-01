/**
 * `useRecents` — MRU order, dedupe, the cap, the reload, and the two ways a
 * storage backend can fail without taking a picker down with it.
 *
 * Every assertion goes through a real {@link memoryStorage} instance rather
 * than a stub of the hook's internals: what a caller is promised is that the
 * list comes BACK, and a test that never re-reads the backend cannot see the
 * difference between "persisted" and "kept in a module variable".
 */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { memoryStorage, recentsStorageKey, useRecents } from "../src/index.js";
import type { PersistStorage } from "../src/index.js";

/** A scope of its own per test: the subscriber registry is process-wide. */
let counter = 0;
function scopeName(): string {
  counter += 1;
  return `test.recents.${String(counter)}`;
}

describe("useRecents", () => {
  it("starts empty, then puts each touched code in front (MRU)", async () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage }));

    expect(result.current.recents).toEqual([]);
    act(() => {
      result.current.touch("toyota");
    });
    act(() => {
      result.current.touch("honda");
    });
    await waitFor(() => {
      expect(result.current.recents).toEqual(["honda", "toyota"]);
    });
  });

  it("dedupes: touching a code it already holds moves it, never doubles it", async () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage }));

    act(() => {
      result.current.touch("a");
    });
    act(() => {
      result.current.touch("b");
    });
    act(() => {
      result.current.touch("a");
    });
    await waitFor(() => {
      expect(result.current.recents).toEqual(["a", "b"]);
    });
  });

  it("keeps at most `max`, dropping the oldest", async () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage, max: 2 }));

    act(() => {
      result.current.touch("one");
    });
    act(() => {
      result.current.touch("two");
    });
    act(() => {
      result.current.touch("three");
    });
    await waitFor(() => {
      expect(result.current.recents).toEqual(["three", "two"]);
    });
  });

  it("ignores a blank code — a picker that committed nothing remembers nothing", () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage }));

    act(() => {
      result.current.touch("   ");
    });
    expect(result.current.recents).toEqual([]);
  });

  it("survives a reload: a fresh mount reads the same scope back from storage", async () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const first = renderHook(() => useRecents(scope, { storage }));

    act(() => {
      first.result.current.touch("kia");
    });
    act(() => {
      first.result.current.touch("audi");
    });
    await waitFor(async () => {
      expect(await storage.get(recentsStorageKey(scope))).toEqual(["audi", "kia"]);
    });
    first.unmount();

    const second = renderHook(() => useRecents(scope, { storage }));
    await waitFor(() => {
      expect(second.result.current.recents).toEqual(["audi", "kia"]);
    });
  });

  it("two live hooks on one scope see each other's picks", async () => {
    const storage = memoryStorage();
    const scope = scopeName();
    const field = renderHook(() => useRecents(scope, { storage }));
    const sheet = renderHook(() => useRecents(scope, { storage }));

    act(() => {
      sheet.result.current.touch("bmw");
    });
    await waitFor(() => {
      expect(field.result.current.recents).toEqual(["bmw"]);
    });
  });

  it("two scopes are two memories", async () => {
    const storage = memoryStorage();
    const leftScope = scopeName();
    const rightScope = scopeName();
    const left = renderHook(() => useRecents(leftScope, { storage }));
    const right = renderHook(() => useRecents(rightScope, { storage }));

    act(() => {
      left.result.current.touch("ford");
    });
    await waitFor(() => {
      expect(left.result.current.recents).toEqual(["ford"]);
    });
    expect(right.result.current.recents).toEqual([]);
  });

  it("a pick that lands before the read stays in front of what the disk held", async () => {
    const scope = scopeName();
    let release: (() => void) | undefined;
    // The read is held open deliberately, and answers with what was on disk
    // BEFORE this session touched anything — the race the merge exists for.
    const slow: PersistStorage = {
      get: async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return ["stored"];
      },
      set: () => Promise.resolve(),
      del: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
    };

    const { result } = renderHook(() => useRecents(scope, { storage: slow }));
    act(() => {
      result.current.touch("just-picked");
    });
    await act(async () => {
      release?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.recents).toEqual(["just-picked", "stored"]);
    });
  });

  it("reads a corrupt or foreign stored value as no recents", async () => {
    const scope = scopeName();
    const storage = memoryStorage();
    await storage.set(recentsStorageKey(scope), { not: "a list" });

    const { result } = renderHook(() => useRecents(scope, { storage }));
    await waitFor(() => {
      expect(result.current.recents).toEqual([]);
    });
    // …and the scope still works afterwards.
    act(() => {
      result.current.touch("fresh");
    });
    await waitFor(() => {
      expect(result.current.recents).toEqual(["fresh"]);
    });
  });

  it("never throws when the backend refuses, in either direction", async () => {
    const refusing: PersistStorage = {
      get: () => Promise.reject(new Error("storage refused")),
      set: () => {
        throw new Error("quota exceeded");
      },
      del: () => Promise.resolve(),
      keys: () => Promise.resolve([]),
    };
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage: refusing }));

    act(() => {
      result.current.touch("still-works");
    });
    // The pick is remembered for this session even though nothing was written.
    expect(result.current.recents).toEqual(["still-works"]);
    await waitFor(() => {
      expect(result.current.recents).toEqual(["still-works"]);
    });
  });

  it("writes the list through the storage layer on every pick", async () => {
    const storage = memoryStorage();
    const set = vi.spyOn(storage, "set");
    const scope = scopeName();
    const { result } = renderHook(() => useRecents(scope, { storage }));

    act(() => {
      result.current.touch("x");
    });
    await waitFor(() => {
      expect(set).toHaveBeenCalledWith(recentsStorageKey(scope), ["x"]);
    });
  });
});
