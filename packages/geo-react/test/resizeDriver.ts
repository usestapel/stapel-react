/**
 * A `ResizeObserver` a test can DRIVE.
 *
 * jsdom computes no layout, so every element measures 0x0 — and `TileMap`
 * sizes its tile grid from the ELEMENT's rendered box on purpose (never from
 * the viewport), which in jsdom means it would draw nothing, forever. The
 * fleet's usual no-op stub would therefore make the one behaviour worth
 * testing untestable.
 *
 * So the stub records every observer it creates, and `resizeTo(w, h)` hands
 * them all a box exactly as a browser layout pass would. Installed by
 * `vitest.setup.ts`; imported by the suites that need a map with tiles in it.
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

/** Put the drivable stub on `globalThis`. Called once, from the setup file. */
export function installResizeObserver(): void {
  globalThis.ResizeObserver = TestResizeObserver as unknown as typeof ResizeObserver;
}

/** Forget every observer — one test's map must not receive the next one's box. */
export function resetResizeObservers(): void {
  observers.length = 0;
}

/** Give every live observer a box, as the browser would on a real layout. */
export function resizeTo(width: number, height: number): void {
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
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        }) as unknown as ResizeObserverEntry
    );
    if (entries.length > 0) {
      observer.callback(entries, observer as unknown as ResizeObserver);
    }
  }
}
