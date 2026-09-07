/**
 * The vocabulary of a 4-bit brick console: a grid of shaded pixels, a queue of
 * button presses, and a game that reads the second and paints the first.
 *
 * Nothing in this file knows about React, the DOM, or a clock. That is the
 * point: a game is a pure module (`init/tick/input/render`) whose whole
 * observable behaviour is a deterministic function of its seed and its inputs,
 * so a test can play a hundred frames in a millisecond and get the same board
 * every time.
 */

/**
 * One pixel of the LCD, in the four levels a brick handheld can show: 0 is off
 * (the dead-pixel ghost of the panel), 3 is fully lit. Four levels is what
 * "4-bit" buys us — an unlit cell, a hint, a shadow, and the thing itself —
 * and it is exactly enough to draw a falling piece over a settled board.
 */
export type CellLevel = 0 | 1 | 2 | 3;

/** A read-only view of the panel: `cells[y * cols + x]`. */
export interface Grid {
  readonly cols: number;
  readonly rows: number;
  readonly cells: readonly CellLevel[];
}

/** The panel a game paints into during `render`. */
export interface MutableGrid {
  readonly cols: number;
  readonly rows: number;
  readonly cells: CellLevel[];
}

/**
 * Every button the console has. The original handheld had exactly these, and
 * adding a seventh would mean a control no phone keypad can offer.
 */
export type BrickInput =
  | "left"
  | "right"
  | "up"
  | "down"
  | "ok"
  | "start"
  | "reset";

/** The games this package ships. */
export type BrickGameId =
  | "tetris"
  | "snake"
  | "arkanoid"
  | "racing"
  | "tanks"
  | "memory";

/** What the side panel shows, and what `onGameOver` is handed. */
export interface GameStatus {
  readonly score: number;
  /** 1-based; a game with no difficulty ramp stays at 1. */
  readonly level: number;
  /** Lines/bricks/pairs cleared — whatever this game counts. */
  readonly cleared: number;
  readonly over: boolean;
  /**
   * The 4x4 preview the side panel draws, or `null` for a game that has no
   * "next" (everything but Tetris). Never an empty array pretending to be a
   * preview: an empty box and "this game has no preview" are different facts.
   */
  readonly next: readonly CellLevel[] | null;
}

/** What a game is handed at construction. */
export interface GameContext {
  /**
   * The session's random source, `[0, 1)`. Unseeded it is fresh every session —
   * a second play must not be the first play again — and seeded it replays
   * exactly, which is what every test in this package stands on.
   */
  readonly random: () => number;
  readonly cols: number;
  readonly rows: number;
  /**
   * The level this run counts up from. A game's own `level` is this plus
   * whatever it has earned, so the tempo, the multiplier and (in Memory) the
   * opening sequence all start where they were asked to.
   *
   * READ IT WHEN YOU NEED IT, never once at construction: the session RE-BASES
   * it when the person moves the stepper mid-run, so that the level on screen
   * becomes the level they picked while the board, the piece and the score stay
   * exactly where they are. A game that copies it into a local at construction
   * freezes its tempo at the opening level and the stepper appears dead — the
   * one exception being a game that means "the level I was DEALT at" (Memory's
   * first sequence), which is a fact about the deal and rightly frozen; such a
   * game says so with {@link GameDefinition.levelLockedMidRun}.
   */
  readonly startLevel: number;
}

/**
 * A game. Four methods, no clock of its own: the loop decides WHEN `tick`
 * happens, the console decides WHAT `input` arrives, and `render` is the only
 * way anything leaves.
 */
export interface Game {
  /** One fixed step of the simulation. A no-op once `status().over`. */
  tick(): void;
  /** Apply one button press. */
  input(action: BrickInput): void;
  /**
   * A button went down or came up. Optional: a game with a hold behaviour
   * (a soft drop, a held direction) reads it in `tick` and `speed`.
   */
  hold?(action: BrickInput, held: boolean): void;
  /** How much faster than the level's step to run right now. Optional; 1 when absent. */
  speed?(): number;
  /** Paint the current frame. The grid arrives already cleared to 0. */
  render(grid: MutableGrid): void;
  status(): GameStatus;
}

/** One row of the key legend: the buttons, and the i18n key of what they do here. */
export interface GameControl {
  readonly inputs: readonly BrickInput[];
  readonly labelKey: string;
}

/** How complete a game is — stated per game, in the README and here. */
export type GameCompleteness = "full" | "minimal";

/** A game module: its shape, its speed, and how to start one. */
export interface GameDefinition {
  readonly id: BrickGameId;
  readonly cols: number;
  readonly rows: number;
  /** Milliseconds per simulation step at level 1. */
  readonly stepMs: number;
  /** i18n key of the game's name (`brick.game.<id>`). */
  readonly labelKey: string;
  readonly completeness: GameCompleteness;
  /**
   * The buttons this game reads, in legend order, each with what it does.
   * Start and Reset belong to the console and are not listed.
   */
  readonly controls: readonly GameControl[];
  /**
   * The buttons a held finger should REPEAT, and the reason the console runs a
   * repeat of its own: the operating system's key repeat waits half a second
   * before its first echo, which is the "big delay" a paddle feels. Buttons
   * whose hold means something else to the game (a soft drop, a snake at speed)
   * are deliberately absent — repeating those would fight `speed()`.
   */
  readonly repeat?: readonly BrickInput[];
  /**
   * Why a run of THIS game cannot change level once it is under way, in a
   * developer's words — and absent, the usual case, when it can. Present, it
   * does two things: the session's `setLevel` refuses to re-base the live run,
   * and the console disables its stepper mid-run with this sentence as the
   * `data-disabled-reason`.
   *
   * It is a fact about the game's rules, not a policy: in every game here the
   * level is a tempo and a multiplier and can move under a board that stays,
   * except Memory, where the level IS the sequence being remembered.
   */
  readonly levelLockedMidRun?: string;
  create(ctx: GameContext): Game;
}
