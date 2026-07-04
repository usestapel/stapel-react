import { useEffect, useState } from "react";
import { breakpointForWidth } from "@stapel/tokens";
import type { Breakpoint } from "@stapel/tokens";

/**
 * Current viewport breakpoint from the three `@stapel/tokens` breakpoints
 * (phone / tablet / desktop). SSR-safe: returns `undefined` until mounted,
 * so server and first client render agree.
 */
export function useBreakpoint(): Breakpoint | undefined {
  const [breakpoint, setBreakpoint] = useState<Breakpoint | undefined>(
    undefined
  );

  useEffect(() => {
    const update = (): void => {
      setBreakpoint(breakpointForWidth(window.innerWidth));
    };
    update();
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
    };
  }, []);

  return breakpoint;
}
