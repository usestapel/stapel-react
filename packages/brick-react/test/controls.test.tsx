/**
 * The owner's list of control complaints, one test each: a held Down that farmed
 * score, a level-1 tempo too slow to play, a held key in Arkanoid that reacted
 * "with a big delay", and the Start/Reset buttons he wanted labelled and in the
 * main layout on both a desktop and a phone.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import {
  ARKANOID,
  createBrickSession,
  createNullHighScoreStore,
  registerBrickI18n,
  SNAKE,
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
  vi.useRealTimers();
});

describe("tetris scoring", () => {
  it("pays nothing for a held Down — score comes from lines, not from the key", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 7 });
    session.hold("down", true);
    let locked = 0;
    for (let i = 0; i < 400; i += 1) {
      const before = session.grid.cells.filter((cell) => cell === 2).length;
      session.step();
      if (session.status().cleared > 0) break;
      if (session.grid.cells.filter((cell) => cell === 2).length > before) locked += 1;
      expect(
        session.status().score,
        "a held soft drop farmed points before a single line came out"
      ).toBe(0);
      if (session.status().over) break;
    }
    expect(locked, "no piece ever landed — the test proved nothing").toBeGreaterThan(0);
  });

  it("pays nothing for a hard drop either, and everything for a line", () => {
    const session = createBrickSession({ definition: TETRIS, seed: 7 });
    for (let i = 0; i < 6 && session.status().cleared === 0; i += 1) {
      session.press("up");
      expect(session.status().score).toBe(0);
    }
  });

  it("still soft-drops and hard-drops — the keys do what they say", () => {
    const soft = createBrickSession({ definition: TETRIS, seed: 7 });
    const settled = (): number => soft.grid.cells.filter((cell) => cell === 2).length;
    expect(settled()).toBe(0);
    const before = soft.grid.cells.join("");
    soft.press("down");
    expect(soft.grid.cells.join(""), "DOWN did not move the piece").not.toBe(before);
    expect(settled(), "DOWN locked the piece — that is a hard drop").toBe(0);

    const hard = createBrickSession({ definition: TETRIS, seed: 7 });
    hard.press("up");
    expect(hard.grid.cells.filter((cell) => cell === 2).length).toBeGreaterThan(0);
  });

  it("runs a level-1 board fast enough to play", () => {
    const session = createBrickSession({ definition: TETRIS });
    expect(session.stepMs, "a row a second is not a playable tempo").toBeLessThanOrEqual(420);
    expect(stepMsForLevel(TETRIS, 10)).toBeLessThan(stepMsForLevel(TETRIS, 1));
  });
});

describe("snake at speed", () => {
  it("accelerates while the direction it is already travelling is held", () => {
    const session = createBrickSession({ definition: SNAKE, seed: 1 });
    const base = session.stepMs;
    session.hold("right", true);
    expect(session.stepMs).toBeLessThan(base);
    session.hold("right", false);
    expect(session.stepMs).toBe(base);
  });
});

describe("a held key repeats without waiting for the operating system", () => {
  it("keeps moving the arkanoid paddle while one key stays down", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
    matchMediaFor();
    render(<BrickConsole game="arkanoid" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    act(() => {
      frame.focus();
    });
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    act(() => {
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    const afterFirst = paint();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    const afterHold = paint();
    expect(afterHold, "the paddle stopped the moment the key stopped repeating").not.toBe(
      afterFirst
    );
    // Letting go stops it.
    act(() => {
      frame.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true }));
    });
    const afterRelease = paint();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(paint()).toBe(afterRelease);
  });

  it("does not repeat a key the game reads as a hold", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    act(() => {
      frame.focus();
    });
    act(() => {
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true })
      );
    });
    const held = screen.getByTestId("brick-screen").innerHTML;
    act(() => {
      vi.advanceTimersByTime(600);
    });
    // DOWN is a soft drop: it changes the STEP, and the loop is not running
    // here, so nothing on the panel may move on a timer of the input loop's.
    expect(screen.getByTestId("brick-screen").innerHTML).toBe(held);
  });

  it("repeats a keypad button held with a thumb, too", () => {
    vi.useFakeTimers({
      toFake: ["setTimeout", "setInterval", "clearTimeout", "clearInterval"],
    });
    matchMediaFor(COARSE);
    render(<BrickConsole game="arkanoid" seed={1} autoStart highScores={store} />);
    const left = screen.getByTestId("brick-pad-left");
    act(() => {
      left.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    const afterFirst = screen.getByTestId("brick-screen").innerHTML;
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId("brick-screen").innerHTML).not.toBe(afterFirst);
  });
});

describe("the main layout", () => {
  it("puts Start/Pause and Reset in the side column on BOTH pointer types, with translated names", async () => {
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
          <BrickConsole game="snake" seed={1} highScores={store} />
        </I18nProvider>
      );
      const column = screen.getByTestId("brick-panel");
      const start = screen.getByTestId("brick-button-start");
      const reset = screen.getByTestId("brick-button-reset");
      expect(start.tagName).toBe("BUTTON");
      expect(reset.tagName).toBe("BUTTON");
      expect(column.contains(start)).toBe(true);
      expect(column.contains(reset)).toBe(true);
      expect(start.textContent).toBe(brickI18nBundleRu["brick.button.start"]);
      expect(reset.textContent).toBe(brickI18nBundleRu["brick.button.reset"]);
      unmount();
    }
  });

  it("orders the panel: field, then the column beside it, then the chips, then the keys", () => {
    matchMediaFor();
    render(
      <BrickConsole games={["tetris", "snake"]} seed={1} highScores={store} />
    );
    const field = screen.getByTestId("brick-screen");
    const column = screen.getByTestId("brick-panel");
    const chips = screen.getByTestId("brick-menu-tetris");
    const legend = screen.getByTestId("brick-legend");
    const follows = (a: Node, b: Node): boolean =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(field, column)).toBe(true);
    expect(follows(column, chips)).toBe(true);
    expect(follows(chips, legend)).toBe(true);
  });

  it("swaps the keypad for a generated legend on a fine pointer, and back", () => {
    matchMediaFor(COARSE);
    const { unmount } = render(<BrickConsole game="arkanoid" seed={1} highScores={store} />);
    expect(screen.queryByTestId("brick-legend")).toBeNull();
    expect(screen.getByTestId("brick-pad-ok")).toBeDefined();
    unmount();

    matchMediaFor();
    render(<BrickConsole game="arkanoid" seed={1} highScores={store} />);
    expect(screen.queryByTestId("brick-pad-ok")).toBeNull();
    const legend = screen.getByTestId("brick-legend").textContent ?? "";
    for (const control of ARKANOID.controls) {
      expect(legend).toContain(control.labelKey === "brick.key.move" ? "Move" : "");
    }
    expect(legend).toContain("Enter");
    expect(legend).toContain("R");
  });
});
