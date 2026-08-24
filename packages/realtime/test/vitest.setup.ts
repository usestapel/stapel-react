// Shared per-package vitest setup (jsdom suite).
//
// vitest runs without injected globals, so testing-library's automatic
// afterEach cleanup never registers — do it explicitly. Without it every
// component a file renders stays mounted for the whole file, and the next
// `getByTestId` finds three of everything (which is how this file came to
// exist rather than as boilerplate).
import { afterEach } from "vitest";
import { cleanup, configure } from "@testing-library/react";

// Full CI runs every package's suite in parallel under turbo; on a loaded
// machine testing-library's default 1s `waitFor` budget flakes even though the
// awaited state always arrives.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
});
