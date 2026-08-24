import { useSyncExternalStore } from "react";
import { breakpointForWidth, breakpoints } from "@stapel/tokens";
import type { Breakpoint } from "@stapel/tokens";

/**
 * The two edges between the three `@stapel/tokens` breakpoints, as media
 * queries — the same numbers `breakpointForWidth` compares against, so a
 * `change` event from either list is exactly "the breakpoint moved".
 */
const EDGE_QUERIES: readonly string[] = [
  `(min-width: ${String(breakpoints.tablet)}px)`,
  `(min-width: ${String(breakpoints.desktop)}px)`,
];

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const cleanups: Array<() => void> = [];
  // `resize` is the universal signal (and what jsdom-driven suites dispatch).
  // The media lists are added where they exist: they also fire on zoom and
  // on a split-screen tablet re-laying out without a window resize event.
  window.addEventListener("resize", onChange);
  cleanups.push(() => window.removeEventListener("resize", onChange));
  if (typeof window.matchMedia === "function") {
    for (const query of EDGE_QUERIES) {
      const list = window.matchMedia(query);
      // Guarded: test doubles and a couple of old webviews ship a list
      // without the listener API; a hook must not throw out of subscribe.
      if (typeof list.addEventListener !== "function") continue;
      list.addEventListener("change", onChange);
      cleanups.push(() => list.removeEventListener("change", onChange));
    }
  }
  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

function readBreakpoint(): Breakpoint {
  return breakpointForWidth(window.innerWidth);
}

/** The server cannot know the viewport; `undefined` is the honest answer. */
function serverBreakpoint(): Breakpoint | undefined {
  return undefined;
}

/**
 * Current viewport breakpoint from the three `@stapel/tokens` breakpoints
 * (phone / tablet / desktop).
 *
 * Read through `useSyncExternalStore`, so the very FIRST client render already
 * carries the real answer. The previous shape — `undefined` until an effect
 * ran — made `AppShell` paint its phone drawer on a desktop for one frame and
 * then swap in the sider; the dialog surface hook in `@stapel/tokens-antd`
 * never had that flash because it read synchronously, and two primitives in
 * one layer must not answer "what viewport is this" two different ways.
 *
 * `undefined` is returned ONLY where there is no viewport to read: a server
 * render, and the hydration pass that must agree with it (React re-renders
 * with the real value immediately after). A caller branching on it is
 * choosing what to paint before the client has spoken, which is the one
 * situation where "unknown" is true.
 *
 * This is a VIEWPORT-shape decision (which chrome to mount), the one
 * legitimate use of viewport geometry. Sizing anything by this value instead
 * of by the element's own width is the defect the house rule names; see
 * `@stapel/image`'s `useImageSlot` for the element-width primitive.
 */
export function useBreakpoint(): Breakpoint | undefined {
  return useSyncExternalStore(subscribe, readBreakpoint, serverBreakpoint);
}
