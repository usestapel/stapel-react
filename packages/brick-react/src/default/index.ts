/**
 * The default skin — the opt-in `@stapel/brick-react/default` subpath. Import
 * from here and you get React; import the package root and you get the engine
 * alone.
 */
export { BrickConsole, BRICK_CONSOLE_GAMES } from "./BrickConsole.js";
export type {
  BrickConsoleProps,
  BrickConsoleSize,
  BrickKeyCapture,
} from "./BrickConsole.js";

export { WaitingGame } from "./WaitingGame.js";
export type { WaitingGameProps, WaitingReason } from "./WaitingGame.js";

export { Keypad } from "./Keypad.js";
export type { KeypadProps } from "./Keypad.js";

export { useBrickGame } from "./useBrickGame.js";
export type { BrickGameBag, BrickPhase, UseBrickGameOptions } from "./useBrickGame.js";

export { useBrickT, useCoarsePointer, useMediaQuery, useReducedMotion } from "./hooks.js";
export type { BrickTranslate } from "./hooks.js";
