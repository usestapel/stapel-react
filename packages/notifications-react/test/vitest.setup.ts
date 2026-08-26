// Shared per-package vitest setup (jsdom suites).
//
// Full CI runs every package's suite in parallel under turbo; on a loaded
// machine testing-library's default 1s `waitFor` budget flakes even though
// the awaited state always arrives. Raising `asyncUtilTimeout` removes the
// timing assumption without slowing green tests — `waitFor` still resolves
// the instant the assertion passes. (vitest's own per-test budgets are
// raised alongside in vitest.config.ts.)
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers — do it explicitly. Without it every
// component a file renders stays mounted for the whole file, and antd's
// timers/frames keep firing into the environment teardown: 11 of 12 packages
// were one slow runner away from `ReferenceError: window is not defined`
// after a suite whose tests all passed (profiles-react, 2026-08-13).
afterEach(() => {
  cleanup();
});

// jsdom ships neither `matchMedia` nor `ResizeObserver`; Ant Design (the
// `/default` settings-skin suite) reads both on mount. Minimal no-op
// polyfills, mirroring auth-react's suite, so the DOM render is exercised
// without pulling a heavier test env.
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

// jsdom implements `getComputedStyle(el)` but throws "Not implemented" for the
// pseudo-element form, which antd 6's scroll locker calls on every dialog
// mount. Each throw is emitted as a `jsdomError` carrying a full React stack,
// so a suite that opens a confirm buries its real output in noise.
//
// Answering the element form is the honest degradation, not a silencer: no
// pseudo-element styles exist in a document with no stylesheets, so an empty
// declaration IS the correct answer and the element's own declaration is what
// every caller here actually reads.
if (typeof window !== "undefined") {
  const nativeComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, _pseudoElement?: string | null) =>
    nativeComputedStyle(element)) as typeof window.getComputedStyle;
}
