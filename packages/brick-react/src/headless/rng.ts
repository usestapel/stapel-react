/**
 * A seeded pseudo-random generator, because "the engine is deterministic" has
 * to be provable. `Math.random()` makes every game test a coin flip: a Tetris
 * suite that asserts a line clear cannot spawn its own pieces, and a flake
 * there reads as a bug in the rotation code.
 *
 * mulberry32 — 32 bits of state, four operations, uniform enough for a toy and
 * short enough to keep the headless bundle honest.
 */

/** A seeded `[0, 1)` source, plus the two draws a game actually makes. */
export interface Rng {
  /** `[0, 1)`. */
  next(): number;
  /** `[0, n)` as an integer. `n <= 0` returns 0. */
  int(n: number): number;
  /** One element, or `undefined` for an empty list. */
  pick<T>(items: readonly T[]): T | undefined;
}

/**
 * Create a generator. The same seed always replays the same sequence, on every
 * platform — the property the loop-determinism test is built on.
 */
export function createRng(seed: number): Rng {
  // Keep the state in the 32-bit unsigned range from the start: a seed of 0
  // would otherwise emit 0 forever.
  let state = (Math.trunc(seed) || 1) >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number): number => (n <= 0 ? 0 : Math.floor(next() * n) % n);
  return {
    next,
    int,
    pick<T>(items: readonly T[]): T | undefined {
      if (items.length === 0) return undefined;
      return items[int(items.length)];
    },
  };
}
