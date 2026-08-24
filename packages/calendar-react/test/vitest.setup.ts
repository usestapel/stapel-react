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

// jsdom ships no `matchMedia`, and the shared skin substrate reads one to
// decide its dialog surface and its phone control height — a rule that must
// hold on the FIRST render, so it cannot be deferred to an effect. Without
// this stub every `SkinTheme`/`SkinDialog` render throws. The default answer
// is the phone side (no query matches), which is the side worth testing by
// default; a test that wants desktop overrides `window.innerWidth` and this
// evaluates `(min-width: N)` against it.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    const matches = min !== null ? window.innerWidth >= Number(min[1]) : false;
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    };
  }) as typeof window.matchMedia;
}
