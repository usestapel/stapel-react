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
 * ── THE ONE INVARIANT A CALLER HAS TO KEEP ───────────────────────────────
 *
 * **Put `ref` on an element whose own width `narrow` does not decide.** A
 * measurement that feeds itself has no fixed point: 1440 says "wide", the wide
 * arm is 360 across, 360 says "narrow", the narrow arm is 1440 across. The
 * hook then flips on every animation frame, and if the two arms are different
 * trees React rebuilds the subtree just as often — which makes every control
 * inside unclickable, because a press and a release land on two different DOM
 * nodes and no `click` is ever dispatched. That is not hypothetical: it is how
 * `<IncomingCallOverlay>` became unanswerable on a desktop while working on a
 * phone (the phone's arm happened to be the stable one), and the symptom was a
 * call that rang until it timed out as missed.
 *
 * Measure a wrapper that is sized by the layout — full-bleed, `width: 100%`,
 * a host's column — and let the arms differ INSIDE it.
 *
 * This wants to live in `@stapel/tokens-antd/skin` beside `SkinDialog` — every
 * pair with a table repeats it otherwise. Recorded as such in the pair's
 * requests file; kept local until that lands so this pane is not blocked on it.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { useBreakpoint } from "@stapel/core";
import { breakpoints } from "@stapel/tokens-antd";

/**
 * Below this the four-column table becomes a list of cards — the `tablet` edge
 * of `@stapel/tokens`' three breakpoints.
 *
 * READ FROM THE TOKENS, not restated. It was the literal `768` with a comment
 * promising it matched, which is the same class of claim as a schema that says
 * it matches the wire: true on the day it is written and unchecked every day
 * after. The same sweep that found the shell deciding its chrome from a
 * hard-coded width found this one, and the fix is the cheaper half of it.
 */
export const NARROW_LIMIT: number = breakpoints.tablet;

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
