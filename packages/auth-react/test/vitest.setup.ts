// Shared per-package vitest setup (jsdom suites).
//
// Full CI runs every package's suite in parallel under turbo; on a loaded
// machine testing-library's default 1s `waitFor` budget flakes even though
// the awaited state always arrives. Raising `asyncUtilTimeout` removes the
// timing assumption without slowing green tests — `waitFor` still resolves
// the instant the assertion passes. (vitest's own per-test budgets are
// raised alongside in vitest.config.ts.)
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

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
// pseudo-element arg — Ant Design v6 (the bumped default skin) does exactly
// that on some component mounts. This surfaced ONLY on the CI release runner
// (a jsdom/env difference), failing the publish. Drop the second arg and
// delegate to jsdom's real one-arg implementation.
if (typeof window !== "undefined" && typeof window.getComputedStyle === "function") {
  const realGetComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((elt: Element) =>
    realGetComputedStyle(elt)) as typeof window.getComputedStyle;
}
