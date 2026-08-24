/**
 * "Is the box this thing is in narrower than `limit`?" — measured on the
 * ELEMENT, not on the window.
 *
 * A four-column table does not stop fitting because the phone is a phone; it
 * stops fitting because the column it was dropped into is 320px wide, which
 * happens on a desktop the moment a host mounts this pane in a sidebar or a
 * split pane. The audit's V4 finding is exactly that: `<Table>` with no
 * responsive arm scrolls the page sideways, and a viewport media query would
 * still have got the sidebar case wrong.
 *
 * `ResizeObserver` is the measurement; `useBreakpoint()` is the fallback for
 * the server and for environments without one, because an unmeasurable box is
 * better served by the viewport's answer than by silently choosing the wide
 * layout.
 *
 * This wants to live in `@stapel/tokens-antd/skin` beside `SkinDialog` — every
 * pair with a table repeats it otherwise. Recorded as such in the pair's
 * requests file; kept local until that lands so this pane is not blocked on it.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useBreakpoint } from "@stapel/core";

/** Below this the four-column table becomes a list of cards. Matches the
 * tablet edge of `@stapel/tokens`' three breakpoints. */
export const NARROW_LIMIT = 768;

export interface NarrowBox<T extends HTMLElement> {
  /** Put this on the element whose width decides the layout. */
  readonly ref: RefObject<T | null>;
  /** `true` when that element is narrower than `limit`. */
  readonly narrow: boolean;
}

export function useNarrow<T extends HTMLElement>(
  limit: number = NARROW_LIMIT
): NarrowBox<T> {
  const ref = useRef<T | null>(null);
  const breakpoint = useBreakpoint();
  const [measured, setMeasured] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver !== "function") return undefined;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      setMeasured(entry.contentRect.width);
    });
    observer.observe(element);
    setMeasured(element.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
    };
  }, []);

  const narrow =
    measured !== undefined && measured > 0
      ? measured < limit
      : breakpoint === "phone";

  return { ref, narrow };
}
