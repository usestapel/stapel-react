/**
 * Memory, against the owner's words: not a grid of tiles — FOUR 2x2 squares in
 * a d-pad arrangement, which light up (and change shape) in a sequence the
 * player repeats, one longer each round.
 */
import { describe, expect, it } from "vitest";
import { MEMORY } from "../src/index.js";
import { at, build, draw, frame } from "./_frame.js";
import type { BrickInput, Game } from "../src/index.js";

/** The four pads, in d-pad order: up, left, right, down. */
const PADS: readonly { readonly input: BrickInput; readonly x: number; readonly y: number }[] = [
  { input: "up", x: 5, y: 1 },
  { input: "left", x: 1, y: 5 },
  { input: "right", x: 9, y: 5 },
  { input: "down", x: 5, y: 9 },
];

/** Which pad, if any, is lit right now. */
function litPad(game: Game): number {
  const grid = frame(MEMORY, game);
  for (let i = 0; i < PADS.length; i += 1) {
    const pad = PADS[i];
    if (!pad) continue;
    // A lit pad has grown: its halo — the ring one cell outside the 2x2 — is on.
    if (at(grid, pad.x - 1, pad.y - 1) === 3) return i;
  }
  return -1;
}

/** True while the console is waiting for the player to repeat what it showed. */
function listening(game: Game): boolean {
  const grid = frame(MEMORY, game);
  const mid = Math.floor(MEMORY.cols / 2) - 1;
  return at(grid, mid, mid) > 0 && litPad(game) === -1;
}

/** Watch one show phase and hand back the pads it lit, in order. */
function watchSequence(game: Game, budget = 400): number[] {
  const shown: number[] = [];
  let last = -1;
  for (let i = 0; i < budget; i += 1) {
    const pad = litPad(game);
    if (pad >= 0 && pad !== last) shown.push(pad);
    last = pad;
    if (shown.length > 0 && listening(game)) return shown;
    game.tick();
  }
  return shown;
}

describe("memory — the board", () => {
  it("is four 2x2 squares in a d-pad arrangement, and nothing else", () => {
    const game = build(MEMORY);
    const grid = frame(MEMORY, game);
    for (const pad of PADS) {
      expect(draw(grid, pad.x, pad.y, 2, 2), `pad at ${String(pad.x)},${String(pad.y)}`).toEqual([
        "00",
        "00",
      ]);
    }
    // Sixteen cells in all — four squares of four. Anything more is a tile grid.
    const lit = grid.cells.filter((cell) => cell > 0).length;
    expect(lit).toBe(16);
  });

  it("lays the four pads out as a d-pad: one above, one below, one either side", () => {
    const centreX = MEMORY.cols / 2;
    const centreY = MEMORY.rows / 2;
    const [up, left, right, down] = PADS;
    expect(up && left && right && down).toBeTruthy();
    if (!up || !left || !right || !down) return;
    expect(up.y).toBeLessThan(centreY);
    expect(down.y).toBeGreaterThan(centreY);
    expect(left.x).toBeLessThan(centreX);
    expect(right.x).toBeGreaterThan(centreX);
    expect(up.x).toBe(down.x);
    expect(left.y).toBe(right.y);
  });
});

describe("memory — the round", () => {
  it("shows one pad, then two, then three — growing by one each round", () => {
    const game = build(MEMORY, { seed: 11 });
    const first = watchSequence(game);
    expect(first).toHaveLength(1);
    for (const index of first) {
      const pad = PADS[index];
      if (pad) game.input(pad.input);
    }
    expect(game.status().over).toBe(false);
    const second = watchSequence(game);
    expect(second).toHaveLength(2);
    // …and the sequence is the same one, extended — not a new one each round.
    expect(second.slice(0, 1)).toEqual(first);
    for (const index of second) {
      const pad = PADS[index];
      if (pad) game.input(pad.input);
    }
    expect(watchSequence(game)).toHaveLength(3);
  });

  it("changes a pad's shape while it is lit", () => {
    const game = build(MEMORY, { seed: 11 });
    for (let i = 0; i < 400; i += 1) {
      const index = litPad(game);
      if (index >= 0) {
        const pad = PADS[index];
        expect(pad).toBeDefined();
        if (!pad) return;
        // Grown: a 4x4 square where a 2x2 one was.
        expect(draw(frame(MEMORY, game), pad.x - 1, pad.y - 1, 4, 4)).toEqual([
          "0000",
          "0000",
          "0000",
          "0000",
        ]);
        return;
      }
      game.tick();
    }
    throw new Error("no pad ever lit");
  });

  it("ends the run on a wrong repeat", () => {
    const game = build(MEMORY, { seed: 11 });
    const shown = watchSequence(game);
    expect(shown).toHaveLength(1);
    const wrong = PADS.find((_, i) => i !== shown[0]);
    expect(wrong).toBeDefined();
    if (!wrong) return;
    game.input(wrong.input);
    expect(game.status().over).toBe(true);
  });

  it("pays for a round the player got right", () => {
    const game = build(MEMORY, { seed: 11 });
    const shown = watchSequence(game);
    const pad = PADS[shown[0] ?? 0];
    expect(pad).toBeDefined();
    if (!pad) return;
    game.input(pad.input);
    expect(game.status().over).toBe(false);
    expect(game.status().score).toBeGreaterThan(0);
    expect(game.status().cleared).toBe(1);
  });

  it("starts with as many blinks as the level the person chose", () => {
    const game = build(MEMORY, { seed: 11, startLevel: 3 });
    expect(game.status().level).toBe(3);
    expect(watchSequence(game)).toHaveLength(3);
  });
});
