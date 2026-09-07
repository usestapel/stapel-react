/**
 * A session: one game, one loop, one input queue and one panel, wired the way
 * the console wires them — and testable without React, which is the reason it
 * is here rather than inside the component.
 *
 * A press is applied the moment it arrives, and the frame is repainted then:
 * gravity runs on the level's step, a person's hands do not. A held button
 * (`hold`) is handed to the game, which may answer with a faster step
 * (`speed`) — a soft drop, a snake running along its own direction.
 *
 * ── The deal ───────────────────────────────────────────────────────────────
 * With no `seed`, every session — and every reset inside it — deals a DIFFERENT
 * game: different pieces, a different corner for the first tank, a different
 * sequence to remember. A console whose second play is its first play again is
 * a console nobody plays twice.
 *
 * With a `seed`, the run replays exactly, reset included. That is not a
 * fallback: it is what lets a test assert a board, and what lets a demo
 * photograph the same opening frame on every run.
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
  /**
   * Pin the deal. Omit it and the session draws a fresh one per game — the
   * player's case. Pass it and every run from this session replays, cell for
   * cell — the test's and the demo's case.
   */
  readonly seed?: number;
  /** The level the person chose before starting. 1..{@link BRICK_MAX_LEVEL}. */
  readonly startLevel?: number;
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
  /** The level this session's games begin at. */
  readonly startLevel: number;
  /** Tick, render. Returns the status after the step. */
  step(): GameStatus;
  /** Feed elapsed wall-clock time; runs the whole steps it buys. */
  advance(deltaMs: number): number;
  /** Repaint without simulating (after a resume, or on first mount). */
  paint(): void;
  start(): void;
  stop(): void;
  readonly running: boolean;
  /**
   * Throw the game away and deal another. With no pinned seed that is a NEW
   * game; with one — or with an explicit `seed` here — it is the same game
   * again.
   */
  reset(seed?: number): void;
}

/** Each level runs 15% faster than the one before, down to a 60ms floor. */
export const LEVEL_SPEEDUP = 0.85;
/** The highest level the console offers before a game starts. */
export const BRICK_MAX_LEVEL = 10;
/** The fastest step a boosted game may ask for — about one frame. */
const MIN_STEP_MS = 16;

/** The level's step: the base, times the speed-up per level, never past the floor. */
export function stepMsForLevel(definition: GameDefinition, level: number): number {
  const factor = Math.pow(LEVEL_SPEEDUP, Math.max(0, level - 1));
  return Math.max(60, Math.round(definition.stepMs * factor));
}

/** 1..{@link BRICK_MAX_LEVEL}, whatever a host or a stale prop hands over. */
export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  return Math.min(BRICK_MAX_LEVEL, Math.max(1, Math.trunc(level)));
}

/**
 * A seed nobody chose. `Math.random` is exactly right here and nowhere else in
 * the package: this is the ONE place a game may be unpredictable, and every
 * step after it is the seeded generator's.
 */
function freshSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) + 1;
}

export function createBrickSession(options: BrickSessionOptions): BrickSession {
  const definition = options.definition;
  const grid: MutableGrid = createGrid(definition.cols, definition.rows);
  const held = new Set<BrickInput>();
  const startLevel = clampLevel(options.startLevel ?? 1);
  /** The host's pin, if there is one. `undefined` means "deal me a new game". */
  const pinned = options.seed;
  let game: Game = build(pinned ?? freshSeed());
  let notified = false;
  let level = startLevel;
  let stepMs = definition.stepMs;

  function build(withSeed: number): Game {
    const rng = createRng(withSeed);
    return definition.create({
      random: rng.next,
      cols: definition.cols,
      rows: definition.rows,
      startLevel,
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

  level = game.status().level;
  refreshStep();
  paint();

  return {
    definition,
    grid,
    startLevel,
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
      game = build(nextSeed ?? pinned ?? freshSeed());
      notified = false;
      level = game.status().level;
      refreshStep();
      paint();
    },
  };
}
