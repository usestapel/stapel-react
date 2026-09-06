/**
 * Snake — COMPLETE. Growth on food, death on a wall, death on itself, a level
 * every five bites, and the one rule every naive snake gets wrong: a direction
 * change is QUEUED, not applied. Reading "the current direction" at tick time
 * lets a fast player press up-then-left between two ticks and reverse into
 * their own neck, which looks exactly like the collision code being broken.
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

interface Point {
  readonly x: number;
  readonly y: number;
}

type Direction = "left" | "right" | "up" | "down";

const DELTA: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

const OPPOSITE: Record<Direction, Direction> = {
  left: "right",
  right: "left",
  up: "down",
  down: "up",
};

/** Points per bite, and how many bites buy a level. */
const FOOD_SCORE = 10;
const FOOD_PER_LEVEL = 5;

export const SNAKE_SIZE = 20;

function createSnake(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;

  let body: Point[] = [];
  let direction: Direction = "right";
  /** At most two queued turns: one for this tick, one for the next. */
  let turns: Direction[] = [];
  let food: Point = { x: 0, y: 0 };
  let score = 0;
  let eaten = 0;
  let over = false;
  let grow = 0;

  function occupies(x: number, y: number): boolean {
    return body.some((p) => p.x === x && p.y === y);
  }

  function placeFood(): void {
    // Rejection sampling, bounded: on a nearly-full board the fallback is a
    // linear scan rather than an unbounded loop that can hang a frame.
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const x = Math.floor(ctx.random() * cols);
      const y = Math.floor(ctx.random() * rows);
      if (!occupies(x, y)) {
        food = { x, y };
        return;
      }
    }
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        if (!occupies(x, y)) {
          food = { x, y };
          return;
        }
      }
    }
    over = true; // the board is full — a win, scored as the end of the game
  }

  function reset(): void {
    const midY = Math.floor(rows / 2);
    body = [
      { x: 4, y: midY },
      { x: 3, y: midY },
      { x: 2, y: midY },
    ];
    direction = "right";
    turns = [];
    grow = 0;
    placeFood();
  }

  reset();

  return {
    tick() {
      if (over) return;
      const turn = turns.shift();
      if (turn) direction = turn;
      const head = body[0];
      if (!head) return;
      const delta = DELTA[direction];
      const next: Point = { x: head.x + delta.x, y: head.y + delta.y };
      if (next.x < 0 || next.y < 0 || next.x >= cols || next.y >= rows) {
        over = true;
        return;
      }
      // The tail cell is free THIS tick unless the snake is growing into it.
      const tailIndex = body.length - 1;
      const hitsSelf = body.some(
        (p, i) => p.x === next.x && p.y === next.y && (grow > 0 || i !== tailIndex)
      );
      if (hitsSelf) {
        over = true;
        return;
      }
      body.unshift(next);
      if (next.x === food.x && next.y === food.y) {
        score += FOOD_SCORE;
        eaten += 1;
        grow += 1;
        placeFood();
      }
      if (grow > 0) grow -= 1;
      else body.pop();
    },
    input(action: BrickInput) {
      if (over) return;
      if (action !== "left" && action !== "right" && action !== "up" && action !== "down") {
        return;
      }
      const last = turns[turns.length - 1] ?? direction;
      if (action === last || action === OPPOSITE[last]) return;
      if (turns.length >= 2) return;
      turns.push(action);
    },
    render(grid: MutableGrid) {
      // Food first: the head passing over it is the frame that ends the bite.
      setCell(grid, food.x, food.y, 1);
      for (let i = body.length - 1; i >= 0; i -= 1) {
        const p = body[i];
        if (!p) continue;
        setCell(grid, p.x, p.y, i === 0 ? 3 : 2);
      }
    },
    status(): GameStatus {
      return {
        score,
        level: Math.floor(eaten / FOOD_PER_LEVEL) + 1,
        cleared: eaten,
        over,
        next: null,
      };
    },
  };
}

export const SNAKE: GameDefinition = {
  id: "snake",
  cols: SNAKE_SIZE,
  rows: SNAKE_SIZE,
  stepMs: 180,
  labelKey: "brick.game.snake",
  completeness: "full",
  create: createSnake,
};
