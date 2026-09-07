import { describe, expect, it } from "vitest";
import {
  createBrickSession,
  gridSignature,
  LEVEL_SPEEDUP,
  SNAKE,
  stepMsForLevel,
  TETRIS,
} from "../src/index.js";

const settled = (cells: readonly number[]): number => cells.filter((c) => c === 2).length;

describe("a press", () => {
  it("is applied the moment it arrives, not at the next tick", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    const before = gridSignature(session.grid);
    session.press("left");
    expect(gridSignature(session.grid)).not.toBe(before);
  });
});

describe("tetris controls and tempo", () => {
  it("runs at 500ms a row on level 1 and 15% faster each level", () => {
    expect(TETRIS.stepMs).toBe(500);
    expect(LEVEL_SPEEDUP).toBe(0.85);
    expect(stepMsForLevel(TETRIS, 2)).toBe(425);
    expect(stepMsForLevel(TETRIS, 3)).toBe(361);
    expect(stepMsForLevel(TETRIS, 4)).toBe(307);
    expect(stepMsForLevel(TETRIS, 40)).toBe(60);
  });

  it("soft-drops ten times faster while DOWN is held, a point a row", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    expect(session.stepMs).toBe(500);
    session.hold("down", true);
    expect(session.stepMs).toBe(50);
    const score = session.status().score;
    session.step();
    expect(session.status().score).toBe(score + 1);
    session.hold("down", false);
    expect(session.stepMs).toBe(500);
    session.step();
    expect(session.status().score).toBe(score + 1);
  });

  it("a soft drop per press pays a point; UP hard-drops and locks at once, two a row", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    session.press("down");
    expect(session.status().score).toBe(1);
    expect(settled(session.grid.cells)).toBe(0);
    session.press("up");
    expect(settled(session.grid.cells)).toBeGreaterThan(0);
    // Sixteen-odd rows at two points each, on top of the soft drop's one.
    expect(session.status().score).toBeGreaterThanOrEqual(1 + 2 * 10);
  });

  it("a lock ends the hold: the next piece is not flung down by the same key", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    session.hold("down", true);
    session.press("up");
    expect(session.stepMs).toBe(500);
  });

  it("releaseAll lets go of every held button", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    session.hold("down", true);
    session.releaseAll();
    expect(session.stepMs).toBe(500);
  });
});

describe("snake at speed", () => {
  it("runs twice as fast only while the key of its own direction is held", () => {
    const session = createBrickSession({ definition: SNAKE, seed: 1 }); // heading right
    expect(session.stepMs).toBe(180);
    session.hold("right", true);
    expect(session.stepMs).toBe(90);
    session.hold("right", false);
    expect(session.stepMs).toBe(180);
    // A held key that is not the direction of travel does nothing —
    session.hold("up", true);
    expect(session.stepMs).toBe(180);
    // — until the turn it names has been taken.
    session.press("up");
    expect(session.stepMs).toBe(180);
    session.step();
    expect(session.stepMs).toBe(90);
    session.releaseAll();
    expect(session.stepMs).toBe(180);
  });
});
