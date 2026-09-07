/**
 * Four things a host found the first time it embedded the console for real: a
 * waiting screen whose game is opened by a toggle button OUTSIDE the frame.
 *
 *  1. A game being played must outrank a host's own window shortcut, and in
 *     `"global"` it does not: window listeners fire in registration order, so a
 *     shortcut surface that mounted first silently eats the arrows and the game
 *     gets nothing. `"claim"` is the mode where the thing being played takes its
 *     keys first.
 *  2. A host that opens the console with a click has no way to hand it the
 *     keyboard in the same gesture without going page-wide.
 *  3. The paused veil advertised Enter — a key the host's toggle owns whenever
 *     focus is still sitting on it.
 *  4. The phase was published only as a DOM attribute, so a host had to scrape
 *     it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { I18nProvider, createI18n } from "@stapel/core";
import { BrickConsole } from "../src/default/index.js";
import { createNullHighScoreStore, registerBrickI18n } from "../src/index.js";
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

/**
 * A host shortcut surface that registered BEFORE the console did. Torn down in
 * `afterEach` rather than by the test: a failing assertion would otherwise
 * leave a window listener behind and every test after it would be testing the
 * leak instead of the console.
 */
const hostHandlers: ((event: KeyboardEvent) => void)[] = [];
function hostShortcut(): void {
  const handler = (event: KeyboardEvent): void => {
    event.preventDefault();
  };
  hostHandlers.push(handler);
  window.addEventListener("keydown", handler);
}

function pressOnBody(key: string): void {
  act(() => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

const paint = (): string => screen.getByTestId("brick-screen").innerHTML;

afterEach(() => {
  cleanup();
  matchMediaFor();
  for (const handler of hostHandlers.splice(0)) {
    window.removeEventListener("keydown", handler);
  }
});

describe("who owns the keyboard", () => {
  it('"global" stands down for a host shortcut that registered first — the polite mode', () => {
    matchMediaFor();
    hostShortcut();
    render(
      <BrickConsole game="tetris" seed={1} autoStart captureKeys="global" highScores={store} />
    );
    const before = paint();
    pressOnBody("ArrowLeft");
    expect(paint(), "the polite mode took a key the host had claimed").toBe(before);
  });

  it('"claim" takes its keys first while a run is on, whatever mounted before it', () => {
    matchMediaFor();
    hostShortcut();
    render(
      <BrickConsole game="tetris" seed={1} autoStart captureKeys="claim" highScores={store} />
    );
    const before = paint();
    pressOnBody("ArrowLeft");
    expect(paint(), "the game being played did not get its own arrow").not.toBe(before);
  });

  it('"claim" hands the keys back the moment the run is not on', () => {
    matchMediaFor();
    hostShortcut();
    render(<BrickConsole game="tetris" seed={1} captureKeys="claim" highScores={store} />);
    // Nothing is being played: the host's shortcut is the page's, not the game's.
    const before = paint();
    pressOnBody("ArrowLeft");
    expect(paint()).toBe(before);
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("ready");
  });

  it('"claim" still leaves an editable target its own keystrokes', () => {
    matchMediaFor();
    render(
      <>
        <input data-testid="host-input" />
        <BrickConsole game="tetris" seed={1} autoStart captureKeys="claim" highScores={store} />
      </>
    );
    const before = paint();
    const input = screen.getByTestId("host-input");
    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      input.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(paint()).toBe(before);
  });
});

describe("handing the console the keyboard", () => {
  it("autoFocus puts the keys on the frame in the same gesture that opened it", () => {
    matchMediaFor();
    render(<BrickConsole game="tetris" seed={1} autoStart autoFocus highScores={store} />);
    const frame = screen.getByTestId("brick-console");
    expect(document.activeElement).toBe(frame);
    const before = paint();
    act(() => {
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true })
      );
    });
    expect(paint(), "the focused frame did not read its own arrow").not.toBe(before);
  });

  it("hands the frame back through a ref, for a host that focuses it later", () => {
    matchMediaFor();
    let node: HTMLElement | null = null;
    render(
      <BrickConsole
        game="tetris"
        seed={1}
        highScores={store}
        ref={(element) => {
          node = element;
        }}
      />
    );
    expect(node).toBe(screen.getByTestId("brick-console"));
    act(() => {
      node?.focus();
    });
    expect(document.activeElement).toBe(screen.getByTestId("brick-console"));
  });
});

describe("the paused veil says what is true", () => {
  it("offers Enter only where Enter is actually the console's", async () => {
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);

    matchMediaFor();
    const { unmount } = render(
      <I18nProvider i18n={engine}>
        <BrickConsole game="tetris" seed={1} autoStart captureKeys="global" highScores={store} />
      </I18nProvider>
    );
    pressOnBody("Enter");
    expect(screen.getByTestId("brick-veil").textContent).toContain("Enter");
    unmount();

    // In "focus" the console leaves Enter to whatever the host focused, which
    // is normally the button that opened the panel — so it must not promise it.
    render(
      <I18nProvider i18n={engine}>
        <BrickConsole game="tetris" seed={1} autoStart captureKeys="focus" highScores={store} />
      </I18nProvider>
    );
    const frame = screen.getByTestId("brick-console");
    act(() => {
      frame.focus();
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
    });
    const veil = screen.getByTestId("brick-veil");
    expect(veil.textContent).not.toContain("Enter");
    // …and it is still a real way back, from wherever focus happens to be.
    act(() => {
      veil.click();
    });
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("running");
  });

  it("translates both hints", async () => {
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);
    await act(async () => {
      await engine.setLocale("ru");
    });
    matchMediaFor();
    render(
      <I18nProvider i18n={engine}>
        <BrickConsole game="tetris" seed={1} autoStart captureKeys="focus" highScores={store} />
      </I18nProvider>
    );
    const frame = screen.getByTestId("brick-console");
    act(() => {
      frame.focus();
      frame.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
      );
    });
    expect(screen.getByTestId("brick-veil").textContent).toContain(
      brickI18nBundleRu["brick.screen.hintclick"]
    );
  });
});

describe("the phase is published, not scraped", () => {
  it("reports every phase to the host through onPhaseChange", () => {
    matchMediaFor();
    const onPhaseChange = vi.fn();
    render(
      <BrickConsole game="tetris" seed={1} onPhaseChange={onPhaseChange} highScores={store} />
    );
    expect(onPhaseChange.mock.calls.map((call) => call[0])).toEqual(["ready"]);
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    act(() => {
      screen.getByTestId("brick-button-reset").click();
    });
    expect(onPhaseChange.mock.calls.map((call) => call[0])).toEqual([
      "ready",
      "running",
      "paused",
      "ready",
    ]);
  });

  it("does not report the same phase twice", () => {
    matchMediaFor();
    const onPhaseChange = vi.fn();
    const { rerender } = render(
      <BrickConsole game="tetris" seed={1} onPhaseChange={onPhaseChange} highScores={store} />
    );
    rerender(
      <BrickConsole game="tetris" seed={1} onPhaseChange={onPhaseChange} highScores={store} />
    );
    expect(onPhaseChange).toHaveBeenCalledTimes(1);
  });
});
