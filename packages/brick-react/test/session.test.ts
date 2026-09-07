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
  it("runs at 360ms a row on level 1 and 15% faster each level", () => {
    expect(TETRIS.stepMs).toBe(360);
    expect(LEVEL_SPEEDUP).toBe(0.85);
    expect(stepMsForLevel(TETRIS, 2)).toBe(306);
    expect(stepMsForLevel(TETRIS, 3)).toBe(260);
    expect(stepMsForLevel(TETRIS, 4)).toBe(221);
    expect(stepMsForLevel(TETRIS, 40)).toBe(60);
  });

  it("soft-drops ten times faster while DOWN is held, and pays nothing for it", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    expect(session.stepMs).toBe(360);
    session.hold("down", true);
    expect(session.stepMs).toBe(36);
    const before = session.grid.cells.join("");
    session.step();
    expect(session.grid.cells.join(""), "the piece did not fall").not.toBe(before);
    expect(session.status().score).toBe(0);
    session.hold("down", false);
    expect(session.stepMs).toBe(360);
    session.step();
    expect(session.status().score).toBe(0);
  });

  it("a press of DOWN moves a row; UP locks at once — and neither is worth a point", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    const before = session.grid.cells.join("");
    session.press("down");
    expect(session.grid.cells.join("")).not.toBe(before);
    expect(session.status().score).toBe(0);
    expect(settled(session.grid.cells)).toBe(0);
    session.press("up");
    expect(settled(session.grid.cells)).toBeGreaterThan(0);
    expect(session.status().score).toBe(0);
  });

  it("a lock ends the hold: the next piece is not flung down by the same key", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    session.hold("down", true);
    session.press("up");
    expect(session.stepMs).toBe(360);
  });

  it("releaseAll lets go of every held button", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 1 });
    session.hold("down", true);
    session.releaseAll();
    expect(session.stepMs).toBe(360);
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
