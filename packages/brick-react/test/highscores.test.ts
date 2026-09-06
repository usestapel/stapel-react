import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHighScoreStore,
  createNullHighScoreStore,
  HIGHSCORES_NAMESPACE,
} from "../src/index.js";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("high scores", () => {
  it("keeps the best per game, in the repository namespace", async () => {
    const store = createHighScoreStore();
    expect(await store.get("tetris")).toBe(0);

    expect(await store.record("tetris", 1200)).toBe(true);
    expect(await store.get("tetris")).toBe(1200);

    // A worse run is not a record, and does not overwrite.
    expect(await store.record("tetris", 800)).toBe(false);
    expect(await store.get("tetris")).toBe(1200);

    // Games do not share a number.
    expect(await store.get("snake")).toBe(0);
    expect(await store.record("snake", 30)).toBe(true);
    expect(await store.get("tetris")).toBe(1200);

    // And it is `createRepository`'s store, under this package's namespace —
    // not a key hand-rolled into localStorage.
    const keys = Object.keys(localStorage);
    expect(keys.some((k) => k.includes(HIGHSCORES_NAMESPACE))).toBe(true);
  });

  it("survives a browser that refuses to store anything", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("The quota has been exceeded.");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Access is denied for this document.");
    });

    const store = createHighScoreStore();
    // Not a rejection, not a throw: a waiting-room game must not take down the
    // page it was embedded in to protect a score.
    await expect(store.get("tetris")).resolves.toBe(0);
    await expect(store.record("tetris", 500)).resolves.toBe(true);
    await expect(store.get("tetris")).resolves.toBe(0);
    await expect(store.clear()).resolves.toBeUndefined();
  });

  it("ignores a score that is not one", async () => {
    const store = createHighScoreStore();
    expect(await store.record("snake", Number.NaN)).toBe(false);
    expect(await store.record("snake", -5)).toBe(false);
    expect(await store.get("snake")).toBe(0);
  });

  it("offers a store that remembers nothing, for demos and tests", async () => {
    const store = createNullHighScoreStore();
    expect(await store.record("memory", 999)).toBe(false);
    expect(await store.get("memory")).toBe(0);
  });
});
