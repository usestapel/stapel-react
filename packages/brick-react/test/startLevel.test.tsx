/**
 * The starting level: chosen BEFORE play, with a plus and a minus, and it is
 * the level the game actually starts at — the tempo, the score multiplier and
 * (in Memory) the length of the first sequence all move with it.
 */
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import {
  BRICK_MAX_LEVEL,
  createBrickSession,
  createNullHighScoreStore,
  registerBrickI18n,
  stepMsForLevel,
  TETRIS,
} from "../src/index.js";
import { brickI18nBundleRu, registerBrickI18nRu } from "../src/i18n/ru.js";

const store = createNullHighScoreStore();

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

  it("cannot be changed once the game is running", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    const up = screen.getByTestId("brick-level-up");
    expect(up).toBeInstanceOf(HTMLButtonElement);
    expect((up as HTMLButtonElement).disabled).toBe(true);
    expect(
      (screen.getByTestId("brick-level-down") as HTMLButtonElement).disabled
    ).toBe(true);
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
});
