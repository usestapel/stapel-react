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
// `/default` skin suite) reads both on mount. Minimal polyfills, mirroring
// profiles-react's suite, so the DOM render is exercised without pulling a
// heavier test env.
//
// The `matches` answer is EVALUATED, not hardcoded `false`. Since the fleet
// dialog rule landed (`@stapel/tokens-antd/skin`), a `(min-width: 768px)`
// query is what decides whether a dialog renders as a phone bottom sheet or a
// tablet/desktop modal — so a blanket `false` silently declares every test
// viewport a phone, and the suite would assert the sheet everywhere while the
// desktop surface went untested. jsdom's own window is 1024x768, so reading
// `window.innerWidth` gives each test the viewport it actually stands in (and
// a test that wants the other surface says so by setting `innerWidth`).
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => {
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
  }) as typeof window.matchMedia;
}
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}
