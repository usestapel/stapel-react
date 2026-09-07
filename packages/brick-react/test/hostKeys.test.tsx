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

  it("gives the focus back to whatever it took it from when it unmounts", () => {
    matchMediaFor();
    render(
      <div>
        <button type="button" data-testid="host-toggle">
          play
        </button>
        <div data-testid="slot" />
      </div>
    );
    const toggle = screen.getByTestId("host-toggle");
    act(() => {
      toggle.focus();
    });
    const panel = render(
      <BrickConsole game="tetris" seed={1} autoStart autoFocus highScores={store} />,
      { container: screen.getByTestId("slot") }
    );
    expect(document.activeElement).toBe(screen.getByTestId("brick-console"));
    act(() => {
      panel.unmount();
    });
    expect(
      document.activeElement,
      "the keyboard-only person was dropped at the top of the document"
    ).toBe(toggle);
  });

  it("leaves focus alone when it never took it, and when the person moved on", () => {
    matchMediaFor();
    render(
      <div>
        <button type="button" data-testid="host-toggle">
          play
        </button>
        <button type="button" data-testid="elsewhere">
          elsewhere
        </button>
        <div data-testid="slot-a" />
        <div data-testid="slot-b" />
      </div>
    );
    const toggle = screen.getByTestId("host-toggle");
    const elsewhere = screen.getByTestId("elsewhere");

    // Never moved focus: nothing to give back, and nothing taken from anyone.
    act(() => {
      toggle.focus();
    });
    const plain = render(<BrickConsole game="tetris" seed={1} highScores={store} />, {
      container: screen.getByTestId("slot-a"),
    });
    expect(document.activeElement).toBe(toggle);
    act(() => {
      elsewhere.focus();
    });
    act(() => {
      plain.unmount();
    });
    expect(document.activeElement).toBe(elsewhere);

    // Took focus, but the person has since focused something of their own —
    // that focus is theirs, not the package's to take back.
    act(() => {
      toggle.focus();
    });
    const focused = render(
      <BrickConsole game="tetris" seed={1} autoStart autoFocus highScores={store} />,
      { container: screen.getByTestId("slot-b") }
    );
    expect(document.activeElement).toBe(screen.getByTestId("brick-console"));
    act(() => {
      elsewhere.focus();
    });
    act(() => {
      focused.unmount();
    });
    expect(document.activeElement).toBe(elsewhere);
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
  it("offers Enter where Enter is, not where the capture mode is", () => {
    const engine = createI18n({ locale: "en" });
    registerBrickI18n(engine);
    registerBrickI18nRu(engine);

    matchMediaFor();
    render(
      <I18nProvider i18n={engine}>
        <div>
          <button type="button" data-testid="host-toggle">
            open
          </button>
          <BrickConsole game="tetris" seed={1} autoStart captureKeys="claim" highScores={store} />
        </div>
      </I18nProvider>
    );
    const toggle = screen.getByTestId("host-toggle");
    act(() => {
      toggle.focus();
    });
    // The console is revealed by a host toggle, so focus is still on that
    // toggle — where the package's own guarantee gives Enter to the BUTTON.
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(document.activeElement, "the click moved focus; the test is not the case").toBe(
      toggle
    );
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("paused");
    expect(
      screen.getByTestId("brick-veil").textContent,
      "the veil promised a key the focused host toggle keeps"
    ).not.toContain("Enter");

    // Move focus into the console — onto the Start button a real browser
    // focuses when it is clicked — and the same veil, in the same mode, may
    // promise Enter: the key now activates the console's own control.
    act(() => {
      screen.getByTestId("brick-button-start").focus();
    });
    expect(screen.getByTestId("brick-veil").textContent).toContain("Enter");

    // …and the click is a real way back from wherever focus happens to be.
    act(() => {
      screen.getByTestId("brick-veil").click();
    });
    expect(screen.getByTestId("brick-console").dataset["phase"]).toBe("running");
  });

  it('"focus" outside the frame is still a click-only veil', () => {
    matchMediaFor();
    render(
      <div>
        <button type="button" data-testid="host-toggle">
          open
        </button>
        <BrickConsole game="tetris" seed={1} autoStart captureKeys="focus" highScores={store} />
      </div>
    );
    act(() => {
      screen.getByTestId("host-toggle").focus();
    });
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(screen.getByTestId("brick-veil").textContent).not.toContain("Enter");
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
        <div>
          <button type="button" data-testid="host-toggle">
            open
          </button>
          <BrickConsole game="tetris" seed={1} autoStart captureKeys="claim" highScores={store} />
        </div>
      </I18nProvider>
    );
    act(() => {
      screen.getByTestId("host-toggle").focus();
    });
    act(() => {
      screen.getByTestId("brick-button-start").click();
    });
    expect(screen.getByTestId("brick-veil").textContent).toContain(
      brickI18nBundleRu["brick.screen.hintclick"]
    );
    act(() => {
      screen.getByTestId("brick-button-start").focus();
    });
    expect(screen.getByTestId("brick-veil").textContent).toContain(
      brickI18nBundleRu["brick.screen.hint"]
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
