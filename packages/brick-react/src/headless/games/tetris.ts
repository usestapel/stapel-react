/**
 * Tetris — COMPLETE. Seven tetrominoes, four rotations each, wall kicks off the
 * walls and off settled blocks, line clears with the classic 100/300/500/800
 * scoring, a level every ten lines, a real next-piece preview, and a game over
 * when a spawn has nowhere to go.
 *
 * Controls: left/right move, OK rotates, DOWN is a soft drop (a row per press;
 * held, the fall runs at ten times the level's step), UP is a hard drop
 * (straight to the landing shadow). Tempo: 360ms a row at level 1, 15% faster
 * per level (306, 260, 221, …) down to the loop's 60ms floor.
 *
 * ── Why a drop pays nothing ────────────────────────────────────────────────
 * Because otherwise it pays for EVERYTHING. A held DOWN is ten rows a second,
 * and a point a row turns the one key a person keeps their thumb on into the
 * fastest way to score — so the game stops being about lines and starts being
 * about leaning on a button. On this console the score comes from the wall
 * coming down and from nowhere else, which is what the handheld did.
 *
 * The board is 10x20, which is the shape the original handheld's LCD had and
 * the reason the console takes the panel size from the GAME rather than the
 * other way round.
 *
 * ── Why the kicks exist ────────────────────────────────────────────────────
 * Without them an I-piece flat against the left wall simply refuses to stand
 * up, and the refusal is silent: the button does nothing and the person
 * concludes the console is broken. The kick table here is deliberately small
 * (in place, one left, one right, two left, two right, one up) rather than full
 * SRS — it recovers every rotation a person actually attempts against a wall or
 * a stack, and it fits in a bundle a waiting screen is allowed to load.
 */
import { setCell } from "../grid.js";
import type {
  BrickInput,
  CellLevel,
  Game,
  GameContext,
  GameDefinition,
  GameStatus,
  MutableGrid,
} from "../types.js";

type Matrix = readonly (readonly number[])[];

