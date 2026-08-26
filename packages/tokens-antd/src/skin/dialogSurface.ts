/**
 * Which shape a dialog takes — the viewport rule, on its own, so that both
 * halves of the substrate can read it.
 *
 * It lived in `dialog.tsx` until `SkinDialog` began theming its own portal
 * (see that file's "A dialog is themed where it is PAINTED" section): the
 * dialog now renders a `SkinTheme`, and `SkinTheme` reads this rule to decide
 * the phone touch floor, so leaving the rule in `dialog.tsx` would have made
 * the two modules import each other. The rule is the thing they share, so the
 * rule is what moved.
 *
 * ## The surface decision is not a measurement
 *
 * Which surface to render is a decision about the VIEWPORT's shape — the one
 * legitimate use of a viewport query (an element-sized decision would be a
 * defect; see `@stapel/image`). It reads one `matchMedia` against
 * `@stapel/tokens`' `tablet` breakpoint through `useSyncExternalStore`, so
 * the very first CLIENT render already has the right answer: the
 * `useBreakpoint()` pattern (`undefined` until an effect runs) would paint a
 * desktop modal on a phone for one frame and then swap it for a sheet.
 */
import { useSyncExternalStore } from "react";
import { breakpoints } from "@stapel/tokens";

/**
 * Which shape a dialog takes: a bottom `"sheet"` (phone) or a centred
 * `"modal"` (tablet and desktop).
 */
export type DialogSurface = "sheet" | "modal";

/**
 * The rule, as a media query: at or above the `tablet` breakpoint a dialog is
 * a modal; below it, a sheet. One query, derived from the same generated
 * `@stapel/tokens` breakpoints `@stapel/core`'s `useBreakpoint()` reads, so
 * the two can never disagree about where a phone ends.
 */
export const MODAL_MEDIA_QUERY: string = `(min-width: ${String(breakpoints.tablet)}px)`;

/**
 * One `MediaQueryList` for the whole process, not one per call.
 *
 * `useSyncExternalStore` calls its snapshot on EVERY render of every
 * consumer, and `SkinTheme` is a consumer — so a screen of a hundred skinned
 * parts was asking the platform to parse and evaluate the same media query a
 * hundred times per render pass, plus one live query object per `subscribe`.
 * `matchMedia` returns a live object: one handle answers forever and keeps
 * reporting the current viewport.
 *
 * Keyed on the `matchMedia` function itself so a test that installs its own
 * (`test/env.tsx`) is never answered by a handle the previous one made.
 */
let cachedMatcher: typeof window.matchMedia | null = null;
let cachedQuery: MediaQueryList | null = null;

function modalQuery(): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  if (cachedQuery === null || cachedMatcher !== window.matchMedia) {
    cachedMatcher = window.matchMedia;
    cachedQuery = window.matchMedia(MODAL_MEDIA_QUERY);
  }
  return cachedQuery;
}

function subscribe(onChange: () => void): () => void {
  const query = modalQuery();
  if (query === null) return () => undefined;
  query.addEventListener("change", onChange);
  return () => {
    query.removeEventListener("change", onChange);
  };
}

function readSurface(): DialogSurface {
  const query = modalQuery();
  if (query === null) return "modal";
  return query.matches ? "modal" : "sheet";
}

/** `"modal"` where there is no DOM to ask (SSR): the server cannot know the
 * viewport, and a dialog is closed on the first paint either way, so the
 * hydrated client render is the first one that can be seen. */
function serverSurface(): DialogSurface {
  return "modal";
}

/**
 * The surface a dialog should take right now — `"sheet"` on a phone,
 * `"modal"` on tablet/desktop — recomputed when the viewport crosses the
 * breakpoint (rotation, a resized desktop window, a split-screen tablet).
 *
 * ## Viewport, deliberately — and the house rule it does not break
 *
 * The house rule is "geometry from element width, never from the viewport":
 * a card grid, a table's density, an image's variant are all questions about
 * the box the thing is IN, and a 390px-wide panel on a desktop must lay out
 * like a phone. A DIALOG is the one component that question does not apply
 * to, because a dialog is not in a box: a modal is positioned against the
 * viewport, a sheet is anchored to the viewport's bottom edge and sized by
 * its height (`90dvh`, safe-area insets), and both sit above every element
 * that could have been measured. There is no element whose width could be
 * the right input — the opener's width is irrelevant to whether a sheet
 * should slide up from the bottom of the phone. So this hook reads the
 * viewport, and it is the ONLY shared primitive that decides a shape from
 * it (with `@stapel/core`'s `useBreakpoint`, which decides the shell's
 * chrome — also a viewport surface). Everything that lays out inside a box
 * keeps measuring the box.
 *
 * Exported so a skin that cannot use `SkinDialog` (a third-party dialog, a
 * control that grows to 44px only on a phone) can still obey the same rule
 * from the same source; `SkinTheme` reads it for exactly that.
 */
export function useDialogSurface(): DialogSurface {
  return useSyncExternalStore(subscribe, readSurface, serverSurface);
}
