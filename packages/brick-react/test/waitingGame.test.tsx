import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { WaitingGame } from "../src/default/index.js";
import { createNullHighScoreStore } from "../src/index.js";
import { brickI18nBundleEn } from "../src/index.js";

const store = createNullHighScoreStore();

describe("<WaitingGame/>", () => {
  it("shows a caption and a console while the wait is on", () => {
    render(
      <WaitingGame reason="admission" seed={1} autoStart={false} highScores={store} />
    );
    expect(screen.getByTestId("waiting-game").dataset["reason"]).toBe("admission");
    expect(screen.getByTestId("brick-console")).toBeDefined();
    expect(
      screen.getByText(brickI18nBundleEn["brick.wait.admission"] ?? "")
    ).toBeDefined();
  });

  it("says the right sentence for each reason", () => {
    for (const reason of ["admission", "processing", "upload", "queue"] as const) {
      const { unmount } = render(
        <WaitingGame reason={reason} seed={1} autoStart={false} highScores={store} />
      );
      const expected = brickI18nBundleEn[`brick.wait.${reason}`] ?? "";
      expect(expected).not.toBe("");
      expect(screen.getByText(expected)).toBeDefined();
      unmount();
    }
  });

  it("unmounts itself and calls onDone once when the wait ends", () => {
    const onDone = vi.fn();
    const { rerender } = render(
      <WaitingGame
        reason="processing"
        active
        seed={1}
        autoStart={false}
        onDone={onDone}
        highScores={store}
      />
    );
    expect(screen.getByTestId("brick-console")).toBeDefined();
    expect(onDone).not.toHaveBeenCalled();

    rerender(
      <WaitingGame
        reason="processing"
        active={false}
        seed={1}
        autoStart={false}
        onDone={onDone}
        highScores={store}
      />
    );
    expect(screen.queryByTestId("brick-console")).toBeNull();
    expect(screen.queryByTestId("waiting-game")).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);

    // A second render with the wait still over must not fire it again — a host
    // that navigates away in onDone would navigate away twice.
    rerender(
      <WaitingGame
        reason="processing"
        active={false}
        seed={1}
        autoStart={false}
        onDone={onDone}
        highScores={store}
      />
    );
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("arms again for a second wait", () => {
    const onDone = vi.fn();
    const props = {
      reason: "queue" as const,
      seed: 1,
      autoStart: false,
      onDone,
      highScores: store,
    };
    const { rerender } = render(<WaitingGame {...props} active />);
    rerender(<WaitingGame {...props} active={false} />);
    rerender(<WaitingGame {...props} active />);
    rerender(<WaitingGame {...props} active={false} />);
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("passes `paused` through: the console holds without unmounting", () => {
    const props = { reason: "upload" as const, seed: 1, highScores: store };
    const { rerender } = render(<WaitingGame {...props} />);
    const frame = screen.getByTestId("brick-console");
    expect(frame.dataset["phase"]).toBe("running");
    rerender(<WaitingGame {...props} paused />);
    expect(screen.getByTestId("brick-console")).toBe(frame);
    expect(frame.dataset["phase"]).toBe("paused");
    rerender(<WaitingGame {...props} paused={false} />);
    expect(frame.dataset["phase"]).toBe("running");
  });

  it("passes the key contract through: an editable field beside it keeps its keys", () => {
    const { container } = render(
      <div>
        <input data-testid="title" />
        <WaitingGame reason="upload" seed={1} captureKeys="global" highScores={store} />
      </div>
    );
    const input = screen.getByTestId("title");
    const event = new KeyboardEvent("keydown", { key: "r", bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(container.querySelector('[data-phase="running"]')).not.toBeNull();
  });
});
