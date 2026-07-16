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

// jsdom doesn't implement the Blob URL registry either; `useAvatarUpload`'s
// local preview relies on it (see its module doc). A counter-based stub is
// enough — the tests only assert the value round-trips, never its content.
if (typeof URL.createObjectURL !== "function") {
  let counter = 0;
  URL.createObjectURL = (() => `blob:mock-${++counter}`) as typeof URL.createObjectURL;
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = (() => {}) as typeof URL.revokeObjectURL;
}
