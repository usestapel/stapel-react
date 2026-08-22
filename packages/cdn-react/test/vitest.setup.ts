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

// jsdom's `Blob` (and therefore `File`) ships no `arrayBuffer()`. Every real
// browser has had it since 2019 and the upload flow reads the bytes through
// it to compute the SHA-256 the dedup pre-check is asked with — so without
// this shim the whole dedup half of the suite would be testing a gap in the
// test environment rather than the code. Same category as the `matchMedia` /
// `ResizeObserver` polyfills above: a jsdom omission, filled minimally.
if (typeof Blob !== "undefined" && typeof Blob.prototype.arrayBuffer !== "function") {
  Blob.prototype.arrayBuffer = function arrayBuffer(this: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as ArrayBuffer);
      };
      reader.onerror = () => {
        reject(reader.error ?? new Error("FileReader failed"));
      };
      reader.readAsArrayBuffer(this);
    });
  };
}

// jsdom implements neither half of the object-URL API. Every upload preview in
// this package goes through it (core's `useObjectUrlPreview`), so without a
// stand-in a plain render throws before a single assertion runs. Counting
// them is a test's own business — `preview.test.tsx` replaces both with spies
// — so this pair is deliberately the dumbest thing that works.
let objectUrlSeq = 0;
if (typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = (): string => {
    objectUrlSeq += 1;
    return `blob:jsdom/${String(objectUrlSeq)}`;
  };
}
if (typeof URL.revokeObjectURL !== "function") {
  URL.revokeObjectURL = (): void => {};
}
