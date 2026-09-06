/**
 * `@stapel/brick-react` — the engine half.
 *
 * Everything exported here is pure TypeScript: no React, no DOM, no clock of
 * its own. That is what lets a game be tested by playing it (seed, presses,
 * steps, assert the board) and what keeps the console skin — which lives on the
 * opt-in `./default` subpath — thin enough to read in one sitting.
 */
export { createRng } from "./headless/rng.js";
export type { Rng } from "./headless/rng.js";

export {
  createGrid,
  clearGrid,
  getCell,
  setCell,
  fillRect,
  gridSignature,
} from "./headless/grid.js";

export { createInputQueue, INPUT_QUEUE_LIMIT } from "./headless/inputQueue.js";
export type { InputQueue } from "./headless/inputQueue.js";

export { createLoop, MAX_STEPS_PER_FRAME } from "./headless/loop.js";
export type { Loop, LoopOptions } from "./headless/loop.js";

export { createBrickSession, stepMsForLevel } from "./headless/session.js";
export type { BrickSession, BrickSessionOptions } from "./headless/session.js";

export {
  BRICK_GAMES,
  BRICK_GAME_IDS,
  findGame,
  ARKANOID,
  MEMORY,
  RACING,
  SNAKE,
  TANKS,
  TETRIS,
} from "./headless/games/index.js";

export {
  createHighScoreStore,
  createNullHighScoreStore,
  HIGHSCORES_NAMESPACE,
} from "./headless/highscores.js";
export type { HighScoreStore } from "./headless/highscores.js";

export type {
  BrickGameId,
  BrickInput,
  CellLevel,
  Game,
  GameCompleteness,
  GameContext,
  GameDefinition,
  GameStatus,
  Grid,
  MutableGrid,
} from "./headless/types.js";

export {
  BRICK_I18N_KEYS,
  brickI18nBundleEn,
  registerBrickI18n,
} from "./i18n/keys.js";
export type { BrickI18nKey } from "./i18n/keys.js";
