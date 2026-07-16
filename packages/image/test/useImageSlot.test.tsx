import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { useImageSlot } from "../src/useImageSlot.js";

// jsdom has no ResizeObserver — a controllable mock stands in.
class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnected = false;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.observed.push(el);
  }

  unobserve(): void {}

  disconnect(): void {
    this.disconnected = true;
  }

  trigger(width: number, height: number): void {
    const entry = {
      target: this.observed[0],
      contentRect: { width, height },
      contentBoxSize: [{ inlineSize: width, blockSize: height }],
    } as unknown as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }
}


function lastObserver(): MockResizeObserver {
  const ro = MockResizeObserver.instances.at(-1);
  if (ro === undefined) {
    throw new Error("no ResizeObserver instance");
  }
  return ro;
}

function Probe(): ReactElement {
  const { ref, size } = useImageSlot<HTMLDivElement>();
  return (
    <div ref={ref} data-testid="slot">
      {size === undefined ? "unmeasured" : `${size.width}x${size.height}`}
    </div>
  );
}

describe("useImageSlot", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is undefined until the first measurement (SSR-safe)", () => {
    render(<Probe />);
    expect(screen.getByTestId("slot").textContent).toBe("unmeasured");
  });

  it("reports the observed size", () => {
    render(<Probe />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(300, 200);
    });
    expect(screen.getByTestId("slot").textContent).toBe("300x200");
  });

  it("high-water-mark: a shrink does not lower the reported size", () => {
    render(<Probe />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(300, 200);
    });
    act(() => {
      ro.trigger(180, 120); // sidebar opened, slot transiently narrower
    });
    expect(screen.getByTestId("slot").textContent).toBe("300x200");
  });

  it("high-water-mark is per-axis: growth on one axis is kept alongside the other's maximum", () => {
    render(<Probe />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(300, 200);
    });
    act(() => {
      ro.trigger(400, 100);
    });
    expect(screen.getByTestId("slot").textContent).toBe("400x200");
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(<Probe />);
    const ro = lastObserver();
    unmount();
    expect(ro.disconnected).toBe(true);
  });

  it("falls back to a single getBoundingClientRect measurement without ResizeObserver", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("ResizeObserver", undefined);
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        width: 111,
        height: 55,
        top: 0,
        left: 0,
        bottom: 55,
        right: 111,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    render(<Probe />);
    expect(screen.getByTestId("slot").textContent).toBe("111x55");
    spy.mockRestore();
  });
});
