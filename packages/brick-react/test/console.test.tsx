import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import { createNullHighScoreStore, registerBrickI18n } from "../src/index.js";
import { brickI18nBundleRu, registerBrickI18nRu } from "../src/i18n/ru.js";

/** Dispatch one real keydown at `target` and hand back the event to inspect. */
function keydown(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

const store = createNullHighScoreStore();

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
    render(<BrickConsole game="snake" seed={1} captureKeys="global" highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("ready");
    keydown(window, "Enter");
    expect(frame.dataset["phase"]).toBe("running");
    keydown(window, "Enter");
    expect(frame.dataset["phase"]).toBe("paused");
    keydown(window, "r");
    expect(frame.dataset["phase"]).toBe("ready");
  });

  it("pauses when the window loses focus — nobody is looking", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("running");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("lets go of the keyboard when it unmounts", () => {
    matchMediaFor();
    const { unmount } = render(
      <BrickConsole game="snake" seed={1} captureKeys="global" highScores={store} />
    );
    unmount();
    // No console is mounted: the key belongs to the page again.
    expect(keydown(window, "ArrowLeft").defaultPrevented).toBe(false);
  });
});

describe("<BrickConsole/> keys", () => {
  it("reads keys from its own frame while focus is inside it, and from nowhere else (the default)", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    // Focusable, so a click or a Tab lands the keys here.
    expect(frame.tabIndex).toBe(0);

    // Focus elsewhere: the window sees the key, the game does not.
    expect(keydown(document.body, "Enter").defaultPrevented).toBe(false);
    expect(frame.dataset["phase"]).toBe("ready");

    act(() => {
      frame.focus();
    });
    expect(keydown(frame, "Enter").defaultPrevented).toBe(true);
    expect(frame.dataset["phase"]).toBe("running");
    // A key that lands on a child bubbles up to the frame.
    expect(keydown(screen.getByTestId("brick-screen"), "ArrowLeft").defaultPrevented).toBe(
      true
    );
  });

  it("global: an editable target keeps its keystrokes", () => {
    matchMediaFor();
    render(
      <div>
        <input data-testid="title" />
        <textarea data-testid="notes" />
        <div contentEditable data-testid="rich" suppressContentEditableWarning>
          <span data-testid="rich-inner">x</span>
        </div>
        <BrickConsole game="snake" seed={1} captureKeys="global" highScores={store} />
      </div>
    );
    const frame = screen.getByTestId("brick-console");
    for (const id of ["title", "notes", "rich", "rich-inner"]) {
      const target = screen.getByTestId(id);
      expect(keydown(target, "Enter").defaultPrevented, id).toBe(false);
      expect(keydown(target, "ArrowLeft").defaultPrevented, id).toBe(false);
      expect(keydown(target, " ").defaultPrevented, id).toBe(false);
      expect(keydown(target, "r").defaultPrevented, id).toBe(false);
      expect(frame.dataset["phase"], id).toBe("ready");
    }
    // The same keys from a non-editable target are the game's.
    keydown(document.body, "Enter");
    expect(frame.dataset["phase"]).toBe("running");
    expect(keydown(document.body, "r").defaultPrevented).toBe(true);
    expect(frame.dataset["phase"]).toBe("ready");
  });

  it("a focused button keeps Space and Enter — the menu stays reachable by keyboard", () => {
    matchMediaFor();
    render(
      <BrickConsole
        game="snake"
        games={["tetris", "snake"]}
        seed={1}
        captureKeys="global"
        highScores={store}
      />
    );
    const frame = screen.getByTestId("brick-console");
    const button = screen.getByTestId("brick-menu-tetris");
    expect(keydown(button, "Enter").defaultPrevented).toBe(false);
    expect(keydown(button, " ").defaultPrevented).toBe(false);
    expect(frame.dataset["phase"]).toBe("ready");
    // Arrows are still the game's, even from a button.
    expect(keydown(button, "ArrowLeft").defaultPrevented).toBe(true);
  });

  it("global: a focused button or link outside the console keeps Enter and Space while a game runs", () => {
    matchMediaFor();
    render(
      <div>
        <button type="button" data-testid="leave">
          leave
        </button>
        <a href="#top" data-testid="link">
          top
        </a>
        <div role="button" tabIndex={0} data-testid="role-button">
          custom
        </div>
        <BrickConsole game="snake" seed={1} autoStart captureKeys="global" highScores={store} />
      </div>
    );
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("running");
    for (const id of ["leave", "link", "role-button"]) {
      const target = screen.getByTestId(id);
      act(() => {
        (target as HTMLElement).focus();
      });
      expect(keydown(target, "Enter").defaultPrevented, id).toBe(false);
      expect(keydown(target, " ").defaultPrevented, id).toBe(false);
      // The game never saw a pause.
      expect(frame.dataset["phase"], id).toBe("running");
    }
  });

  it("global: a host handler that already claimed the key wins", () => {
    matchMediaFor();
    const claim = (event: KeyboardEvent): void => {
      if (event.key === "ArrowRight") event.preventDefault();
    };
    window.addEventListener("keydown", claim);
    try {
      render(<BrickConsole game="snake" seed={1} captureKeys="global" highScores={store} />);
      const frame = screen.getByTestId("brick-console");
      keydown(window, "Enter");
      expect(frame.dataset["phase"]).toBe("running");
      // ArrowRight was claimed before the console saw it; ArrowLeft was not.
      expect(keydown(window, "ArrowRight").defaultPrevented).toBe(true);
      expect(keydown(window, "ArrowLeft").defaultPrevented).toBe(true);
    } finally {
      window.removeEventListener("keydown", claim);
    }
  });

  it("enabled={false} detaches every key handler in both modes", () => {
    matchMediaFor();
    const { rerender } = render(
      <BrickConsole game="snake" seed={1} captureKeys="global" enabled={false} highScores={store} />
    );
    let frame = screen.getByTestId("brick-console");
    expect(keydown(window, "Enter").defaultPrevented).toBe(false);
    expect(frame.dataset["phase"]).toBe("ready");

    rerender(<BrickConsole game="snake" seed={1} enabled={false} highScores={store} />);
    frame = screen.getByTestId("brick-console");
    expect(frame.hasAttribute("tabindex")).toBe(false);
    expect(keydown(frame, "Enter").defaultPrevented).toBe(false);
    expect(frame.dataset["phase"]).toBe("ready");

    // Enabling again hands the keys back.
    rerender(<BrickConsole game="snake" seed={1} highScores={store} />);
    frame = screen.getByTestId("brick-console");
    expect(keydown(frame, "Enter").defaultPrevented).toBe(true);
    expect(frame.dataset["phase"]).toBe("running");
  });
});

