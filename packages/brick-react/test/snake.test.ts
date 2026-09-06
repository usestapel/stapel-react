import { describe, expect, it } from "vitest";
import { clearGrid, createGrid, getCell, SNAKE } from "../src/index.js";
import type { Game, MutableGrid } from "../src/index.js";

/**
 * Snake asks its generator for a food position as two draws (x, then y), so a
 * scripted source is how a test says where the pellet is. The last pair repeats
 * once the script runs out.
 */
function scripted(values: readonly number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

function build(values: readonly number[]): Game {
  return SNAKE.create({
    random: scripted(values),
    cols: SNAKE.cols,
    rows: SNAKE.rows,
  });
}

function frame(game: Game): MutableGrid {
  const grid = createGrid(SNAKE.cols, SNAKE.rows);
  clearGrid(grid);
  game.render(grid);
  return grid;
}

/** How many cells the snake's body occupies (head 3, body 2; the pellet is 1). */
function bodyLength(game: Game): number {
  const grid = frame(game);
  let count = 0;
  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      if (getCell(grid, x, y) >= 2) count += 1;
    }
  }
  return count;
}

// (5,10) then (6,10) then (0,0) — two pellets straight ahead of the snake,
// which starts at (4,10) heading right, and a third well out of the way.
const AHEAD = [0.26, 0.51, 0.31, 0.51, 0, 0];

describe("snake", () => {
  it("starts three long and grows one cell per pellet", () => {
    const game = build(AHEAD);
    expect(bodyLength(game)).toBe(3);
    game.tick();
    expect(game.status().score).toBe(10);
    expect(game.status().cleared).toBe(1);
    expect(bodyLength(game)).toBe(4);
    game.tick();
    expect(bodyLength(game)).toBe(5);
    expect(game.status().score).toBe(20);
  });

  it("dies on the wall", () => {
    const game = build([0, 0]); // the pellet is at (0,0), behind the snake
    for (let i = 0; i < SNAKE.cols && !game.status().over; i += 1) game.tick();
    expect(game.status().over).toBe(true);
    // Nothing happens after that: no more ticks, no more score.
    const score = game.status().score;
    game.tick();
    expect(game.status().score).toBe(score);
  });

  it("dies on itself", () => {
    const game = build(AHEAD);
    game.tick(); // eats (5,10) — four long
    game.tick(); // eats (6,10) — five long, head at (6,10)
    game.input("down");
    game.tick(); // (6,11)
    game.input("left");
    game.tick(); // (5,11)
    expect(game.status().over).toBe(false);
    game.input("up");
    game.tick(); // (5,10) — its own body, four ticks old
    expect(game.status().over).toBe(true);
  });

  it("refuses a reversal into its own neck", () => {
    const game = build([0, 0]);
    game.input("left"); // straight back down the body — ignored
    game.tick();
    // Still travelling right: the head advanced one column, not backwards.
    const grid = frame(game);
    expect(getCell(grid, 5, 10)).toBe(3);
  });

  it("has no next-piece preview", () => {
    expect(build([0, 0]).status().next).toBeNull();
  });
});
