/**
 * "Is the window at least this wide right now?" — the one width read both
 * chromes in this package make, at whatever edge they are asked about.
 *
 * ── Why this exists next to `@stapel/core`'s `useBreakpoint()` ────────────
 *
 * `useBreakpoint()` answers with one of THREE rungs, because that is what
 * `@stapel/tokens` ships (`phone: 0`, `tablet: 768`, `desktop: 1200`), and
 * for a long time both chromes here asked it `=== "desktop"` — which quietly
 * collapsed the three rungs to two and drew the PHONE page on every width from
 * 768 to 1199. That defect is fixed by asking about the right edge, not by a
 * second opinion about the ladder: the default edge IS `breakpoints.tablet`,
 * and a deployment that names nothing gets the tokens' own number.
 *
 * What the ladder cannot express is a HOST's edge. The fleet's storefront
 * composes its filter rail at 1024 (the owner's tablet rule, measured: at 768
 * the 280px rail leaves the results one card across), so its chrome has to
 * change arms at 1024 too — and 1024 is not a rung. Moving `desktop` to 1024
 * in `@stapel/tokens` would re-compose every other app on the ladder, so the
 * width is a PROP and this is what reads it. Exactly the shape
 * `@stapel/search-react` settled on for the same question one component over
 * (`<SearchPage railFrom>`, 0.32.7).
 *
 * ── The mechanics, which are `useBreakpoint`'s own ───────────────────────
 *
 * `useSyncExternalStore`, so the FIRST client render already carries the real
 * answer: an effect-based hook paints the phone arm on a desktop for one frame
 * and swaps it, which is the flash core removed from this very shell. The
 * comparison is against `window.innerWidth` — the same value
 * `breakpointForWidth` is given — with the edge's media query added as an
 * extra CHANGE SIGNAL where it exists, because a zoom or a split-screen tablet
 * re-lays out without a `resize` event.
 *
 * `false` on the server and on the hydration pass that must agree with it:
 * unknown means the phone arm, which is what this shell has always drawn
 * before the client spoke, and it is the mobile-first answer.
 *
 * UPSTREAM ASK (`@stapel/core`): this is a general primitive — "is the
 * viewport at least N" — and it now exists three times in the fleet (here,
 * `search-react`'s `useWiderThan`, and the storefront's own edge hook). It
 * belongs beside `useBreakpoint()`; kept local until that lands so this fix is
 * not blocked on a core release.
 */
import { useCallback, useSyncExternalStore } from "react";
import { breakpoints } from "@stapel/tokens-antd";

/**
 * WHERE THE PHONE SHELL ENDS — the tokens' own `tablet` rung, and the default
 * edge for both chromes in this package (`<PublicShell chromeFrom>`,
 * `<AppShell chromeFrom>`).
 *
 * It used to be `breakpoints.desktop` in all but name: both chromes asked
 * `useBreakpoint() === "desktop"`, so the three rungs `@stapel/tokens` ships
 * were collapsed to two and every width from 768 to 1199 drew the PHONE page
 * — the bottom dock floating over a laptop-width window, the one-row phone
 * header, the browse bar gone and the nav behind a hamburger. A tablet
 * rendered a phone, on every route in the fleet.
 */
export const DEFAULT_CHROME_FROM: number = breakpoints.tablet;

export function useWiderThan(edge: number): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      if (typeof window === "undefined") return () => undefined;
      const cleanups: Array<() => void> = [];
      window.addEventListener("resize", onChange);
      cleanups.push(() => {
        window.removeEventListener("resize", onChange);
      });
      if (typeof window.matchMedia === "function") {
        const list = window.matchMedia(`(min-width: ${String(edge)}px)`);
        // Guarded exactly as `useBreakpoint` guards it: test doubles and a
        // couple of old webviews ship a list with no listener API, and a hook
        // must not throw out of subscribe.
        if (typeof list.addEventListener === "function") {
          list.addEventListener("change", onChange);
          cleanups.push(() => {
            list.removeEventListener("change", onChange);
          });
        }
      }
      return () => {
        for (const cleanup of cleanups) cleanup();
      };
    },
    [edge]
  );
  const snapshot = useCallback((): boolean => window.innerWidth >= edge, [edge]);
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}

/** The server cannot know the viewport; the phone arm is what it draws. */
function serverSnapshot(): boolean {
  return false;
}
