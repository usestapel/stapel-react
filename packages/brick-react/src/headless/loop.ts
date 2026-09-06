/**
 * The fixed-step loop. `requestAnimationFrame` fires at whatever rate the
 * display and the machine agree on — 60Hz, 120Hz on a recent phone, 8Hz on a
 * throttled background tab — so a game that moved one row per frame would be
 * fifteen times faster on one device than another. The simulation therefore
 * runs on a FIXED step and the frame only contributes elapsed milliseconds:
 * accumulate the delta, run as many whole steps as fit, keep the remainder.
 *
 * Two properties this buys, both tested:
 *
 *  - DETERMINISM. `advance(ms)` is pure arithmetic over the accumulator, so the
 *    same sequence of deltas always produces the same number of steps in the
 *    same order — the frame clock never leaks into the game.
 *  - NO SPIRAL OF DEATH. A tab that was hidden for a minute comes back with a
 *    60 000ms delta. Running 120 steps in one frame would freeze the page and
 *    then do it again; `maxStepsPerFrame` caps the catch-up and DROPS the rest
 *    of the debt, which is what a person expects after a tab was away: the game
 *    is where they left it, not thirty seconds into a piece they never saw.
 */

export interface LoopOptions {
  /** Milliseconds of simulated time per step. */
  readonly stepMs: number;
  /** Run one step of the simulation. */
  readonly onStep: () => void;
  /** Called once per animation frame AFTER its steps, for painting. */
  readonly onFrame?: () => void;
  /** Catch-up cap; the rest of the accumulated debt is discarded. Default 5. */
  readonly maxStepsPerFrame?: number;
  /** Injected for tests and for hosts without a window. */
  readonly requestFrame?: (cb: (timeMs: number) => void) => number;
  readonly cancelFrame?: (handle: number) => void;
  /** Injected clock, for the first frame's baseline. */
  readonly now?: () => number;
}

export interface Loop {
  /** Begin (or resume) driving the simulation from animation frames. */
  start(): void;
  /** Stop. The accumulator is reset, so a resume does not owe old time. */
  stop(): void;
  readonly running: boolean;
  /** Change the step length; the accumulator is kept. */
  setStepMs(ms: number): void;
  /**
   * Feed the loop a wall-clock delta and run the whole steps it buys. Returns
   * how many ran. This is the loop — `start()` is only a caller of it.
   */
  advance(deltaMs: number): number;
}

/** The default catch-up cap (see the file header). */
export const MAX_STEPS_PER_FRAME = 5;

export function createLoop(options: LoopOptions): Loop {
  const maxSteps = options.maxStepsPerFrame ?? MAX_STEPS_PER_FRAME;
  const requestFrame =
    options.requestFrame ??
    (typeof requestAnimationFrame === "function"
      ? (cb: (timeMs: number) => void): number => requestAnimationFrame(cb)
      : null);
  const cancelFrame =
    options.cancelFrame ??
    (typeof cancelAnimationFrame === "function"
      ? (handle: number): void => {
          cancelAnimationFrame(handle);
        }
      : null);
  const now = options.now ?? ((): number => Date.now());

  let stepMs = Math.max(1, options.stepMs);
  let accumulator = 0;
  let handle: number | null = null;
  let lastTime: number | null = null;

  function advance(deltaMs: number): number {
    // A negative or absurd delta is a clock artefact, not elapsed time.
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return 0;
    accumulator += deltaMs;
    let steps = 0;
    while (accumulator >= stepMs && steps < maxSteps) {
      accumulator -= stepMs;
      steps += 1;
      options.onStep();
    }
    // Debt beyond the cap is forgiven rather than carried (file header).
    if (accumulator >= stepMs) accumulator = 0;
    return steps;
  }

  function frame(timeMs: number): void {
    if (handle === null) return;
    const previous = lastTime ?? timeMs;
    lastTime = timeMs;
    advance(timeMs - previous);
    options.onFrame?.();
    if (handle !== null && requestFrame) handle = requestFrame(frame);
  }

  return {
    start() {
      if (handle !== null || !requestFrame) return;
      accumulator = 0;
      lastTime = null;
      // A non-zero placeholder: `handle === null` is what "stopped" means, and
      // some hosts hand out 0 as a legitimate frame id.
      handle = -1;
      handle = requestFrame(frame);
    },
    stop() {
      if (handle === null) return;
      const current = handle;
      handle = null;
      lastTime = null;
      accumulator = 0;
      if (current >= 0 && cancelFrame) cancelFrame(current);
    },
    get running() {
      return handle !== null;
    },
    setStepMs(ms) {
      stepMs = Math.max(1, ms);
    },
    advance(deltaMs) {
      // Keep the injected clock honest about being used: a host that supplies
      // `now` but never starts the loop still gets a stable baseline.
      if (lastTime === null) lastTime = now();
      return advance(deltaMs);
    },
  };
}
