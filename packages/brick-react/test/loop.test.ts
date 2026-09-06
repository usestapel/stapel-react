import { describe, expect, it, vi } from "vitest";
import {
  createLoop,
  createRng,
  createBrickSession,
  gridSignature,
  MAX_STEPS_PER_FRAME,
  SNAKE,
  TETRIS,
} from "../src/index.js";
import type { BrickInput } from "../src/index.js";

describe("the fixed-step loop", () => {
  it("runs one step per whole step-length and keeps the remainder", () => {
    const steps: number[] = [];
    const loop = createLoop({
      stepMs: 100,
      onStep: () => steps.push(steps.length),
    });
    expect(loop.advance(50)).toBe(0); // banked, not run
    expect(loop.advance(50)).toBe(1); // 100ms exactly
    expect(loop.advance(250)).toBe(2); // 2 steps, 50ms banked
    expect(loop.advance(50)).toBe(1);
    expect(steps).toHaveLength(4);
  });

  it("is a pure function of the delta sequence — the same script, the same steps", () => {
    const script = [16, 16, 17, 240, 3, 9, 100, 1, 1, 1, 900];
    const run = (): number[] => {
      const out: number[] = [];
      const loop = createLoop({ stepMs: 60, onStep: () => undefined });
      for (const delta of script) out.push(loop.advance(delta));
      return out;
    };
    expect(run()).toEqual(run());
  });

  it("caps catch-up instead of spiralling after a hidden tab", () => {
    let steps = 0;
    const loop = createLoop({
      stepMs: 100,
      onStep: () => {
        steps += 1;
      },
    });
    // A minute of debt from a backgrounded tab.
    expect(loop.advance(60_000)).toBe(MAX_STEPS_PER_FRAME);
    expect(steps).toBe(MAX_STEPS_PER_FRAME);
    // And the debt is forgiven, not carried: the next frame is a normal one.
    expect(loop.advance(100)).toBe(1);
  });

  it("ignores a negative or non-finite delta", () => {
    const loop = createLoop({ stepMs: 10, onStep: () => undefined });
    expect(loop.advance(-500)).toBe(0);
    expect(loop.advance(Number.NaN)).toBe(0);
  });

  it("drives frames through the injected scheduler and stops cleanly", () => {
    const frames: ((time: number) => void)[] = [];
    const cancel = vi.fn();
    let steps = 0;
    const loop = createLoop({
      stepMs: 50,
      onStep: () => {
        steps += 1;
      },
      requestFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelFrame: cancel,
    });
    loop.start();
    expect(loop.running).toBe(true);
    frames[0]?.(1000); // the first frame is the baseline: no elapsed time yet
    expect(steps).toBe(0);
    frames[1]?.(1120);
    expect(steps).toBe(2);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(cancel).toHaveBeenCalled();
  });
});

describe("the seeded generator", () => {
  it("replays the same sequence for the same seed and diverges for another", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const draw = (rng: ReturnType<typeof createRng>): number[] =>
      Array.from({ length: 8 }, () => rng.int(100));
    const first = draw(a);
    expect(draw(b)).toEqual(first);
    expect(draw(c)).not.toEqual(first);
  });

  it("stays inside its range, seed 0 included", () => {
    const rng = createRng(0);
    for (let i = 0; i < 200; i += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      expect(rng.int(7)).toBeLessThan(7);
    }
    expect(rng.pick([])).toBeUndefined();
  });
});

describe("a session", () => {
  it("plays the same game twice from the same seed", () => {
    const script: BrickInput[] = ["left", "down", "ok", "right", "down", "down"];
    const play = (): string => {
      const session = createBrickSession({ definition: TETRIS, seed: 7 });
      for (const action of script) {
        session.press(action);
        session.step();
      }
      for (let i = 0; i < 30; i += 1) session.step();
      return gridSignature(session.grid);
    };
    expect(play()).toBe(play());
  });

  it("deals a different game from a different seed", () => {
    const signature = (seed: number): string => {
      const session = createBrickSession({ definition: SNAKE, seed });
      for (let i = 0; i < 5; i += 1) session.step();
      return gridSignature(session.grid);
    };
    expect(signature(1)).not.toBe(signature(99));
  });

  it("reports the game over once, and stops the loop when it does", () => {
    const onGameOver = vi.fn();
    const session = createBrickSession({ definition: TETRIS, seed: 3, onGameOver });
    // Tetris cannot survive 20 rows x 40 pieces of gravity with no input.
    for (let i = 0; i < 4000 && !session.status().over; i += 1) session.step();
    expect(session.status().over).toBe(true);
    for (let i = 0; i < 10; i += 1) session.step();
    expect(onGameOver).toHaveBeenCalledTimes(1);
    expect(session.running).toBe(false);
  });

  it("deals a fresh board on reset", () => {
    const session = createBrickSession({ definition: SNAKE, seed: 5 });
    const opening = gridSignature(session.grid);
    for (let i = 0; i < 6; i += 1) session.step();
    expect(gridSignature(session.grid)).not.toBe(opening);
    session.reset();
    expect(gridSignature(session.grid)).toBe(opening);
  });
});
