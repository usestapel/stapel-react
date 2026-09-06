// Shared per-package vitest setup (jsdom suites).
//
// Full CI runs every package's suite in parallel under turbo; on a loaded
// machine testing-library's default 1s `waitFor` budget flakes even though
// the awaited state always arrives. Raising `asyncUtilTimeout` removes the
// timing assumption without slowing green tests — `waitFor` still resolves
// the instant the assertion passes.
import { afterEach, expect } from "vitest";
import { cleanup, configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

/**
 * ── THE GATE: nothing a test starts may still be running when it ends ──────
 *
 * `cleanup()` unmounts what a test RENDERED, and that is not the same thing as
 * what a test STARTED. Work handed to a holder outside the tree — antd's
 * static `message` renders its own React root into the document — survives it,
 * and `@rc-component/notification` counts a toast's seconds down with a
 * `requestAnimationFrame` LOOP. A file whose last toast was raised less than
 * `NOTICE_SECONDS` before its final test ended therefore left a live rAF loop
 * behind; the frame that landed after vitest tore the jsdom environment down
 * ran `window.requestAnimationFrame` against a `window` that no longer
 * existed, and the suite failed with `ReferenceError: window is not defined`
 * out of react-dom having passed every one of its tests. Two of three CI runs,
 * on inputs whose turbo hash had not moved.
 *
 * So the two things a green test may not leave behind are checked here, per
 * test, right after `cleanup()`:
 *
 *  1. a pending animation frame — the shape of the leak above, and the shape
 *     of every "the component is gone but its animation is not" defect;
 *  2. an unhandled rejection — a promise that lost its owner when the tree
 *     went, which is the same defect wearing the async face.
 *
 * Both counters are RESET as they are read, so one leaking test reddens itself
 * and not the twenty after it — a cascading gate is one nobody reads.
 */
const liveFrames = new Set<number>();
const realRaf: typeof requestAnimationFrame | undefined =
  typeof globalThis.requestAnimationFrame === "function"
    ? globalThis.requestAnimationFrame.bind(globalThis)
    : undefined;
const realCaf: typeof cancelAnimationFrame | undefined =
  typeof globalThis.cancelAnimationFrame === "function"
    ? globalThis.cancelAnimationFrame.bind(globalThis)
    : undefined;
if (realRaf !== undefined && realCaf !== undefined) {
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    const id = realRaf((time) => {
      liveFrames.delete(id);
      callback(time);
    });
    liveFrames.add(id);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number): void => {
    liveFrames.delete(id);
    realCaf(id);
  }) as typeof cancelAnimationFrame;
}

// One SINK per worker process, not one per file: vitest gives each test file a
// fresh module registry but reuses the worker, so a plain `process.on` here
// would stack a listener per file and trip Node's max-listeners warning around
// the eleventh. The sink is keyed on `globalThis` — the object the registries
// share — and the listener is attached the first time only.
const SINK = Symbol.for("@stapel/listings-react:test:unhandled-rejections");
const shared = globalThis as unknown as Record<symbol, unknown[] | undefined>;
const unhandled: unknown[] = shared[SINK] ?? [];
if (shared[SINK] === undefined) {
  shared[SINK] = unhandled;
  if (typeof process !== "undefined" && typeof process.on === "function") {
    process.on("unhandledRejection", (reason: unknown) => {
      unhandled.push(reason);
    });
  }
}

// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers — do it explicitly. Without it every
// component a file renders stays mounted for the whole file, and antd's
// timers/frames keep firing into the environment teardown: 11 of 12 packages
// were one slow runner away from `ReferenceError: window is not defined`
// after a suite whose tests all passed (profiles-react, 2026-08-13).
afterEach(() => {
  cleanup();
  // The seller dashboard writes its open tab into the address
  // (`model/tabAddress.ts`), and jsdom's URL is shared by every test in a
  // file: without this, one test switching to Drafts decides which tab the
  // NEXT test's pane opens on. The reset belongs here rather than in that one
  // suite — any component that binds state to the address has the same
  // property.
  if (typeof window !== "undefined" && typeof window.history !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
  // See the gate's header. Read-and-reset, so the count belongs to the test
  // that produced it.
  const frames = liveFrames.size;
  liveFrames.clear();
  const rejections = unhandled.splice(0, unhandled.length);
  expect(
    frames,
    "an animation frame is still scheduled after this test unmounted its tree — " +
      "it will run against a torn-down jsdom (see the gate's header)"
  ).toBe(0);
  expect(
    rejections.map((reason) => String(reason)),
    "a promise rejected with nobody left to catch it"
  ).toEqual([]);
});

// jsdom ships neither `matchMedia` nor `ResizeObserver`; Ant Design (the §54
// default-skin suite) reads both on mount. Minimal no-op polyfills so the DOM
// render is exercised without pulling a heavier test env.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

// jsdom throws "Not implemented" when getComputedStyle is called with a
// pseudo-element arg — Ant Design v6 does exactly that on some component
// mounts (surfaced on the auth-react CI release runner). Drop the second arg
// and delegate to jsdom's real one-arg implementation.
if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((elt: Element) =>
    realGetComputedStyle(elt)) as typeof window.getComputedStyle;
}
