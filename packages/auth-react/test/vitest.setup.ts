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

// jsdom ships neither `matchMedia` nor `ResizeObserver`; Ant Design (the §54
// default-skin suite) reads both on mount. Minimal no-op polyfills so the DOM
// render is exercised without pulling a heavier test env.
//
// `matches: false` for every query is NOT a neutral stub. `@stapel/tokens-antd
// /skin` reads `(min-width: 768px)` to decide whether a dialog is a modal or a
// bottom sheet, so a blanket `false` silently declares every test viewport a
// phone — and no suite could then prove which surface it renders. jsdom's own
// window is 1024x768, so the honest answer is to evaluate the query against
// `window.innerWidth`; a test that wants to BE a phone sets `innerWidth` to
// 390 before rendering.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string): MediaQueryList => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    return {
      get matches(): boolean {
        return min === null ? false : window.innerWidth >= Number(min[1]);
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList;
  };
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
