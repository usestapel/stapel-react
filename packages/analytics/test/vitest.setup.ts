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
