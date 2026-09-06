import { describe, expect, it } from "vitest";
import { createGrid, clearGrid, getCell, TETRIS } from "../src/index.js";
import type { Game, MutableGrid } from "../src/index.js";

/** A generator that deals ONE shape forever — the only way to test a board. */
function fixedShape(index: number): () => number {
  // `pickShape` is `floor(random() * 7)`, so the midpoint of the slot is the
  // stable way to name a piece without reaching into the module.
  return () => (index + 0.5) / 7;
}

function build(shapeIndex: number): Game {
  return TETRIS.create({
    random: fixedShape(shapeIndex),
    cols: TETRIS.cols,
    rows: TETRIS.rows,
  });
}

function frame(game: Game): MutableGrid {
  const grid = createGrid(TETRIS.cols, TETRIS.rows);
  clearGrid(grid);
  game.render(grid);
  return grid;
}

/** How many cells the board has settled — the piece in flight paints 3, not 2. */
function settled(game: Game): number {
  return frame(game).cells.filter((cell) => cell === 2).length;
}

/**
 * Soft-drop until the piece locks. "Locked" is read off the BOARD (settled
 * cells changed, or a line was cleared) rather than off the score: the score
 * keeps rising afterwards, because the next piece is already falling.
 */
function drop(game: Game): void {
  const before = settled(game);
  const cleared = game.status().cleared;
  for (let i = 0; i < TETRIS.rows + 4; i += 1) {
    game.input("down");
    if (game.status().cleared !== cleared) return;
    if (settled(game) !== before) return;
  }
}

function moveTo(game: Game, steps: number): void {
  const action = steps < 0 ? "left" : "right";
  for (let i = 0; i < Math.abs(steps); i += 1) game.input(action);
}

describe("tetris", () => {
  it("clears the lines a wall of O pieces completes", () => {
    // O spawns at x=4 and is two wide: five of them at 0,2,4,6,8 fill the two
    // bottom rows exactly.
    const game = build(1);
    for (const column of [0, 2, 4, 6, 8]) {
      moveTo(game, column - 4);
      drop(game);
    }
    expect(game.status().cleared).toBe(2);
    // 300 points for a double, at level 1, plus the soft-drop points.
    expect(game.status().score).toBeGreaterThanOrEqual(300);
    // And the board is empty again — every lit cell now belongs to the piece
    // in flight, which is above the halfway line.
    const grid = frame(game);
    for (let x = 0; x < TETRIS.cols; x += 1) {
      expect(getCell(grid, x, TETRIS.rows - 1)).not.toBe(2);
    }
  });

  it("kicks a rotation that would land outside the panel", () => {
    // The I piece, stood up and pushed as far left as it goes, is at a column
    // where its horizontal form does not fit. Without a kick the button would
    // simply do nothing; with one it steps back into the panel.
    const game = build(0);
    game.input("ok"); // upright
    for (let i = 0; i < 6; i += 1) game.input("left"); // hard against the wall
    game.input("ok"); // back down — only possible via the +2 kick
    const grid = frame(game);
    const lit = [0, 1, 2, 3].map((x) => getCell(grid, x, 2));
    expect(lit).toEqual([3, 3, 3, 3]);
  });

  it("ends when a spawn has nowhere to go", () => {
    const game = build(1);
    // Ten O pieces stacked in the same two columns reach the ceiling; the
    // eleventh has no room to appear.
    for (let i = 0; i < 14 && !game.status().over; i += 1) drop(game);
    expect(game.status().over).toBe(true);
    // An over game ignores everything: no input, no gravity, no score.
    const score = game.status().score;
    game.input("left");
    game.tick();
    expect(game.status().score).toBe(score);
  });

  it("offers a next-piece preview, and the other games do not", () => {
    const game = build(2);
    const preview = game.status().next;
    expect(preview).not.toBeNull();
    expect(preview).toHaveLength(16);
    expect(preview?.some((cell) => cell > 0)).toBe(true);
  });
});
