/**
 * Memory — MINIMAL but playable. A 4x4 board of eight pairs drawn as 4x4 pixel
 * tiles, a cursor you move with the D-pad, OK to turn a tile, and a pair that
 * stays lit when it matches. Fifty points a pair; the board being cleared ends
 * the game (the score says it was a win).
 *
 * What "minimal" means: one board size, no timer, no penalty for a miss beyond
 * the two ticks the mismatched pair stays up.
 *
 * The pixel alphabet is deliberately dumb: a tile's value is drawn as that many
 * lit pixels in reading order inside the tile. Eight values, eight patterns,
 * nothing to learn.
 */
import { setCell } from "../grid.js";
import type {
  BrickInput,
  Game,
  GameContext,
  GameDefinition,
  GameStatus,
  MutableGrid,
} from "../types.js";

const BOARD = 4;
const TILE = 4;
const PAIR_SCORE = 50;
/** How many ticks a mismatched pair stays face-up before it turns back. */
const PEEK_TICKS = 3;

function createMemory(ctx: GameContext): Game {
  const count = BOARD * BOARD;
  const values: number[] = [];
  for (let i = 0; i < count / 2; i += 1) values.push(i, i);
  // Fisher-Yates on the seeded source: the same seed deals the same board.
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(ctx.random() * (i + 1));
    const a = values[i] ?? 0;
    const b = values[j] ?? 0;
    values[i] = b;
    values[j] = a;
  }

  const matched: boolean[] = new Array<boolean>(count).fill(false);
  let facing: number[] = [];
  let cursor = 0;
  let peek = 0;
  let score = 0;
  let pairs = 0;
  let over = false;

  function tileOrigin(index: number): { x: number; y: number } {
    const col = index % BOARD;
    const row = Math.floor(index / BOARD);
    return { x: col * (TILE + 1), y: row * (TILE + 1) };
  }

  return {
    tick() {
      if (over || peek === 0) return;
      peek -= 1;
      if (peek > 0) return;
      const [a, b] = facing;
      if (a !== undefined && b !== undefined && values[a] === values[b]) {
        matched[a] = true;
        matched[b] = true;
        pairs += 1;
        score += PAIR_SCORE;
        if (pairs * 2 >= count) over = true;
      }
      facing = [];
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") cursor = (cursor + count - 1) % count;
      else if (action === "right") cursor = (cursor + 1) % count;
      else if (action === "up") cursor = (cursor + count - BOARD) % count;
      else if (action === "down") cursor = (cursor + BOARD) % count;
      else if (action === "ok") {
        // A tile already up, an already-matched tile, or a pair still being
        // looked at: all three are "nothing happens", and none of them is an
        // error worth a state of its own.
        if (peek > 0 || matched[cursor] === true || facing.includes(cursor)) return;
        facing.push(cursor);
        if (facing.length === 2) peek = PEEK_TICKS;
      }
    },
    render(grid: MutableGrid) {
      for (let index = 0; index < count; index += 1) {
        const { x, y } = tileOrigin(index);
        const isUp = matched[index] === true || facing.includes(index);
        if (isUp) {
          const value = (values[index] ?? 0) + 1;
          const level = matched[index] === true ? 2 : 3;
          for (let i = 0; i < value; i += 1) {
            setCell(grid, x + (i % TILE), y + Math.floor(i / TILE), level);
          }
        } else {
          // Face down: a hollow frame, so an empty board still reads as tiles.
          for (let i = 0; i < TILE; i += 1) {
            setCell(grid, x + i, y, 1);
            setCell(grid, x + i, y + TILE - 1, 1);
            setCell(grid, x, y + i, 1);
            setCell(grid, x + TILE - 1, y + i, 1);
          }
        }
        if (index === cursor) {
          // The cursor is the tile's top and bottom edge at full strength — a
          // marker that survives whatever the tile itself is drawing.
          for (let i = 0; i < TILE; i += 1) {
            setCell(grid, x + i, y, 3);
            setCell(grid, x + i, y + TILE - 1, 3);
          }
        }
      }
    },
    status(): GameStatus {
      return { score, level: 1, cleared: pairs, over, next: null };
    },
  };
}

export const MEMORY: GameDefinition = {
  id: "memory",
  cols: 20,
  rows: 20,
  stepMs: 260,
  labelKey: "brick.game.memory",
  completeness: "minimal",
  create: createMemory,
};
