/**
 * The owner's report, in one line: none of the games is randomised, every one
 * of them starts the same way. Every session opened identically, so a second
 * play was the first play again.
 *
 * The fix has two halves and this file is both of them:
 *
 *  - a session with NO seed deals a fresh game — several fresh sessions of the
 *    same game do not all play out the same way;
 *  - a session with an EXPLICIT seed is reproducible to the cell, which is what
 *    keeps every other test in this package a test rather than a coin flip.
 *
 * The first half is a probabilistic assertion, so it is written the way that
 * makes it safe: eight sessions, and the failure it is looking for — a constant
 * default seed — makes all eight identical, while real randomness makes all
 * eight identical with a probability far below one in a billion.
 */
import { describe, expect, it } from "vitest";
import { BRICK_GAMES, createBrickSession, gridSignature } from "../src/index.js";
import type { GameDefinition } from "../src/index.js";

/** Play N steps and hand back everything the panel showed. */
function run(definition: GameDefinition, seed?: number, steps = 150): string {
  const session = createBrickSession({
    definition,
    ...(seed === undefined ? {} : { seed }),
  });
  const frames: string[] = [gridSignature(session.grid)];
  for (let i = 0; i < steps; i += 1) {
    session.step();
    frames.push(gridSignature(session.grid));
    if (session.status().over) break;
  }
  return frames.join("\n");
}

describe("a new game is a new game", () => {
  for (const definition of BRICK_GAMES) {
    it(`${definition.id}: eight unseeded sessions do not all play out the same`, () => {
      const runs = new Set<string>();
      for (let i = 0; i < 8; i += 1) runs.add(run(definition));
      expect(
        runs.size,
        `${definition.id} opens the same way every time — it is seeded from a constant`
      ).toBeGreaterThan(1);
    });
  }

  it("a reset deals a new game too, unless the host pinned the seed", () => {
    const definition = BRICK_GAMES[0];
    expect(definition).toBeDefined();
    if (!definition) return;

    const fresh = new Set<string>();
    for (let i = 0; i < 8; i += 1) {
      const session = createBrickSession({ definition });
      session.reset();
      for (let step = 0; step < 20; step += 1) session.step();
      fresh.add(gridSignature(session.grid));
    }
    expect(fresh.size, "every reset dealt the same board").toBeGreaterThan(1);

    // A pinned seed is a promise: the reset replays the same game.
    const pinned = createBrickSession({ definition, seed: 4242 });
    const first: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      pinned.step();
      first.push(gridSignature(pinned.grid));
    }
    pinned.reset();
    const second: string[] = [];
    for (let step = 0; step < 20; step += 1) {
      pinned.step();
      second.push(gridSignature(pinned.grid));
    }
    expect(second).toEqual(first);
  });
});

describe("a seed is still a promise", () => {
  for (const definition of BRICK_GAMES) {
    it(`${definition.id}: the same seed replays the same run, cell for cell`, () => {
      expect(run(definition, 4242)).toBe(run(definition, 4242));
    });

    it(`${definition.id}: a different seed is a different run`, () => {
      expect(run(definition, 4242)).not.toBe(run(definition, 99));
    });
  }
});
