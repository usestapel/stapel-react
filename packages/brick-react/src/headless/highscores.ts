/**
 * High scores, one number per game, kept on the device.
 *
 * Persistence goes through `@stapel/core`'s `createRepository` — the one
 * sanctioned client-side store (`stapel/no-raw-storage` makes that mechanical,
 * not a convention). Scope is `"app"`: a score belongs to the browser someone
 * played in, not to a session, and it must survive a logout the way a browser
 * game always has.
 *
 * ── Blocked storage is a normal outcome, not an error ──────────────────────
 * Safari in private mode, a locked-down enterprise profile, a third-party
 * iframe with storage partitioned off: `localStorage.setItem` throws
 * SYNCHRONOUSLY there. A waiting-room game that crashes the page it was
 * embedded in to protect a high score would be the worst possible trade, so
 * every read and write here is wrapped: a blocked store degrades to "no high
 * score yet" and the game plays exactly the same.
 */
import { createRepository } from "@stapel/core";
import type { Repository } from "@stapel/core";
import type { BrickGameId } from "./types.js";

/** The repository namespace. Also the key prefix in the store. */
export const HIGHSCORES_NAMESPACE = "brick-highscores";

export interface HighScoreStore {
  /** The best score for a game; 0 when there is none (or the store is shut). */
  get(game: BrickGameId): Promise<number>;
  /**
   * Record a score. Returns true when it became the new best — the caller uses
   * that to say "new record" without a second read.
   */
  record(game: BrickGameId, score: number): Promise<boolean>;
  clear(): Promise<void>;
}

/** A store that remembers nothing — the fallback, and the test double. */
export function createNullHighScoreStore(): HighScoreStore {
  return {
    get: () => Promise.resolve(0),
    record: () => Promise.resolve(false),
    clear: () => Promise.resolve(),
  };
}

/**
 * The real store. Construction itself is guarded: `createRepository` reaches
 * for a storage backend, and a host that has none at all must still get a
 * console it can play.
 */
export function createHighScoreStore(): HighScoreStore {
  let repo: Repository<number> | null = null;
  try {
    repo = createRepository<number>(HIGHSCORES_NAMESPACE, {
      scope: "app",
      storage: "local",
    });
  } catch {
    return createNullHighScoreStore();
  }
  const store = repo;

  async function read(game: BrickGameId): Promise<number> {
    try {
      const value = await store.get(game);
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    } catch {
      return 0;
    }
  }

  return {
    get: read,
    async record(game, score) {
      if (!Number.isFinite(score) || score <= 0) return false;
      const best = await read(game);
      if (score <= best) return false;
      try {
        await store.set(game, score);
      } catch {
        // Written nowhere. The run still beat the session's best, and saying
        // so is honest: the caller shows "new record", it just will not be
        // there tomorrow.
        return true;
      }
      return true;
    },
    async clear() {
      try {
        await store.clear();
      } catch {
        /* nothing to clear in a store that will not open */
      }
    },
  };
}
