/**
 * Racing, against the owner's drawing:
 *
 * ```
 *  0
 * 000
 *  0
 * 0 0
 * ```
 *
 * Two lanes, not four; three-wide cars four rows tall, not 3x3 blocks; and the
 * two outer pixels of the bottom row — the wheels — blink while the car moves.
 */
import { describe, expect, it } from "vitest";
import { RACING } from "../src/index.js";
import { at, build, draw, frame } from "./_frame.js";

/** The lane a car's left edge sits at. */
const LANES = [1, 5] as const;

describe("racing — the shape", () => {
  it("draws the player's car exactly as the owner drew it, wheels and all", () => {
    const game = build(RACING);
    const grid = frame(RACING, game);
    expect(draw(grid, LANES[0], RACING.rows - 4, 3, 4)).toEqual([
      " 0 ",
      "000",
      " 0 ",
      "0 0",
    ]);
  });

  it("blinks the wheels — the outer pixels of the bottom row — as the car moves", () => {
    const game = build(RACING);
    const wheels = (): string =>
      draw(frame(RACING, game), LANES[0], RACING.rows - 1, 3, 1)[0] ?? "";
    const body = (): string[] => draw(frame(RACING, game), LANES[0], RACING.rows - 4, 3, 3);
    const first = wheels();
    const bodyFirst = body();
    game.tick();
    const second = wheels();
    // The wheels changed…
    expect(second).not.toBe(first);
    // …and nothing else about the car did.
    expect(body()).toEqual(bodyFirst);
    // …and they come back on the frame after.
    game.tick();
    expect(wheels()).toBe(first);
    expect([first, second].sort()).toEqual(["   ", "0 0"]);
  });
});

describe("racing — two lanes", () => {
  it("gives the player exactly two lanes", () => {
    const game = build(RACING);
    const lane = (): number => {
      const grid = frame(RACING, game);
      for (let x = 0; x < RACING.cols; x += 1) {
        // The nose of the player's car, at the lit level.
        if (at(grid, x, RACING.rows - 4) === 3) return x - 1;
      }
      return -1;
    };
    const seen = new Set<number>();
    seen.add(lane());
    for (let i = 0; i < 6; i += 1) {
      game.input("right");
      seen.add(lane());
    }
    for (let i = 0; i < 6; i += 1) {
      game.input("left");
      seen.add(lane());
    }
    expect([...seen].sort((a, b) => a - b)).toEqual([...LANES]);
  });

  it("never paints anything in the strip between the two lanes", () => {
    const game = build(RACING, { seed: 99 });
    const divider = Math.floor(RACING.cols / 2);
    for (let i = 0; i < 300 && !game.status().over; i += 1) {
      game.tick();
      const grid = frame(RACING, game);
      const strip = draw(grid, divider, 0, 1, RACING.rows).join("");
      expect(strip.trim(), "the strip between the lanes is lit").toBe("");
    }
  });

  it("puts oncoming traffic in the same two lanes, drawn as the same car", () => {
    const game = build(RACING, { seed: 7 });
    let sawTraffic = false;
    for (let i = 0; i < 300 && !game.status().over; i += 1) {
      game.tick();
      const grid = frame(RACING, game);
      for (let y = 0; y + 4 <= RACING.rows - 4; y += 1) {
        for (const lane of LANES) {
          const shape = draw(grid, lane, y, 3, 4, 2);
          if (shape[1] !== "000") continue;
          sawTraffic = true;
          expect(shape[0]).toBe(" 0 ");
          expect(shape[2]).toBe(" 0 ");
        }
      }
    }
    expect(sawTraffic, "no traffic appeared in 300 steps").toBe(true);
  });
});

describe("racing — the drive", () => {
  it("ends the run on contact, and pays for every car survived first", () => {
    const game = build(RACING, { seed: 3 });
    let ticks = 0;
    while (!game.status().over && ticks < 4000) {
      game.tick();
      ticks += 1;
    }
    expect(game.status().over).toBe(true);
    expect(game.status().score).toBeGreaterThan(0);
  });
});
