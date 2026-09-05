// Shared per-package vitest setup (jsdom suites).
//
// Full CI runs every package's suite in parallel under turbo; on a loaded
// machine testing-library's default 1s `waitFor` budget flakes even though
// the awaited state always arrives. Raising `asyncUtilTimeout` removes the
// timing assumption without slowing green tests — `waitFor` still resolves
// the instant the assertion passes.
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
  // The seller dashboard writes its open tab into the address
  // (`model/tabAddress.ts`), and jsdom's URL is shared by every test in a
  // file: without this, one test switching to Drafts decides which tab the
  // NEXT test's pane opens on. The reset belongs here rather than in that one
  // suite — any component that binds state to the address has the same
  // property.
  if (typeof window !== "undefined" && typeof window.history !== "undefined") {
    window.history.replaceState(null, "", "/");
  }
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
