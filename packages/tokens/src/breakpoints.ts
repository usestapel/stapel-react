/**
 * Exactly three breakpoints (frontend-standard §4.3): phone / tablet /
 * desktop. Values live in theme.json and are generated into
 * `src/generated/tokens.ts`; the runtime helpers below are hand-written and
 * consume them. `@stapel/core`'s `useBreakpoint()` reads these.
 */
import { breakpoints } from "./generated/tokens.js";
import type { Breakpoint } from "./generated/tokens.js";

export { breakpoints };
export type { Breakpoint };

export const breakpointOrder = ["phone", "tablet", "desktop"] as const;

/** Resolve which breakpoint a viewport width falls into. */
export function breakpointForWidth(width: number): Breakpoint {
  if (width >= breakpoints.desktop) return "desktop";
  if (width >= breakpoints.tablet) return "tablet";
  return "phone";
}

/** CSS min-width media query for a breakpoint, e.g. `(min-width: 768px)`. */
export function mediaQuery(breakpoint: Breakpoint): string {
  return `(min-width: ${String(breakpoints[breakpoint])}px)`;
}
