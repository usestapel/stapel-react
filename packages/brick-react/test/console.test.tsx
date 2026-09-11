import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import { createNullHighScoreStore, registerBrickI18n } from "../src/index.js";
import type { HighScoreStore } from "../src/index.js";
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

function setVisibility(state: "visible" | "hidden"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

/** One trip away and back: blur + hidden, then visible + focus. */
function awayAndBack(): void {
  act(() => {
    window.dispatchEvent(new Event("blur"));
    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  act(() => {
    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
}

const score = (): string => screen.getByTestId("brick-score").textContent ?? "";

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

/**
 * A `matchMedia` whose answer can CHANGE under a mounted console — a tablet a
 * keyboard is plugged into, a phone handed to a mouse. Returns the switch; the
 * console hears it through the listener `useMediaQuery` registers, which is the
 * half of that hook a stub with a fixed answer never exercises.
 */
function matchMediaSwitch(query: string): (matches: boolean) => void {
  const listeners = new Set<() => void>();
  let on = false;
  window.matchMedia = ((asked: string) =>
    ({
      get matches(): boolean {
        return asked === query && on;
      },
      media: asked,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, fn: () => void): void => {
        if (asked === query) listeners.add(fn);
      },
      removeEventListener: (_type: string, fn: () => void): void => {
        listeners.delete(fn);
      },
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
  return (matches: boolean): void => {
    on = matches;
    act(() => {
      for (const fn of [...listeners]) fn();
    });
  };
}

afterEach(() => {
  cleanup();
  matchMediaFor();
  setVisibility("visible");
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

describe("<BrickConsole/> game chips", () => {
  it("switches games on a real click when the console picks its own game", () => {
    matchMediaFor();
    render(<BrickConsole games={["tetris", "snake", "memory"]} seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["game"]).toBe("tetris");
    expect(screen.getByTestId("brick-screen").childElementCount).toBe(200);
    act(() => {
      screen.getByTestId("brick-menu-snake").click();
    });
    expect(frame.dataset["game"]).toBe("snake");
    expect(screen.getByTestId("brick-screen").childElementCount).toBe(400);
    expect(screen.getByTestId("brick-menu-snake").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByTestId("brick-menu-tetris").getAttribute("aria-pressed")).toBe("false");
  });

  it("opens on defaultGame", () => {
    matchMediaFor();
    render(
      <BrickConsole defaultGame="memory" games={["tetris", "memory"]} seed={1} highScores={store} />
    );
    expect(screen.getByTestId("brick-console").dataset["game"]).toBe("memory");
  });

  it("controlled: game + onGameChange — the click reports, the prop decides", () => {
    matchMediaFor();
    const onGameChange = vi.fn();
    const props = { games: ["tetris", "snake"] as const, seed: 1, highScores: store, onGameChange };
    const { rerender } = render(<BrickConsole {...props} game="tetris" />);
    act(() => {
      screen.getByTestId("brick-menu-snake").click();
    });
    expect(onGameChange).toHaveBeenCalledWith("snake");
    expect(screen.getByTestId("brick-console").dataset["game"]).toBe("tetris");
    rerender(<BrickConsole {...props} game="snake" />);
    expect(screen.getByTestId("brick-console").dataset["game"]).toBe("snake");
  });

  it("a `game` without `onGameChange` seeds the choice and the chips still switch", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" games={["tetris", "snake"]} seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["game"]).toBe("snake");
    act(() => {
      screen.getByTestId("brick-menu-tetris").click();
    });
    expect(frame.dataset["game"]).toBe("tetris");
  });

  /**
   * THE BEST ARRIVES AFTER THE FIRST PAINT, AND THE ASSERT HAS TO WAIT FOR IT.
   *
   * `brick-best` is on screen from the first frame, reading "0": the console
   * renders, THEN asks the store, and the answer lands in a `setBest` outside
   * `act`. So `findByTestId` proves nothing here — it waits for the element,
   * which was never missing, and a `textContent` read taken once at that
   * moment is a snapshot of whichever render happened to have landed.
   *
   * That is the flake this test carried (`expected '0' to be '1200'`, a rerun
   * on most trains): whether the snapshot saw the store's number depended on
   * React's scheduler winning a race against testing-library's one incidental
   * task drain, which it loses on a loaded CI box. Both asserts wait for the
   * VALUE now, exactly as strict as before.
   *
   * And the double answers off a task of its own, the way the real store does
   * — `createHighScoreStore` reads through core's `createRepository`, whose
   * `get` awaits a storage backend. A double resolving in a microtask made the
   * first paint's "0" unobservable on a fast machine and left the race to be
   * discovered on CI.
   */
  it("each game keeps its own best", async () => {
    matchMediaFor();
    const bests: Record<string, number> = { tetris: 1200, snake: 80 };
    const perGame: HighScoreStore = {
      get: async (game) => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        return bests[game] ?? 0;
      },
      record: () => Promise.resolve(false),
      clear: () => Promise.resolve(),
    };
    render(<BrickConsole games={["tetris", "snake"]} seed={1} highScores={perGame} />);
    await waitFor(() => {
      expect(screen.getByTestId("brick-best").textContent).toBe("1200");
    });
    act(() => {
      screen.getByTestId("brick-menu-snake").click();
    });
    await waitFor(() => {
      expect(screen.getByTestId("brick-best").textContent).toBe("80");
    });
  });
});

describe("<BrickConsole/> tetris keys", () => {
  it("ArrowDown / S soft-drop a row; ArrowUp / W hard-drop; Space rotates — and none of them scores", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    act(() => {
      frame.focus();
    });
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    expect(score()).toBe("0");
    const start = paint();
    expect(keydown(frame, "s").defaultPrevented).toBe(true);
    const afterSoft = paint();
    expect(afterSoft, "S did not drop the piece a row").not.toBe(start);
    keydown(frame, "ArrowDown");
    expect(paint()).not.toBe(afterSoft);
    const beforeRotate = paint();
    expect(keydown(frame, " ").defaultPrevented).toBe(true);
    expect(paint(), "Space did not rotate the piece").not.toBe(beforeRotate);
    expect(keydown(frame, "w").defaultPrevented).toBe(true);
    expect(paint()).not.toBe(beforeRotate);
    // Not one point for any of it: the score is the wall coming down.
    expect(score()).toBe("0");
  });

  it("A / D move like the arrows, and a held key stops soft-dropping on key-up", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    const before = screen.getByTestId("brick-screen").innerHTML;
    expect(keydown(frame, "a").defaultPrevented).toBe(true);
    expect(screen.getByTestId("brick-screen").innerHTML).not.toBe(before);
    expect(keydown(frame, "d").defaultPrevented).toBe(true);
    // Key-up is read too: a keyup for a game key is never swallowed and never throws.
    const up = new KeyboardEvent("keyup", { key: "s", bubbles: true, cancelable: true });
    act(() => {
      frame.dispatchEvent(up);
    });
    expect(up.defaultPrevented).toBe(false);
  });

  it("drops the operating system's own key echo — the console repeats on its own timer", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    const repeat = (key: string): void => {
      act(() => {
        frame.dispatchEvent(
          new KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true })
        );
      });
    };
    const before = screen.getByTestId("brick-screen").innerHTML;
    // An echo the OS sends half a second late is not a press: taking it as one
    // would move the piece twice for a key that only went down once.
    repeat("ArrowLeft");
    expect(screen.getByTestId("brick-screen").innerHTML).toBe(before);
    repeat("ArrowUp");
    expect(screen.getByTestId("brick-screen").innerHTML).toBe(before);
    expect(score()).toBe("0");
  });

  it("presses are ignored while the game is not running", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    keydown(frame, "s");
    expect(score()).toBe("0");
  });
});

describe("<BrickConsole/> side column", () => {
  it("Start/Pause and Reset are buttons beside the field, for a mouse", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    const column = screen.getByTestId("brick-panel");
    const start = screen.getByTestId("brick-button-start");
    const resetButton = screen.getByTestId("brick-button-reset");
    expect(column.contains(start)).toBe(true);
    expect(column.contains(resetButton)).toBe(true);
    expect(start.textContent).toBe("Start");
    act(() => {
      start.click();
    });
    expect(frame.dataset["phase"]).toBe("running");
    expect(start.textContent).toBe("Pause");
    act(() => {
      start.click();
    });
    expect(frame.dataset["phase"]).toBe("paused");
    expect(start.textContent).toBe("Resume");
    act(() => {
      resetButton.click();
    });
    expect(frame.dataset["phase"]).toBe("ready");
    expect(start.textContent).toBe("Start");
  });

  it("a paused field says so and resumes on click", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(screen.queryByTestId("brick-veil")).toBeNull();
    keydown(frame, "Enter");
    expect(frame.dataset["phase"]).toBe("paused");
    const veil = screen.getByTestId("brick-veil");
    expect(veil.textContent).toContain("Paused");
    act(() => {
      veil.click();
    });
    expect(frame.dataset["phase"]).toBe("running");
    expect(screen.queryByTestId("brick-veil")).toBeNull();
  });
});