/** The seven pieces in their spawn orientation. */
const SHAPES: readonly Matrix[] = [
  // I
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  // O
  [
    [1, 1],
    [1, 1],
  ],
  // T
  [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // S
  [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  // Z
  [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  // J
  [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  // L
  [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
];

/** Kicks tried, in order, when a rotation lands in something. */
const KICKS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
];

/** Points per simultaneous line clear, before the level multiplier. */
const LINE_SCORE: readonly number[] = [0, 100, 300, 500, 800];
/** Lines per level. */
const LINES_PER_LEVEL = 10;
/** How much faster the piece falls while DOWN is held. */
const SOFT_DROP_SPEED = 10;

function rotateCw(matrix: Matrix): Matrix {
  const size = matrix.length;
  const out: number[][] = [];
  for (let y = 0; y < size; y += 1) {
    const row: number[] = [];
    for (let x = 0; x < size; x += 1) row.push(matrix[size - 1 - x]?.[y] ?? 0);
    out.push(row);
  }
  return out;
}

interface Piece {
  readonly shapeIndex: number;
  matrix: Matrix;
  x: number;
  y: number;
}

export const TETRIS_COLS = 10;
export const TETRIS_ROWS = 20;

function createTetris(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;
  const board: CellLevel[] = new Array<CellLevel>(cols * rows).fill(0);

  let score = 0;
  let lines = 0;
  let over = false;
  let piece: Piece | null = null;
  let nextShape = 0;
  let softDrop = false;

  function pickShape(): number {
    return Math.min(SHAPES.length - 1, Math.floor(ctx.random() * SHAPES.length));
  }

  function level(): number {
    return ctx.startLevel + Math.floor(lines / LINES_PER_LEVEL);
  }

  function occupied(x: number, y: number): boolean {
    if (x < 0 || x >= cols || y >= rows) return true;
    if (y < 0) return false; // above the ceiling is free — a spawn hangs there
    return (board[y * cols + x] ?? 0) !== 0;
  }

  function collides(matrix: Matrix, px: number, py: number): boolean {
    for (let y = 0; y < matrix.length; y += 1) {
      const row = matrix[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === 0) continue;
        if (occupied(px + x, py + y)) return true;
      }
    }
    return false;
  }

  function spawn(): void {
    const shapeIndex = nextShape;
    nextShape = pickShape();
    const matrix = SHAPES[shapeIndex] ?? SHAPES[0];
    if (!matrix) return;
    const x = Math.floor((cols - matrix.length) / 2);
    const candidate: Piece = { shapeIndex, matrix, x, y: 0 };
    if (collides(matrix, candidate.x, candidate.y)) {
      over = true;
      piece = null;
      return;
    }
    piece = candidate;
  }

  function clearLines(): void {
    let cleared = 0;
    for (let y = rows - 1; y >= 0; y -= 1) {
      let full = true;
      for (let x = 0; x < cols; x += 1) {
        if ((board[y * cols + x] ?? 0) === 0) {
          full = false;
          break;
        }
      }
      if (!full) continue;
      // Drop everything above by one row, then re-test this same row.
      board.copyWithin(cols, 0, y * cols);
      board.fill(0, 0, cols);
      cleared += 1;
      y += 1;
    }
    if (cleared === 0) return;
    score += (LINE_SCORE[Math.min(cleared, 4)] ?? 0) * level();
    lines += cleared;
  }

  function lock(current: Piece): void {
    for (let y = 0; y < current.matrix.length; y += 1) {
      const row = current.matrix[y];
      if (!row) continue;
      for (let x = 0; x < row.length; x += 1) {
        if (row[x] === 0) continue;
        const bx = current.x + x;
        const by = current.y + y;
        if (by < 0) {
          // Locked partly above the ceiling: the stack has reached the top.
          over = true;
          continue;
        }
        if (bx >= 0 && bx < cols && by < rows) board[by * cols + bx] = 2;
      }
    }
    clearLines();
    piece = null;
    // A lock ends the soft drop: the next piece is not flung down by a key
    // that was held for the previous one.
    softDrop = false;
    if (!over) spawn();
  }

  function move(dx: number): void {
    if (!piece || over) return;
    if (!collides(piece.matrix, piece.x + dx, piece.y)) piece.x += dx;
  }

  function rotate(): void {
    if (!piece || over) return;
    const rotated = rotateCw(piece.matrix);
    for (const kick of KICKS) {
      const [kx, ky] = kick;
      if (!collides(rotated, piece.x + kx, piece.y + ky)) {
        piece.matrix = rotated;
        piece.x += kx;
        piece.y += ky;
        return;
      }
    }
  }

  /** One row of gravity. Returns false when the piece could not fall. */
  function fall(): boolean {
    if (!piece || over) return false;
    if (collides(piece.matrix, piece.x, piece.y + 1)) {
      lock(piece);
      return false;
    }
    piece.y += 1;
    return true;
  }

  function ghostY(current: Piece): number {
    let y = current.y;
    while (!collides(current.matrix, current.x, y + 1)) y += 1;
    return y;
  }

  /** Straight to the landing shadow, and lock there. */
  function hardDrop(): void {
    if (!piece || over) return;
    piece.y = ghostY(piece);
    lock(piece);
  }

  nextShape = pickShape();
  spawn();

  return {
    tick() {
      if (over) return;
      if (!piece) spawn();
      fall();
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") move(-1);
      else if (action === "right") move(1);
      else if (action === "ok") rotate();
      else if (action === "up") hardDrop();
      // Soft drop: one row per press, and no points for the key itself.
      else if (action === "down") fall();
    },
    hold(action: BrickInput, isHeld: boolean) {
      if (action === "down") softDrop = isHeld;
    },
    speed() {
      return softDrop ? SOFT_DROP_SPEED : 1;
    },
    render(grid: MutableGrid) {
      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const value = board[y * cols + x] ?? 0;
          if (value !== 0) setCell(grid, x, y, 2);
        }
      }
      if (!piece) return;
      const gy = ghostY(piece);
      for (let y = 0; y < piece.matrix.length; y += 1) {
        const row = piece.matrix[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] === 0) continue;
          // The landing shadow first, so the piece itself always wins the cell.
          setCell(grid, piece.x + x, gy + y, 1);
        }
      }
      for (let y = 0; y < piece.matrix.length; y += 1) {
        const row = piece.matrix[y];
        if (!row) continue;
        for (let x = 0; x < row.length; x += 1) {
          if (row[x] === 0) continue;
          setCell(grid, piece.x + x, piece.y + y, 3);
        }
      }
    },
    status(): GameStatus {
      const preview: CellLevel[] = new Array<CellLevel>(16).fill(0);
      const matrix = SHAPES[nextShape];
      if (matrix) {
        const offset = matrix.length === 4 ? 0 : 1;
        for (let y = 0; y < matrix.length; y += 1) {
          const row = matrix[y];
          if (!row) continue;
          for (let x = 0; x < row.length; x += 1) {
            if (row[x] === 0) continue;
            const px = x + offset;
            const py = y + (matrix.length === 2 ? 1 : 0);
            if (px < 4 && py < 4) preview[py * 4 + px] = 3;
          }
        }
      }
      return { score, level: level(), cleared: lines, over, next: preview };
    },
  };
}

export const TETRIS: GameDefinition = {
  id: "tetris",
  cols: TETRIS_COLS,
  rows: TETRIS_ROWS,
  stepMs: 360,
  labelKey: "brick.game.tetris",
  completeness: "full",
  controls: [
    { inputs: ["left", "right"], labelKey: "brick.key.move" },
    { inputs: ["ok"], labelKey: "brick.key.rotate" },
    { inputs: ["down"], labelKey: "brick.key.softdrop" },
    { inputs: ["up"], labelKey: "brick.key.harddrop" },
  ],
  // Sliding a piece along the floor is a held key; dropping it is not.
  repeat: ["left", "right"],
  create: createTetris,
};
