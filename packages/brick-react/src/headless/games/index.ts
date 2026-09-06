/**
 * The catalogue. Six games, one registry, one order — the order a menu shows
 * them in and the order the README describes them in, so there is no second
 * list anywhere to fall out of step.
 */
import { ARKANOID } from "./arkanoid.js";
import { MEMORY } from "./memory.js";
import { RACING } from "./racing.js";
import { SNAKE } from "./snake.js";
import { TANKS } from "./tanks.js";
import { TETRIS } from "./tetris.js";
import type { BrickGameId, GameDefinition } from "../types.js";

export { ARKANOID } from "./arkanoid.js";
export { MEMORY } from "./memory.js";
export { RACING } from "./racing.js";
export { SNAKE } from "./snake.js";
export { TANKS } from "./tanks.js";
export { TETRIS } from "./tetris.js";

/** Every game, in menu order. */
export const BRICK_GAMES: readonly GameDefinition[] = [
  TETRIS,
  SNAKE,
  ARKANOID,
  RACING,
  TANKS,
  MEMORY,
];

/** Every game id, in menu order. */
export const BRICK_GAME_IDS: readonly BrickGameId[] = BRICK_GAMES.map((g) => g.id);

/**
 * Look one up. Returns `undefined` rather than a default: a host that asked for
 * a game that does not exist has a typo, and silently handing it Tetris hides
 * the typo behind something that works.
 */
export function findGame(id: BrickGameId): GameDefinition | undefined {
  return BRICK_GAMES.find((game) => game.id === id);
}
