/**
 * The level: chosen BEFORE play with a plus and a minus — the tempo, the score
 * multiplier and (in Memory) the length of the first sequence all move with it
 * — and MOVED DURING PLAY without costing the run its board.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import {
  ARKANOID,
  BRICK_MAX_LEVEL,
  brickI18nBundleEn,
  createBrickSession,
  createNullHighScoreStore,
  MEMORY,
  registerBrickI18n,
  stepMsForLevel,
  TETRIS,
} from "../src/index.js";
import type { GameDefinition } from "../src/index.js";
import { brickI18nBundleRu, registerBrickI18nRu } from "../src/i18n/ru.js";

const store = createNullHighScoreStore();

/**
 * A game that is nothing but a level: a point and a level every tick. The real
 * games earn a level every ten lines or twenty bricks, which is a long run to
 * play inside a unit test, and what wants testing here is the arithmetic of a
 * mid-run change — that the level lands exactly where it was asked to, and that
 * what the run had already earned goes on counting from there.
 */
function ladder(): GameDefinition {
  return {
    // The id only names a high-score row, and this game never reaches a store.
    id: "tetris",
    cols: 4,
    rows: 4,
    stepMs: 200,
    labelKey: "brick.game.tetris",
    completeness: "minimal",
    controls: [],
    create: (ctx) => {
      let ticks = 0;
      return {
        tick: () => {
          ticks += 1;
        },
        input: () => {},
        render: () => {},
        status: () => ({
          score: ticks * 10,
          level: ctx.startLevel + ticks,
          cleared: ticks,
          over: false,
          next: null,
        }),
      };
    },
  };
}

