/**
 * Exactly three breakpoints (frontend-standard §4.3): phone / tablet /
 * desktop. Values are min-width px: a viewport is `tablet` when
 * `width >= breakpoints.tablet` and `< breakpoints.desktop`.
 * `@stapel/core`'s `useBreakpoint()` reads these.
 */
export const breakpoints = {
  phone: 0,
  tablet: 768,
  desktop: 1200,
} as const;

export type Breakpoint = keyof typeof breakpoints;

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
