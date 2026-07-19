// Shared per-package vitest setup (jsdom suites) — mirrors auth-react/
// profiles-react's own setup.
import { configure } from "@testing-library/react";

configure({ asyncUtilTimeout: 10_000 });

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