function matchMediaFor(...truthy: readonly string[]): void {
  window.matchMedia = ((query: string) =>
    ({
      matches: truthy.includes(query),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

const COARSE = "(pointer: coarse)";

afterEach(() => {
  cleanup();
  matchMediaFor();
});

describe("the starting level, headless", () => {
  it("starts the game at the level the person chose, at that level's tempo", () => {
    const one = createBrickSession({ definition: TETRIS, seed: 1 });
    expect(one.status().level).toBe(1);
    expect(one.stepMs).toBe(stepMsForLevel(TETRIS, 1));

    const five = createBrickSession({ definition: TETRIS, seed: 1, startLevel: 5 });
    expect(five.status().level).toBe(5);
    expect(five.stepMs).toBe(stepMsForLevel(TETRIS, 5));
    expect(five.stepMs).toBeLessThan(one.stepMs);
  });

  it("is clamped to the levels the console offers", () => {
    expect(createBrickSession({ definition: TETRIS, startLevel: 0 }).status().level).toBe(1);
    expect(
      createBrickSession({ definition: TETRIS, startLevel: 99 }).status().level
    ).toBe(BRICK_MAX_LEVEL);
  });
});

describe("a level picked DURING a run", () => {
  it("moves the run: the score and the board stay, the tempo becomes the new level's", () => {
    const session = createBrickSession({ definition: ARKANOID, seed: 1 });
    // Play until the ball has broken a brick: a score to lose, and a ball a
    // long way from where it was dealt.
    for (let i = 0; i < 200 && session.status().score === 0; i += 1) session.step();
    const scored = session.status().score;
    expect(scored, "the run never scored; the case is not the case").toBeGreaterThan(0);
    const board = session.grid.cells.join("");
    expect(session.stepMs).toBe(stepMsForLevel(ARKANOID, 1));

    session.setLevel(5);

    expect(session.status().score, "the score went with the board").toBe(scored);
    expect(session.grid.cells.join(""), "the board was dealt again").toBe(board);
    expect(session.status().level).toBe(5);
    expect(session.stepMs, "the tempo stayed on the old level").toBe(
      stepMsForLevel(ARKANOID, 5)
    );
    expect(session.stepMs).toBeLessThan(stepMsForLevel(ARKANOID, 1));
  });

  it("lands exactly on the level asked for, and what the run earned keeps counting", () => {
    const session = createBrickSession({ definition: ladder(), seed: 1 });
    session.step();
    session.step();
    session.step();
    expect(session.status().level, "three ticks, three levels earned").toBe(4);

    session.setLevel(2);
    expect(session.status().level, "the earned levels were added on top again").toBe(2);
    expect(session.status().score).toBe(30);
    session.step();
    expect(session.status().level, "the ramp stopped climbing from the new level").toBe(3);
  });

  it("is the level the NEXT deal opens at too", () => {
    const session = createBrickSession({ definition: ladder(), seed: 1 });
    session.step();
    session.step();
    session.step();
    session.setLevel(2);
    session.reset();
    expect(session.status().level, "the fresh deal kept the mid-run base").toBe(2);
    expect(session.startLevel).toBe(2);
  });

  it("is refused, boardlessly, by a game whose level cannot move mid-run", () => {
    expect(MEMORY.levelLockedMidRun, "Memory no longer states its rule").toBeTruthy();
    const session = createBrickSession({ definition: MEMORY, seed: 1, startLevel: 3 });
    session.step();
    session.step();
    const board = session.grid.cells.join("");
    const level = session.status().level;

    session.setLevel(7);

    expect(session.status().level, "the level moved under a sequence already dealt").toBe(
      level
    );
    expect(session.grid.cells.join(""), "the refusal cost the run its board").toBe(board);
  });

  it("says whether a board is being PLAYED, which is what decides the two cases", () => {
    const session = createBrickSession({ definition: ARKANOID, seed: 1 });
    expect(session.played, "a board nobody has touched claims to be a run").toBe(false);
    session.press("left");
    expect(session.played).toBe(true);
    session.reset();
    expect(session.played, "a fresh deal is still someone's run").toBe(false);
    session.step();
    expect(session.played).toBe(true);
  });
});

describe("the starting level, on screen", () => {
  it("is chosen with a plus and a minus before the game starts", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const value = (): string => screen.getByTestId("brick-level").textContent ?? "";
    expect(value()).toBe("1");
    act(() => {
      screen.getByTestId("brick-level-up").click();
    });
    act(() => {
      screen.getByTestId("brick-level-up").click();
    });
    expect(value()).toBe("3");
    act(() => {
      screen.getByTestId("brick-level-down").click();
    });
    expect(value()).toBe("2");
    // The board is dealt again at the new level, and the run has not started.
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("ready");
  });

  it("stops at the ends of the range", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const value = (): string => screen.getByTestId("brick-level").textContent ?? "";
    act(() => {
      screen.getByTestId("brick-level-down").click();
    });
    expect(value()).toBe("1");
    for (let i = 0; i < BRICK_MAX_LEVEL + 3; i += 1) {
      act(() => {
        screen.getByTestId("brick-level-up").click();
      });
    }
    expect(value()).toBe(String(BRICK_MAX_LEVEL));
  });

  it("moves an autostarting run instead of dealing it away", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"], "the run has not begun; the case is not the case").toBe(
      "running"
    );
    const up = screen.getByTestId("brick-level-up") as HTMLButtonElement;
    const down = screen.getByTestId("brick-level-down") as HTMLButtonElement;
    expect(up.disabled, "the plus was dead in the first frame the person ever saw").toBe(false);
    expect(down.disabled).toBe(false);

    // Walk the piece away from spawn, so "the board survived" is a claim with
    // teeth: the opening frame of a seeded deal is the same picture at any level.
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    const opening = paint();
    act(() => {
      frame.focus();
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    const played = paint();
    expect(played, "the arrow never reached the game; the case is not the case").not.toBe(
      opening
    );

    act(() => {
      up.click();
    });
    expect(screen.getByTestId("brick-level").textContent).toBe("2");
    expect(paint(), "the run was dealt away by a plus").toBe(played);
    expect(frame.dataset["phase"]).toBe("running");
  });

  it("moves a run the PERSON started, board, piece and score kept, stepper live", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(frame.dataset["phase"]).toBe("running");
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    act(() => {
      frame.focus();
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    const played = paint();
    const scored = screen.getByTestId("brick-score").textContent;

    const up = screen.getByTestId("brick-level-up") as HTMLButtonElement;
    const down = screen.getByTestId("brick-level-down") as HTMLButtonElement;
    expect(up.disabled, "the stepper locked the person out of the level again").toBe(false);
    expect(down.disabled).toBe(false);
    act(() => {
      up.click();
    });

    expect(screen.getByTestId("brick-level").textContent).toBe("2");
    expect(paint(), "a plus threw away the board the person was playing").toBe(played);
    expect(screen.getByTestId("brick-score").textContent).toBe(scored);
    expect(frame.dataset["phase"]).toBe("running");
    // And the same over a pause: a paused run is still that person's game.
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(frame.dataset["phase"]).toBe("paused");
    act(() => {
      screen.getByTestId("brick-level-up").click();
    });
    expect(screen.getByTestId("brick-level").textContent).toBe("3");
    expect(paint(), "the pause was not treated as a run").toBe(played);
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("still deals a fresh board when there is no run to keep", () => {
    matchMediaFor();
    // No seed: a fresh deal draws a different wall, and Arkanoid's wall is on
    // screen from the first frame — so a board that did NOT change is a board
    // that was never dealt again.
    render(<BrickConsole game="arkanoid" highScores={store} />);
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    const dealt = paint();
    act(() => {
      screen.getByTestId("brick-level-up").click();
    });
    expect(screen.getByTestId("brick-level").textContent).toBe("2");
    expect(paint(), "an idle console kept its old deal").not.toBe(dealt);
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("ready");
  });

  it("is disabled, with the game's own reason, only where the game says it must be", () => {
    matchMediaFor();
    render(<BrickConsole game="memory" seed={1} highScores={store} />);
    const up = (): HTMLButtonElement => screen.getByTestId("brick-level-up") as HTMLButtonElement;
    // Before play the level is the person's to pick, in every game.
    expect(up().disabled).toBe(false);
    expect(up().getAttribute("data-disabled-reason")).toBeNull();

    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("running");
    expect(up().disabled, "Memory let its sequence be re-levelled mid-run").toBe(true);
    expect(
      (screen.getByTestId("brick-level-down") as HTMLButtonElement).disabled
    ).toBe(true);
    // The reason is the GAME's, not a sentence the console made up.
    expect(up().getAttribute("data-disabled-reason")).toBe(MEMORY.levelLockedMidRun);

    // And a game that never claimed the lock is never disabled by it.
    cleanup();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(up().disabled).toBe(false);
  });

  it("carries translated names on both pointer types", async () => {
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);
    await act(async () => {
      await engine.setLocale("ru");
    });
    for (const pointer of [[], [COARSE]]) {
      matchMediaFor(...pointer);
      const { unmount } = render(
        <I18nProvider i18n={engine}>
          <BrickConsole game="tetris" seed={1} highScores={store} />
        </I18nProvider>
      );
      expect(screen.getByTestId("brick-level-up").getAttribute("aria-label")).toBe(
        brickI18nBundleRu["brick.button.levelup"]
      );
      expect(screen.getByTestId("brick-level-down").getAttribute("aria-label")).toBe(
        brickI18nBundleRu["brick.button.leveldown"]
      );
      unmount();
    }
  });

  /**
   * The name a screen reader reads has to survive the case the sighted player
   * is actually in. On an autostarting console the stepper moves the LIVE run,
   * so a name promising a starting level describes a behaviour that is not the
   * one about to happen — the floor bundle is asserted here because it is what
   * a host that registers no locale really ships.
   */
  it("names the stepper for the level over a running board, not for a start", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    expect(
      screen.getByTestId("brick-console").dataset["phase"],
      "the run has not begun; the case is not the case"
    ).toBe("running");
    const up = screen.getByTestId("brick-level-up").getAttribute("aria-label");
    const down = screen.getByTestId("brick-level-down").getAttribute("aria-label");
    expect(up).toBe(brickI18nBundleEn["brick.button.levelup"]);
    expect(down).toBe(brickI18nBundleEn["brick.button.leveldown"]);
    expect(up).not.toMatch(/starting/i);
    expect(down).not.toMatch(/starting/i);
  });
});
