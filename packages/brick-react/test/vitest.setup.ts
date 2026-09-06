// Shared per-package vitest setup (jsdom suites) — mirrors image/shell-react.
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers — do it explicitly.
afterEach(() => {
  cleanup();
});

// jsdom ships no `matchMedia`. The console reads it twice on mount (pointer
// coarseness and reduced motion); the default here answers "no" to both, and
// the tests that care install their own.
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
