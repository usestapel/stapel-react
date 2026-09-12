/**
 * DOES THE FILTER RAIL FIT UNDER THE HOST'S HEADER?
 *
 * The question exists only for `railScroll="page"` — the arm where the rail is
 * NOT a scroll container of its own and the page is the only thing that
 * scrolls. There a rail taller than the window cannot be sticky: a stuck box
 * is cut off at the foot of the screen and its last controls become
 * unreachable, because the scroll that would reveal them is the page's and the
 * page is not moving the rail. So the rail sticks while it fits and stands in
 * flow while it does not, and "fits" is a measurement, not a breakpoint:
 * the same catalogue draws four facet groups on one leaf and twenty on the
 * next.
 *
 * Two numbers, and both are read from the browser rather than restated:
 *
 *  - the rail's own height — `ResizeObserver`, because the rail changes height
 *    without the window changing at all (a facet group unfolds, an answer
 *    lands with more values, the schema arrives and reorders the panel);
 *  - the room under the host's chrome — `window.innerHeight` minus the offset
 *    the rail already carries as `scroll-margin-top`. That property is the
 *    same offset said in the one property that MEANS it (the header covers
 *    that much of the top of the scrollport), and the engine resolves it to
 *    pixels — a `var()`, a `calc()` or a `rem` included — so the fit test
 *    needs no CSS parser of its own to read what a host wrote.
 *
 * The house rule from `useElementWidth` holds here too: **zero is not a
 * measurement**. A detached or `display: none` rail reports 0 and would
 * otherwise be declared to fit forever. And the honest answer before the first
 * measurement is "no": a static rail scrolls with the page under every
 * circumstance, so an unmeasured frame degrades to the arm that cannot hide a
 * control.
 */
import { useEffect, useState } from "react";
import type { RefObject } from "react";

/** The CSS property the rail's top offset is carried in — see the note above.
 * Exported so a test can assert the two halves read and write the same one. */
export const RAIL_OFFSET_PROPERTY = "scrollMarginTop";

/**
 * Measure whether `ref`'s element is short enough to stand under the chrome
 * its own `scroll-margin-top` names.
 *
 * `enabled` is the `railScroll === "page"` arm: under `"internal"` nothing is
 * measured and nothing is listened to, so the default arm carries no observer
 * and no listener at all.
 */
export function useRailFits(
  ref: RefObject<HTMLElement | null>,
  enabled: boolean
): boolean {
  const [fits, setFits] = useState(false);

  useEffect(() => {
    if (!enabled) {
      // Leaving the arm resets the answer: a rail that stops being measured
      // must not keep the last measurement's `position: sticky`.
      setFits(false);
      return undefined;
    }
    const element = ref.current;
    if (element === null) return undefined;

    const measure = (): void => {
      const height = element.getBoundingClientRect().height;
      // Zero is not a measurement — see the note above.
      if (height <= 0) return;
      const offset = Number.parseFloat(
        window.getComputedStyle(element)[RAIL_OFFSET_PROPERTY]
      );
      const room = window.innerHeight - (Number.isFinite(offset) ? offset : 0);
      const next = height <= room;
      setFits((previous) => (previous === next ? previous : next));
    };

    measure();
    // The window's own height is not the element's: a rotation, a devtools
    // pane or a resized window changes the room without changing the rail.
    window.addEventListener("resize", measure);
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(element);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [ref, enabled]);

  return fits;
}
