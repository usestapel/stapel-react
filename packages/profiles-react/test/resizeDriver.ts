/**
 * A `ResizeObserver` a test can DRIVE.
 *
 * jsdom computes no layout, so every element measures 0x0 — and the revealed
 * phone row decides what it prints from the width of its OWN box on purpose
 * (never from the viewport, because the desktop's buy column is narrower than
 * a phone's dock). Under the suite's usual no-op stub that decision would be
 * untestable, and the one behaviour worth asserting is exactly the one width
 * chooses.
 *
 * So this stub records every observer it creates, and `resizeTo(w)` hands them
 * all a box exactly as a browser layout pass would. `geo-react`'s
 * `test/resizeDriver.ts` is the same shape, for the same reason.
 */
interface DrivableResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly targets: Element[];
}

const observers: DrivableResizeObserver[] = [];

class TestResizeObserver implements DrivableResizeObserver {
  readonly callback: ResizeObserverCallback;
  readonly targets: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push(this);
  }

  observe(target: Element): void {
    this.targets.push(target);
  }

  unobserve(target: Element): void {
    const index = this.targets.indexOf(target);
    if (index >= 0) this.targets.splice(index, 1);
  }

  disconnect(): void {
    this.targets.length = 0;
    const index = observers.indexOf(this);
    if (index >= 0) observers.splice(index, 1);
  }
}

/** Put the drivable stub on `globalThis`; hands back the previous one. */
export function installResizeObserver(): typeof ResizeObserver {
  const previous = globalThis.ResizeObserver;
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
  return previous;
}

/** Forget every observer — one test's box must not reach the next one's row. */
export function resetResizeObservers(): void {
  observers.length = 0;
}

/** Give every live observer a width, as the browser would on a real layout. */
export function resizeTo(width: number, height = 40): void {
  const rect = {
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
  for (const observer of [...observers]) {
    const entries = observer.targets.map(
      (target) =>
        ({
          target,
          contentRect: rect,
          borderBoxSize: [],
          contentBoxSize: [{ inlineSize: width, blockSize: height }],
          devicePixelContentBoxSize: [],
        }) as unknown as ResizeObserverEntry
    );
    if (entries.length > 0) {
      observer.callback(entries, observer as unknown as ResizeObserver);
    }
  }
}
