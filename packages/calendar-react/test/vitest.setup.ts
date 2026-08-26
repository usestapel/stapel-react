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

// jsdom ships no `ResizeObserver`, and antd's form controls (the auto-sizing
// textarea, the responsive Form.Item) construct one on mount — so a suite that
// renders the editor sheet dies with `ReferenceError: ResizeObserver is not
// defined` before it can assert anything. The stub observes nothing on
// purpose: jsdom performs no layout, so a real implementation would only ever
// report zeroes anyway. Element geometry the pair actually branches on is
// covered by the element-width tests, which set the width explicitly.
if (typeof globalThis.ResizeObserver !== "function") {
  globalThis.ResizeObserver = class {
    observe(): void {
      // no layout in jsdom — nothing to report
    }
    unobserve(): void {
      // no layout in jsdom — nothing to report
    }
    disconnect(): void {
      // no layout in jsdom — nothing to report
    }
  } as unknown as typeof ResizeObserver;
}

// jsdom implements `getComputedStyle(el)` but throws "Not implemented" for the
// pseudo-element form, which antd's scroll locker calls on every dialog mount.
// Answering the element form is the honest degradation: no pseudo-element
// styles exist in a document with no stylesheets, so an empty declaration IS
// the right answer, and it keeps 40 render assertions from drowning in
// jsdomError noise.
if (typeof window !== "undefined") {
  const nativeComputedStyle = window.getComputedStyle.bind(window);
  window.getComputedStyle = ((element: Element, pseudoElement?: string | null) =>
    pseudoElement === undefined || pseudoElement === null
      ? nativeComputedStyle(element)
      : nativeComputedStyle(element)) as typeof window.getComputedStyle;
}

// jsdom ships no `matchMedia`, and the shared skin substrate reads one to
// decide its dialog surface and its phone control height — a rule that must
// hold on the FIRST render, so it cannot be deferred to an effect. Without
// this stub every `SkinTheme`/`SkinDialog` render throws. The default answer
// is the phone side (no query matches), which is the side worth testing by
// default; a test that wants desktop sets `window.innerWidth` and this
// evaluates `(min-width: N)` against it.
//
// `matches` is a GETTER on purpose. A real `MediaQueryList` is live, and the
// substrate caches ONE handle per process (`modalQuery()` in
// tokens-antd/skin/dialog) precisely because it is — so a stub that froze
// `matches` at construction would answer every later width with the first
// one, and a phone/desktop matrix would silently assert the same side twice.
if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  window.matchMedia = ((query: string) => {
    const min = /\(min-width:\s*(\d+)px\)/.exec(query);
    return {
      get matches(): boolean {
        return min !== null && window.innerWidth >= Number(min[1]);
      },
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
