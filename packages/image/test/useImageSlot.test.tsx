import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { useDevicePixelRatio, useImageSlot } from "../src/useImageSlot.js";

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

function Probe(props: { settleMs?: number }): ReactElement {
  const { ref, size } = useImageSlot<HTMLDivElement>(
    props.settleMs === undefined ? undefined : { settleMs: props.settleMs }
  );
  return (
    <div ref={ref} data-testid="slot">
      {size === undefined ? "unmeasured" : `${size.width}x${size.height}`}
    </div>
  );
}

/** Past the trailing debounce, so whatever the last observed size was is the
 * one now reported. */
function settle(): void {
  act(() => {
    vi.advanceTimersByTime(200);
  });
}

function reported(): string | null {
  return screen.getByTestId("slot").textContent;
}

describe("useImageSlot", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("is undefined until the first measurement (SSR-safe)", () => {
    render(<Probe />);
    expect(reported()).toBe("unmeasured");
  });

  it("reports the observed size", () => {
    render(<Probe />);
    act(() => {
      lastObserver().trigger(300, 200);
    });
    settle();
    expect(reported()).toBe("300x200");
  });

  // ── The high-water mark is GONE, deliberately ──────────────────────────
  //
  // It used to be enforced here, which turned the measurement into a maximum:
  // an element that laid out wide and settled narrow reported the wide box
  // for ever and asked the CDN for a tier it could not use. "Never downgrade
  // what is already painted" is a rule about the network and now lives in
  // <Image>'s load effect, which is the only layer that knows what is on
  // screen (see `never downgrades: a shrink keeps the already-rendered tier`
  // in image.test.tsx — the guarantee itself is still tested, one layer up).
  it("reports a SHRINK — a slot that got smaller is smaller", () => {
    render(<Probe />);
    act(() => {
      lastObserver().trigger(300, 200);
    });
    settle();
    act(() => {
      lastObserver().trigger(180, 120);
    });
    settle();
    expect(reported()).toBe("180x120");
  });

  it("never reports a box that never existed (the two axes are one measurement)", () => {
    // The per-axis high-water mark could report the widest width the element
    // ever had beside the tallest height it ever had — a box with an aspect
    // ratio nothing was ever laid out at. `chooseVariant` derives the limiting
    // AXIS from that aspect, so the wrong pair picks the wrong axis outright.
    render(<Probe />);
    act(() => {
      lastObserver().trigger(300, 200);
    });
    settle();
    act(() => {
      lastObserver().trigger(400, 100);
    });
    settle();
    expect(reported()).toBe("400x100");
  });

  it("coalesces a drag: only the size the element settles at is reported", () => {
    render(<Probe />);
    const ro = lastObserver();
    act(() => {
      ro.trigger(300, 200);
    });
    settle();
    // A window-edge drag: dozens of intermediate widths, each of which would
    // otherwise be a tier decision and potentially a fetch.
    act(() => {
      for (let w = 300; w <= 900; w += 20) {
        ro.trigger(w, 200);
      }
    });
    // Nothing reported yet — the element has not held still.
    expect(reported()).toBe("300x200");
    settle();
    expect(reported()).toBe("900x200");
  });

  it("ignores a zero-sided box rather than pinning an axis at 0", () => {
    // Pre-layout, or display:none. The guard this replaces used `&&`, so a
    // `200 x 0` box got through and froze the height at zero.
    render(<Probe />);
    act(() => {
      lastObserver().trigger(200, 0);
    });
    settle();
    expect(reported()).toBe("unmeasured");
    act(() => {
      lastObserver().trigger(200, 150);
    });
    settle();
    expect(reported()).toBe("200x150");
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
    expect(reported()).toBe("111x55");
    spy.mockRestore();
  });
});

function DprProbe(): ReactElement {
  return <span data-testid="dpr">{String(useDevicePixelRatio())}</span>;
}

describe("useDevicePixelRatio", () => {
  let listeners: (() => void)[] = [];

  beforeEach(() => {
    listeners = [];
    vi.stubGlobal("devicePixelRatio", 1);
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: true,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: (_: string, l: () => void) => listeners.push(l),
          removeEventListener: (_: string, l: () => void) => {
            listeners = listeners.filter((x) => x !== l);
          },
          dispatchEvent: () => false,
        }) as unknown as MediaQueryList
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the current ratio", () => {
    render(<DprProbe />);
    expect(screen.getByTestId("dpr").textContent).toBe("1");
  });

  it("re-reads it when it changes — a window dragged to a Retina display", () => {
    // Read once at mount, the slot keeps its 1x tier after the move and stays
    // visibly soft on a screen with twice the pixels.
    render(<DprProbe />);
    vi.stubGlobal("devicePixelRatio", 3);
    act(() => {
      for (const l of [...listeners]) l();
    });
    expect(screen.getByTestId("dpr").textContent).toBe("3");
  });
});
