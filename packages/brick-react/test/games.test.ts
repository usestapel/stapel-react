import { describe, expect, it } from "vitest";
import {
  BRICK_GAMES,
  BRICK_GAME_IDS,
  createBrickSession,
  findGame,
  gridSignature,
  stepMsForLevel,
} from "../src/index.js";
import type { BrickInput } from "../src/index.js";

const EVERY_BUTTON: readonly BrickInput[] = [
  "left",
  "right",
  "up",
  "down",
  "ok",
  "start",
  "reset",
];

describe("the catalogue", () => {
  it("lists six games, each with a panel, a speed and a label key", () => {
    expect(BRICK_GAMES).toHaveLength(6);
    for (const game of BRICK_GAMES) {
      expect(game.cols).toBeGreaterThan(0);
      expect(game.rows).toBeGreaterThan(0);
      expect(game.stepMs).toBeGreaterThan(0);
      expect(game.labelKey).toBe(`brick.game.${game.id}`);
      expect(["full", "minimal"]).toContain(game.completeness);
    }
    expect(BRICK_GAME_IDS).toEqual(BRICK_GAMES.map((g) => g.id));
  });

  it("says it does not know a game rather than quietly handing back another", () => {
    expect(findGame("tetris")).toBe(BRICK_GAMES[0]);
    // The id is typed, so this is the shape a host with a stale build sends.
    expect(findGame("pong" as never)).toBeUndefined();
  });

  it("speeds up with the level and never past the floor", () => {
    const tetris = BRICK_GAMES[0];
    expect(tetris).toBeDefined();
    if (!tetris) return;
    expect(stepMsForLevel(tetris, 1)).toBe(tetris.stepMs);
    expect(stepMsForLevel(tetris, 5)).toBeLessThan(tetris.stepMs);
    expect(stepMsForLevel(tetris, 99)).toBeGreaterThanOrEqual(60);
  });
});

describe("every game", () => {
  for (const definition of BRICK_GAMES) {
    it(`${definition.id} paints something on its opening frame`, () => {
      const session = createBrickSession({ definition, seed: 11 });
      expect(session.grid.cols).toBe(definition.cols);
      expect(session.grid.rows).toBe(definition.rows);
      expect(gridSignature(session.grid)).not.toBe(
        "0".repeat(definition.cols * definition.rows)
      );
    });

    it(`${definition.id} survives every button and a long run`, () => {
      const session = createBrickSession({ definition, seed: 11 });
      for (let i = 0; i < 400; i += 1) {
        session.press(EVERY_BUTTON[i % EVERY_BUTTON.length] ?? "ok");
        session.step();
        // Every cell stays inside the four levels — a game that wrote a 7 into
        // the panel would render an undefined style and paint nothing.
        for (const cell of session.grid.cells) {
          expect(cell).toBeGreaterThanOrEqual(0);
          expect(cell).toBeLessThanOrEqual(3);
        }
        if (session.status().over) break;
      }
      expect(session.status().score).toBeGreaterThanOrEqual(0);
    });

    it(`${definition.id} plays the same way twice from one seed`, () => {
      const play = (): string => {
        const session = createBrickSession({ definition, seed: 4242 });
        for (let i = 0; i < 60; i += 1) {
          session.press(EVERY_BUTTON[i % 5] ?? "ok");
          session.step();
        }
        return `${gridSignature(session.grid)}|${String(session.status().score)}`;
      };
      expect(play()).toBe(play());
    });
  }
});
