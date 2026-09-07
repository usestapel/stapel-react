/**
 * A session: one game, one loop, one input queue and one panel, wired the way
 * the console wires them — and testable without React, which is the reason it
 * is here rather than inside the component.
 *
 * A press is applied the moment it arrives, and the frame is repainted then:
 * gravity runs on the level's step, a person's hands do not. A held button
 * (`hold`) is handed to the game, which may answer with a faster step
 * (`speed`) — a soft drop, a snake running along its own direction.
 */
import { clearGrid, createGrid } from "./grid.js";
import { createLoop } from "./loop.js";
import { createRng } from "./rng.js";
import type { Loop } from "./loop.js";
import type {
  BrickInput,
  Game,
  GameDefinition,
  GameStatus,
  Grid,
  MutableGrid,
} from "./types.js";

export interface BrickSessionOptions {
  readonly definition: GameDefinition;
  /** Seed the games' RNG. Same seed, same game — that is the whole contract. */
  readonly seed?: number;
  /** Called the first step a game reports `over`. */
  readonly onGameOver?: (status: GameStatus) => void;
  /** Called after every step that changed the panel. */
  readonly onFrame?: (grid: Grid, status: GameStatus) => void;
  readonly requestFrame?: (cb: (timeMs: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
}

export interface BrickSession {
  readonly definition: GameDefinition;
  /** The live panel. Repainted in place — read it, never keep the array. */
  readonly grid: Grid;
  status(): GameStatus;
  /** Apply one button press now, and repaint. */
  press(action: BrickInput): void;
  /** A button went down or came up; the game may change its speed. */
  hold(action: BrickInput, held: boolean): void;
  /** Every held button comes up — on blur, on pause, on reset. */
  releaseAll(): void;
  /** The step the loop runs at right now: the level's, divided by the game's speed. */
  readonly stepMs: number;
  /** Tick, render. Returns the status after the step. */
  step(): GameStatus;
  /** Feed elapsed wall-clock time; runs the whole steps it buys. */
  advance(deltaMs: number): number;
  /** Repaint without simulating (after a resume, or on first mount). */
  paint(): void;
  start(): void;
  stop(): void;
  readonly running: boolean;
  /** Throw the game away and deal a new one from `seed`. */
  reset(seed?: number): void;
}

/** Each level runs 15% faster than the one before, down to a 60ms floor. */
export const LEVEL_SPEEDUP = 0.85;
/** The fastest step a boosted game may ask for — about one frame. */
const MIN_STEP_MS = 16;

/** The level's step: the base, times the speed-up per level, never past the floor. */
export function stepMsForLevel(definition: GameDefinition, level: number): number {
  const factor = Math.pow(LEVEL_SPEEDUP, Math.max(0, level - 1));
  return Math.max(60, Math.round(definition.stepMs * factor));
}

export function createBrickSession(options: BrickSessionOptions): BrickSession {
  const definition = options.definition;
  const grid: MutableGrid = createGrid(definition.cols, definition.rows);
  const held = new Set<BrickInput>();
  let seed = options.seed ?? 1;
  let game: Game = build(seed);
  let notified = false;
  let level = 1;
  let stepMs = definition.stepMs;

  function build(withSeed: number): Game {
    const rng = createRng(withSeed);
    return definition.create({
      random: rng.next,
      cols: definition.cols,
      rows: definition.rows,
    });
  }

  function paint(): void {
    clearGrid(grid);
    game.render(grid);
  }

  function refreshStep(): void {
    const speed = Math.max(1, game.speed?.() ?? 1);
    stepMs = Math.max(MIN_STEP_MS, Math.round(stepMsForLevel(definition, level) / speed));
    loop.setStepMs(stepMs);
  }

  /** After anything that may have changed the board: repaint, re-time, report. */
  function settle(): GameStatus {
    paint();
    const status = game.status();
    if (status.level !== level) level = status.level;
    refreshStep();
    if (status.over && !notified) {
      notified = true;
      loop.stop();
      options.onGameOver?.(status);
    }
    options.onFrame?.(grid, status);
    return status;
  }

  function step(): GameStatus {
    game.tick();
    return settle();
  }

  const loop: Loop = createLoop({
    stepMs: definition.stepMs,
    onStep: step,
    ...(options.requestFrame ? { requestFrame: options.requestFrame } : {}),
    ...(options.cancelFrame ? { cancelFrame: options.cancelFrame } : {}),
  });

  paint();

  return {
    definition,
    grid,
    status: () => game.status(),
    press(action) {
      if (game.status().over) return;
      game.input(action);
      settle();
    },
    hold(action, isHeld) {
      if (isHeld) held.add(action);
      else held.delete(action);
      game.hold?.(action, isHeld);
      refreshStep();
    },
    releaseAll() {
      for (const action of held) game.hold?.(action, false);
      held.clear();
      refreshStep();
    },
    get stepMs() {
      return stepMs;
    },
    step,
    advance: (deltaMs) => loop.advance(deltaMs),
    paint,
    start() {
      if (game.status().over) return;
      loop.start();
    },
    stop() {
      loop.stop();
    },
    get running() {
      return loop.running;
    },
    reset(nextSeed) {
      loop.stop();
      held.clear();
      seed = nextSeed ?? seed;
      game = build(seed);
      notified = false;
      level = 1;
      refreshStep();
      paint();
    },
  };
}
