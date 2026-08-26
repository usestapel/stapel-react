/**
 * jsdom ships no `window.matchMedia`, and every antd surface in this package
 * asks for one (the responsive observer, `SkinDialog`'s sheet-vs-modal query,
 * `SkinTheme`'s 44px phone controls). Without a stub the demo smoke test dies
 * inside antd rather than in anything this pair wrote.
 *
 * The default answers a DESKTOP viewport. Tests that care about the phone board
 * call `setViewport(390)` from `./helpers.js`, which replaces this with a query
 * that actually evaluates `(min-width: N)` against a chosen width — so "is it a
 * sheet? is it one column?" is a decision the test makes, never one it inherits
 * from a stub that says `false` to everything.
 *
 * `ResizeObserver` is the second jsdom gap: dnd-kit measures droppable rects
 * through one, and antd's `Select` uses it for its dropdown alignment.
 */
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers. Files that declare their own `afterEach`
// were covered; `demos.test.tsx` was not, so every demo it mounted stayed
// mounted for the rest of the run and React kept scheduling work into the
// environment teardown — `ReferenceError: window is not defined`, reported as
// an unhandled error after a suite whose tests all passed. Unmounting here
// covers every file at once and keeps each test's render cost flat instead of
// growing with the trees before it.
afterEach(() => {
  cleanup();
});

const DESKTOP_WIDTH = 1280;

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      return {
        matches: min !== null ? DESKTOP_WIDTH >= Number(min[1]) : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {
      /* jsdom lays nothing out; there is nothing to report. */
    }
    unobserve(): void {
      /* see observe */
    }
    disconnect(): void {
      /* see observe */
    }
  } as unknown as typeof ResizeObserver;
}

// jsdom implements `getComputedStyle(el)` but throws "Not implemented" for the
// pseudo-element form, which antd 6's scroll locker calls on every dialog
// mount — and this pair mounts one per `TaskSheet` test. Each throw is emitted
// as a `jsdomError` carrying a full React stack, so the sheet suite's real
// output drowns in it.
//
// Answering the element form is the honest degradation, not a silencer: no
// pseudo-element styles exist in a document with no stylesheets, so an empty
// declaration IS the correct answer, and the element's own declaration is what
// every caller here actually reads.
if (typeof window !== "undefined") {
  const nativeComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, _pseudoElement?: string | null) =>
    nativeComputedStyle(element)) as typeof window.getComputedStyle;
}