describe("<BrickConsole/> keypad and legend", () => {
  it("a coarse pointer gets the keypad, a fine pointer a legend generated from the game", () => {
    matchMediaFor(COARSE);
    const { unmount } = render(
      <BrickConsole games={["tetris", "snake"]} seed={1} highScores={store} />
    );
    expect(screen.getByTestId("brick-pad-ok")).toBeDefined();
    expect(screen.queryByTestId("brick-legend")).toBeNull();
    unmount();

    matchMediaFor();
    render(<BrickConsole games={["tetris", "snake"]} seed={1} highScores={store} />);
    expect(screen.queryByTestId("brick-pad-ok")).toBeNull();
    const legend = screen.getByTestId("brick-legend");
    expect(legend.textContent).toContain("Hard drop");
    expect(legend.textContent).toContain("Soft drop");
    expect(legend.textContent).toContain("Enter");
    expect(legend.textContent).toContain("Space");
    act(() => {
      screen.getByTestId("brick-menu-snake").click();
    });
    const snakeLegend = screen.getByTestId("brick-legend").textContent ?? "";
    expect(snakeLegend).toContain("hold to speed up");
    expect(snakeLegend).not.toContain("Hard drop");
  });

  it("the frame is described by whichever control surface is on screen", () => {
    matchMediaFor();
    const { unmount } = render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const legend = screen.getByTestId("brick-legend");
    const described = screen.getByTestId("brick-console").getAttribute("aria-describedby");
    expect(described, "the frame announced itself with no word about its keys").toBeTruthy();
    expect(described).toBe(legend.id);
    expect(legend.id).not.toBe("");
    // The description is the key list itself: a label on the legend would stand
    // in for its contents and describe the console as "Keys".
    expect(legend.hasAttribute("aria-label")).toBe(false);
    unmount();

    // On a coarse pointer the same id lands on the keypad — the controls that
    // device actually has, named rather than recited.
    matchMediaFor(COARSE);
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const pad = screen.getByTestId("brick-keypad");
    expect(screen.getByTestId("brick-console").getAttribute("aria-describedby")).toBe(pad.id);
    expect(pad.id).not.toBe("");
    expect(pad.getAttribute("aria-label")).toBe("Game controls");
  });

  it("the keypad's action button is visibly larger than a d-pad key", () => {
    matchMediaFor(COARSE);
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const ok = screen.getByTestId("brick-pad-ok");
    const left = screen.getByTestId("brick-pad-left");
    expect(parseInt(ok.style.minWidth, 10)).toBeGreaterThan(parseInt(left.style.minWidth, 10));
    expect(parseInt(ok.style.minHeight, 10)).toBeGreaterThan(parseInt(left.style.minHeight, 10));
  });

  it("the keypad's Start and Reset are the console's own, not decoration", () => {
    matchMediaFor(COARSE);
    render(<BrickConsole game="tetris" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    const opening = paint();
    expect(frame.dataset["phase"]).toBe("ready");

    act(() => {
      screen.getByTestId("brick-pad-start").click();
    });
    expect(frame.dataset["phase"], "the pad's Start started nothing").toBe("running");

    const down = screen.getByTestId("brick-pad-down");
    act(() => {
      down.dispatchEvent(new Event("pointerdown", { bubbles: true }));
      down.dispatchEvent(new Event("pointerup", { bubbles: true }));
    });
    expect(paint(), "the pad never reached the game; the case is not the case").not.toBe(
      opening
    );

    act(() => {
      screen.getByTestId("brick-pad-reset").click();
    });
    expect(frame.dataset["phase"], "the pad's Reset left the run running").toBe("ready");
    // The deal is pinned, so a board back at its opening frame is a board that
    // was genuinely dealt again.
    expect(paint()).toBe(opening);
  });

  it("follows the pointer CHANGING under a mounted console — a pad plugged in mid-wait", () => {
    const setCoarse = matchMediaSwitch(COARSE);
    render(<BrickConsole game="snake" seed={1} highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    const describedBy = (): string | null => frame.getAttribute("aria-describedby");
    const columns = (): string => screen.getByTestId("brick-screen").style.gridTemplateColumns;
    expect(describedBy()).toBe(screen.getByTestId("brick-legend").id);
    expect(columns()).toBe("repeat(20, 11px)");

    setCoarse(true);
    const pad = screen.getByTestId("brick-keypad");
    expect(screen.queryByTestId("brick-legend"), "the keys stayed listed on a phone").toBeNull();
    expect(pad.id).not.toBe("");
    expect(describedBy(), "the frame still points at a legend that is gone").toBe(pad.id);
    expect(columns(), "the pixels stayed laptop-sized on a touch screen").toBe(
      "repeat(20, 7px)"
    );

    setCoarse(false);
    expect(screen.queryByTestId("brick-keypad")).toBeNull();
    expect(describedBy()).toBe(screen.getByTestId("brick-legend").id);
    expect(columns()).toBe("repeat(20, 11px)");
  });

  it("the keypad presses on pointer-down, and the click that follows is not a second press", () => {
    matchMediaFor(COARSE);
    render(<BrickConsole game="tetris" seed={1} autoStart highScores={store} />);
    const down = screen.getByTestId("brick-pad-down");
    const paint = (): string => screen.getByTestId("brick-screen").innerHTML;
    const start = paint();
    act(() => {
      down.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    });
    const afterDown = paint();
    expect(afterDown, "the thumb landing did not drop the piece").not.toBe(start);
    act(() => {
      down.dispatchEvent(new Event("pointerup", { bubbles: true }));
      down.click();
    });
    expect(paint(), "the click after the pointer pressed a second time").toBe(afterDown);
    // A click no pointer preceded — a screen reader's activation — still presses.
    act(() => {
      down.click();
    });
    expect(paint()).not.toBe(afterDown);
  });
});

describe("<BrickConsole/> coming back", () => {
  it("a run the blur and the hidden tab stopped starts again on visible + focus", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("running");
    act(() => {
      window.dispatchEvent(new Event("blur"));
      setVisibility("hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(frame.dataset["phase"]).toBe("paused");
    act(() => {
      setVisibility("visible");
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(frame.dataset["phase"]).toBe("running");
  });

  it("a board the person paused stays paused across the same trip", () => {
    matchMediaFor();
    render(<BrickConsole game="snake" seed={1} autoStart highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    keydown(frame, "Enter");
    expect(frame.dataset["phase"]).toBe("paused");
    awayAndBack();
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("resumeOnReturn={false} leaves the board where the blur left it", () => {
    matchMediaFor();
    render(
      <BrickConsole game="snake" seed={1} autoStart resumeOnReturn={false} highScores={store} />
    );
    const frame = screen.getByTestId("brick-console");
    awayAndBack();
    expect(frame.dataset["phase"]).toBe("paused");
  });

  it("a host hold is not undone by coming back", () => {
    matchMediaFor();
    const { rerender } = render(
      <BrickConsole game="snake" seed={1} autoStart highScores={store} />
    );
    const frame = screen.getByTestId("brick-console");
    act(() => {
      window.dispatchEvent(new Event("blur"));
    });
    rerender(<BrickConsole game="snake" seed={1} autoStart paused highScores={store} />);
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(frame.dataset["phase"]).toBe("paused");
  });
});
