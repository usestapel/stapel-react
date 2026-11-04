/**
 * The jsdom gaps every antd surface in a pair falls into, closed once for the
 * whole suite instead of per test file.
 *
 * `matchMedia` is the first: antd's responsive observer asks for one on mount,
 * and without a stub a demo smoke test dies inside antd rather than in anything
 * the pair wrote. The default answers a DESKTOP viewport, and it answers
 * `(min-width: N)` by actually comparing against that width — so "is it one
 * column?" stays a decision a test can make by replacing this stub, never one
 * it inherits from a stub that says `false` to everything.
 *
 * `ResizeObserver` is the second: antd's `Select` uses one for dropdown
 * alignment, as does any drag engine a skin vendors.
 */
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

/**
 * `waitFor`'s own budget, which `testTimeout` does not raise.
 *
 * vitest's `testTimeout` bounds the whole test; testing-library polls its own
 * 1s `asyncUtilTimeout` inside it and throws first. On a loaded CI runner a
 * pair's first render is slower than that on its own, so tests fail with "Test
 * timed out" against work that was still in flight. Raised together with the
 * vitest budgets in `vitest.config.ts`; a resolved condition still returns on
 * the next poll.
 */
configure({ asyncUtilTimeout: 10_000 });

// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers. Files that declare their own `afterEach`
// are covered; `demos.test.tsx` is not, so every demo it mounts would stay
// mounted for the rest of the run and React would keep scheduling work into
// the environment teardown — `ReferenceError: window is not defined`, reported
// as an unhandled error after a suite whose tests all passed. Unmounting here
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
// mount. Each throw is emitted as a `jsdomError` carrying a full React stack,
// so a suite's real output drowns in it.
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
