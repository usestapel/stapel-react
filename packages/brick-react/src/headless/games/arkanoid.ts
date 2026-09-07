/**
 * Arkanoid — MINIMAL but playable. A four-wide paddle, one ball on integer
 * steps, four rows of two-wide bricks, wall and paddle bounces, and a game over
 * when the ball passes the paddle. Clearing the wall ends the game as a win
 * (same `over`, the score says which).
 *
 * What "minimal" means here, stated so nobody has to read the code to find out:
 * one ball, one life, one brick layer (no multi-hit bricks), no power-ups, no
 * angle beyond the three the paddle offset gives.
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

const PADDLE_WIDTH = 4;
const BRICK_WIDTH = 2;
const BRICK_ROWS = 4;
const BRICK_TOP = 2;
const BRICK_SCORE = 10;

function createArkanoid(ctx: GameContext): Game {
  const cols = ctx.cols;
  const rows = ctx.rows;
  const bricksPerRow = Math.floor(cols / BRICK_WIDTH);
  const bricks: boolean[] = new Array<boolean>(bricksPerRow * BRICK_ROWS).fill(true);

  const paddleY = rows - 1;
  let paddleX = Math.floor((cols - PADDLE_WIDTH) / 2);
  let ballX = paddleX + Math.floor(PADDLE_WIDTH / 2);
  let ballY = paddleY - 1;
  let dx = ctx.random() < 0.5 ? -1 : 1;
  let dy = -1;
  let score = 0;
  let broken = 0;
  let over = false;

  function brickAt(x: number, y: number): number {
    const row = y - BRICK_TOP;
    if (row < 0 || row >= BRICK_ROWS) return -1;
    const col = Math.floor(x / BRICK_WIDTH);
    if (col < 0 || col >= bricksPerRow) return -1;
    const index = row * bricksPerRow + col;
    return bricks[index] === true ? index : -1;
  }

  return {
    tick() {
      if (over) return;
      let nx = ballX + dx;
      let ny = ballY + dy;

      if (nx < 0 || nx >= cols) {
        dx = -dx;
        nx = ballX + dx;
      }
      if (ny < 0) {
        dy = -dy;
        ny = ballY + dy;
      }

      const hit = brickAt(nx, ny);
      if (hit >= 0) {
        bricks[hit] = false;
        broken += 1;
        score += BRICK_SCORE;
        dy = -dy;
        ny = ballY + dy;
        if (broken >= bricks.length) {
          over = true;
          return;
        }
      }

      if (ny === paddleY) {
        if (nx >= paddleX && nx < paddleX + PADDLE_WIDTH) {
          // Where on the paddle it landed decides the outgoing angle: the two
          // outer cells push the ball sideways, the inner two send it back up.
          const offset = nx - paddleX;
          dx = offset === 0 ? -1 : offset === PADDLE_WIDTH - 1 ? 1 : dx;
          dy = -1;
          ny = ballY + dy;
        } else {
          over = true;
          return;
        }
      }
      if (ny > paddleY) {
        over = true;
        return;
      }
      ballX = nx;
      ballY = ny;
    },
    input(action: BrickInput) {
      if (over) return;
      if (action === "left") paddleX = Math.max(0, paddleX - 1);
      else if (action === "right") paddleX = Math.min(cols - PADDLE_WIDTH, paddleX + 1);
    },
    render(grid: MutableGrid) {
      for (let row = 0; row < BRICK_ROWS; row += 1) {
        for (let col = 0; col < bricksPerRow; col += 1) {
          if (bricks[row * bricksPerRow + col] !== true) continue;
          for (let i = 0; i < BRICK_WIDTH; i += 1) {
            // A one-cell gap inside each brick, so a wall of bricks reads as
            // bricks rather than as a filled rectangle.
            setCell(grid, col * BRICK_WIDTH + i, BRICK_TOP + row, i === 0 ? 2 : 1);
          }
        }
      }
      for (let i = 0; i < PADDLE_WIDTH; i += 1) setCell(grid, paddleX + i, paddleY, 2);
      setCell(grid, ballX, ballY, 3);
    },
    status(): GameStatus {
      return { score, level: 1, cleared: broken, over, next: null };
    },
  };
}

export const ARKANOID: GameDefinition = {
  id: "arkanoid",
  cols: 20,
  rows: 20,
  stepMs: 150,
  labelKey: "brick.game.arkanoid",
  controls: [{ inputs: ["left", "right"], labelKey: "brick.key.move" }],
  completeness: "minimal",
  create: createArkanoid,
};
