// Shared per-package vitest setup (jsdom suites) — mirrors auth-react/
// profiles-react's own setup.
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
// `/default` AppShell suite) reads both on mount.
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
