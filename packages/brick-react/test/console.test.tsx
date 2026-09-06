import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { BrickConsole } from "../src/default/index.js";
import { createNullHighScoreStore } from "../src/index.js";

/**
 * Install a `matchMedia` that answers true for exactly the queries listed. The
 * console asks two questions on mount — is the pointer coarse, and did the
 * person ask for less motion — and this is how a test answers one of them.
 */
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

describe("<BrickConsole/>", () => {
  it("draws the whole panel — one element per pixel of the game's own grid", () => {
    matchMediaFor();
    render(
      <BrickConsole game="tetris" seed={1} highScores={createNullHighScoreStore()} />
    );
    const screenEl = screen.getByTestId("brick-screen");
    // Tetris is 10x20; the panel is the game's shape, not a fixed one.
    expect(screenEl.childElementCount).toBe(200);
    expect(screen.getByTestId("brick-console")).toHaveProperty("dataset");
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("ready");
  });

  it("takes its shape from the game — snake is 20x20 and has no preview", () => {
    matchMediaFor();
    render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    expect(screen.getByTestId("brick-screen").childElementCount).toBe(400);
    expect(screen.queryByTestId("brick-preview")).toBeNull();
  });

  it("shows the keypad ONLY on a coarse pointer", () => {
    matchMediaFor();
    const { unmount } = render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    expect(screen.queryByTestId("brick-pad-left")).toBeNull();
    unmount();

    matchMediaFor(COARSE);
    render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    for (const id of ["left", "right", "up", "down", "ok", "start", "reset"]) {
      const button = screen.getByTestId(`brick-pad-${id}`);
      // Icon-only controls: the name is the only thing a screen reader has.
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
  });

  it("draws a menu only when more than one game is allowed", () => {
    matchMediaFor();
    const onGameChange = vi.fn();
    const { unmount } = render(
      <BrickConsole
        game="snake"
        games={["snake"]}
        seed={1}
        highScores={createNullHighScoreStore()}
      />
    );
    expect(screen.queryByTestId("brick-menu-snake")).toBeNull();
    unmount();

    render(
      <BrickConsole
        game="snake"
        games={["tetris", "snake"]}
        seed={1}
        onGameChange={onGameChange}
        highScores={createNullHighScoreStore()}
      />
    );
    expect(screen.getByTestId("brick-menu-snake").getAttribute("aria-pressed")).toBe(
      "true"
    );
    act(() => {
      screen.getByTestId("brick-menu-tetris").click();
    });
    expect(onGameChange).toHaveBeenCalledWith("tetris");
  });

  it("starts and pauses from the keyboard, and resets with R", () => {
    matchMediaFor();
    render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("ready");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(frame.dataset["phase"]).toBe("running");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(frame.dataset["phase"]).toBe("paused");

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "r" }));
    });
    expect(frame.dataset["phase"]).toBe("ready");
  });

  it("pauses when the window loses focus — nobody is looking", () => {
    matchMediaFor();
    render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    const frame = screen.getByTestId("brick-console");
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    });
    expect(frame.dataset["phase"]).toBe("running");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("lets go of the keyboard when it unmounts", () => {
    matchMediaFor();
    const { unmount } = render(
      <BrickConsole game="snake" seed={1} highScores={createNullHighScoreStore()} />
    );
    unmount();
    // No console is mounted: the key belongs to the page again.
    const event = new KeyboardEvent("keydown", { key: "ArrowLeft", cancelable: true });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
  });
});
