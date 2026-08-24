/**
 * jsdom ships no `window.matchMedia`, and every antd surface in this package
 * asks for one (the responsive observer, `SkinDialog`'s sheet-vs-modal query,
 * `SkinTheme`'s 44px phone controls). Without a stub the demo smoke test dies
 * inside antd rather than in anything this pair wrote.
 *
 * The default answers a DESKTOP viewport. Tests that care about the phone
 * surface call `setViewport(390)` from `./helpers.js`, which replaces this with
 * a query that actually evaluates `(min-width: N)` against a chosen width — so
 * "is it a sheet?" is a decision the test makes, never one it inherits from a
 * stub that says `false` to everything.
 */
const DESKTOP_WIDTH = 1280;

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => {
      const min = /min-width:\s*(\d+)px/.exec(query);
      return {
        matches: min !== null ? DESKTOP_WIDTH >= Number(min[1]) : false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      };
    },
  });
}
