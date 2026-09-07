/**
 * Tanks, against the owner's drawing:
 *
 * ```
 *  0
 * 000
 * 0 0
 * ```
 *
 * and his three sentences about the enemies: they appear AT THE CORNERS, they
 * drive back and forth, and they shoot.
 */
import { describe, expect, it } from "vitest";
import { TANKS } from "../src/index.js";
import { boxAt, build, cellsAt, draw, frame } from "./_frame.js";
import type { Game } from "../src/index.js";

const TANK_UP = [" 0 ", "000", "0 0"];
const TANK_DOWN = ["0 0", "000", " 0 "];

/** Where a 3x3 tank sits when it enters at each corner of the field. */
const CORNERS = [
  { x: 0, y: 0 },
  { x: TANKS.cols - 3, y: 0 },
  { x: 0, y: TANKS.rows - 3 },
  { x: TANKS.cols - 3, y: TANKS.rows - 3 },
];

/** Every way the player's tank can be pointing — the same six pixels, turned. */
const PLAYER_SHAPES = [
  TANK_UP,
  TANK_DOWN,
  [" 00", "00 ", " 00"],
  ["00 ", " 00", "00 "],
].map((shape) => shape.join("|"));

/** The player's 3x3, wherever it is and whichever way it points. */
function playerBox(game: Game): { x: number; y: number } {
  const grid = frame(TANKS, game);
  for (let y = 0; y + 3 <= TANKS.rows; y += 1) {
    for (let x = 0; x + 3 <= TANKS.cols; x += 1) {
      if (PLAYER_SHAPES.includes(draw(grid, x, y, 3, 3, 3).join("|"))) return { x, y };
    }
  }
  throw new Error("the player's tank is not on the panel");
}

/** Step until an enemy is on the panel; returns its box, or null. */
function firstEnemy(game: Game, budget = 200): { x: number; y: number; width: number; height: number } | null {
  for (let i = 0; i < budget; i += 1) {
    game.tick();
    const box = boxAt(frame(TANKS, game), 2);
    if (box) return box;
  }
  return null;
}

describe("tanks — the shape", () => {
  it("draws the player's tank exactly as the owner drew it", () => {
    const game = build(TANKS);
    const { x, y } = playerBox(game);
    expect(draw(frame(TANKS, game), x, y, 3, 3, 3)).toEqual(TANK_UP);
  });

  it("draws an enemy as the same tank, turned to face the player", () => {
    const game = build(TANKS, { seed: 5 });
    const box = firstEnemy(game);
    expect(box, "no enemy appeared in 200 steps").not.toBeNull();
    if (!box) return;
    expect({ width: box.width, height: box.height }).toEqual({ width: 3, height: 3 });
    const shape = draw(frame(TANKS, game), box.x, box.y, 3, 3, 2);
    const facingDown = box.y < TANKS.rows / 2;
    expect(shape).toEqual(facingDown ? TANK_DOWN : TANK_UP);
  });
});

describe("tanks — the enemies", () => {
  it("enters every enemy at a corner of the field", () => {
    const seen = new Set<string>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const game = build(TANKS, { seed });
      const box = firstEnemy(game);
      expect(box, `no enemy for seed ${String(seed)}`).not.toBeNull();
      if (!box) continue;
      const corner = CORNERS.find((c) => c.x === box.x && c.y === box.y);
      expect(corner, `enemy entered at ${String(box.x)},${String(box.y)} — not a corner`).toBeDefined();
      seen.add(`${String(box.x)},${String(box.y)}`);
    }
    // …and not always the same corner: the order is part of what makes a new
    // game a new game.
    expect(seen.size).toBeGreaterThan(1);
  });

  it("drives an enemy back and forth rather than straight at the player", () => {
    const game = build(TANKS, { seed: 5 });
    const start = firstEnemy(game);
    expect(start).not.toBeNull();
    if (!start) return;
    const xs: number[] = [start.x];
    for (let i = 0; i < 120; i += 1) {
      game.tick();
      const grid = frame(TANKS, game);
      const box = boxAt(grid, 2);
      // Only while ONE enemy is out: a bounding box round two of them is not a
      // position, it is an average.
      if (box && cellsAt(grid, 2).length === 6) xs.push(box.x);
    }
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(TANKS.cols - 3);
    // It went one way and then the other.
    const spread = Math.max(...xs) - Math.min(...xs);
    expect(spread, "the enemy never moved along its band").toBeGreaterThan(2);
    // A tank moves every other tick, so the frames where it stands still say
    // nothing about direction: reversals are counted over the moves it made.
    const moves: number[] = [];
    for (let i = 1; i < xs.length; i += 1) {
      const delta = (xs[i] ?? 0) - (xs[i - 1] ?? 0);
      if (delta !== 0) moves.push(Math.sign(delta));
    }
    const reversals = moves.filter((sign, i) => i > 0 && sign !== moves[i - 1]).length;
    expect(reversals, "the enemy never turned round").toBeGreaterThan(0);
  });

  it("shoots — and a player who never moves is eventually hit", () => {
    const game = build(TANKS, { seed: 5 });
    const player = playerBox(game);
    const inPlayer = (x: number, y: number): boolean =>
      x >= player.x && x < player.x + 3 && y >= player.y && y < player.y + 3;
    let sawShot = false;
    for (let i = 0; i < 600 && !game.status().over; i += 1) {
      game.tick();
      const grid = frame(TANKS, game);
      for (let y = 0; y < TANKS.rows; y += 1) {
        for (let x = 0; x < TANKS.cols; x += 1) {
          if ((grid.cells[y * TANKS.cols + x] ?? 0) === 3 && !inPlayer(x, y)) sawShot = true;
        }
      }
    }
    expect(sawShot, "no enemy shot in 600 steps").toBe(true);
    expect(game.status().over, "a stationary player was never hit").toBe(true);
  });

  it("pays for a kill when the player lines a shot up", () => {
    // Played the way a person plays it: drive under whatever is in the top
    // band, turn the barrel up, fire.
    let kills = 0;
    let score = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const game = build(TANKS, { seed });
      for (let i = 0; i < 600 && game.status().cleared === 0 && !game.status().over; i += 1) {
        const target = boxAt(frame(TANKS, game), 2);
        const me = playerBox(game);
        if (target && target.y === 0) {
          if (me.x < target.x) game.input("right");
          else if (me.x > target.x) game.input("left");
          else {
            game.input("up");
            game.input("ok");
          }
        }
        game.tick();
      }
      kills += game.status().cleared;
      score += game.status().score;
    }
    expect(kills, "eight steered runs never landed a shot").toBeGreaterThan(0);
    expect(score).toBeGreaterThan(0);
  });
});
