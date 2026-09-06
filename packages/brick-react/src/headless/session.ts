/**
 * A session: one game, one loop, one input queue and one panel, wired the way
 * the console wires them — and testable without React, which is the reason it
 * is here rather than inside the component.
 *
 * The step order is fixed and it matters: DRAIN inputs, then TICK, then RENDER.
 * Ticking before draining means a press made during a frame is applied to the
 * board the person has already stopped looking at; rendering before ticking
 * paints a frame the simulation has already left.
 */
import { clearGrid, createGrid } from "./grid.js";
import { createInputQueue } from "./inputQueue.js";
import { createLoop } from "./loop.js";
import { createRng } from "./rng.js";
import type { InputQueue } from "./inputQueue.js";
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
  /** Queue a button press (applied at the next step). */
  press(action: BrickInput): void;
  /** Drain, tick, render. Returns the status after the step. */
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

/** How much faster each level runs, as a multiplier on the base step. */
export function stepMsForLevel(definition: GameDefinition, level: number): number {
  const factor = Math.pow(0.86, Math.max(0, level - 1));
  return Math.max(60, Math.round(definition.stepMs * factor));
}

export function createBrickSession(options: BrickSessionOptions): BrickSession {
  const definition = options.definition;
  const grid: MutableGrid = createGrid(definition.cols, definition.rows);
  const queue: InputQueue = createInputQueue();
  let seed = options.seed ?? 1;
  let game: Game = build(seed);
  let notified = false;
  let level = 1;

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

  function step(): GameStatus {
    for (const action of queue.drain()) game.input(action);
    game.tick();
    paint();
    const status = game.status();
    if (status.level !== level) {
      level = status.level;
      loop.setStepMs(stepMsForLevel(definition, level));
    }
    if (status.over && !notified) {
      notified = true;
      loop.stop();
      options.onGameOver?.(status);
    }
    options.onFrame?.(grid, status);
    return status;
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
      queue.push(action);
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
      queue.clear();
      seed = nextSeed ?? seed;
      game = build(seed);
      notified = false;
      level = 1;
      loop.setStepMs(definition.stepMs);
      paint();
    },
  };
}