describe("<BrickConsole/> size", () => {
  const columns = (): string =>
    screen.getByTestId("brick-screen").style.gridTemplateColumns;

  it('defaults to "auto": md on a fine pointer, sm on a coarse one', () => {
    matchMediaFor();
    const { unmount } = render(<BrickConsole game="snake" seed={1} highScores={store} />);
    expect(columns()).toBe("repeat(20, 11px)");
    unmount();
    matchMediaFor(COARSE);
    render(<BrickConsole game="snake" seed={1} highScores={store} />);
    expect(columns()).toBe("repeat(20, 7px)");
  });

  it("an explicit size is kept on any pointer", () => {
    matchMediaFor(COARSE);
    render(<BrickConsole game="snake" seed={1} size="lg" highScores={store} />);
    expect(columns()).toBe("repeat(20, 15px)");
  });
});

describe("<BrickConsole/> paused", () => {
  it("stops the tick and keeps the board; clearing it resumes the run it stopped", () => {
    matchMediaFor();
    const { rerender } = render(
      <BrickConsole game="snake" seed={1} autoStart highScores={store} />
    );
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("running");
    const before = screen.getByTestId("brick-screen").innerHTML;

    rerender(<BrickConsole game="snake" seed={1} autoStart paused highScores={store} />);
    expect(frame.dataset["phase"]).toBe("paused");
    expect(screen.getByTestId("brick-screen").innerHTML).toBe(before);
    // Start is the host's while the hold is on.
    keydown(frame, "Enter");
    expect(frame.dataset["phase"]).toBe("paused");

    rerender(<BrickConsole game="snake" seed={1} autoStart paused={false} highScores={store} />);
    expect(frame.dataset["phase"]).toBe("running");
  });

  it("a board the person paused stays paused when the hold clears", () => {
    matchMediaFor();
    const { rerender } = render(
      <BrickConsole game="snake" seed={1} autoStart highScores={store} />
    );
    const frame = screen.getByTestId("brick-console");
    keydown(frame, "Enter");
    expect(frame.dataset["phase"]).toBe("paused");
    rerender(<BrickConsole game="snake" seed={1} autoStart paused highScores={store} />);
    rerender(<BrickConsole game="snake" seed={1} autoStart paused={false} highScores={store} />);
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("mounted under a hold with autoStart, it waits for the hold to clear", () => {
    matchMediaFor();
    const { rerender } = render(
      <BrickConsole game="snake" seed={1} autoStart paused highScores={store} />
    );
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("paused");
    rerender(<BrickConsole game="snake" seed={1} autoStart paused={false} highScores={store} />);
    expect(frame.dataset["phase"]).toBe("running");
  });
});

describe("<BrickConsole/> locale", () => {
  it("reads the host engine's locale once the host registered the bundle", async () => {
    matchMediaFor();
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);
    await engine.setLocale("ru");
    render(
      <I18nProvider i18n={engine}>
        <BrickConsole game="snake" seed={1} highScores={store} />
      </I18nProvider>
    );
    expect(screen.getByTestId("brick-console").getAttribute("aria-label")).toBe(
      brickI18nBundleRu["brick.console.label"]
    );
  });

  it("falls back to its English floor without a provider, never to key names", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} highScores={store} />);
    expect(screen.getByTestId("brick-console").getAttribute("aria-label")).toBe(
      "Brick game console"
    );
  });
});
