import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

/**
 * The width of the BOX a calendar is in — not the viewport.
 *
 * House rule (`@stapel/image`'s `useImageSlot` states it, `SkinDialog`'s
 * header restates the one exception): geometry comes from element width.
 * A calendar is the sharpest case in the fleet. A month grid dropped into a
 * 380px side panel on a 1600px desktop is a phone-shaped calendar, and a
 * viewport query would draw it seven columns wide with three-pixel cells; the
 * same grid in a 1200px main column is a month grid whatever the phone-sized
 * browser window around it says. So the component measures itself.
 *
 * (The one thing that legitimately reads the viewport is the DIALOG surface —
 * a sheet is anchored to the viewport's bottom edge and has no containing box
 * to measure. That decision lives in `@stapel/tokens-antd/skin`, and this hook
 * never second-guesses it.)
 *
 * ── Behaviour ────────────────────────────────────────────────────────────
 *
 * `undefined` until the element has been measured — a caller renders its
 * *narrow* layout in that frame, because a list degrades gracefully into a
 * wide box and a seven-column grid does not degrade into a narrow one.
 * Without `ResizeObserver` (jsdom, an old engine) it measures once and stops:
 * there is nothing to observe and nothing that will report a second time.
 */
export function useElementWidth<T extends HTMLElement>(): {
  readonly ref: RefObject<T | null>;
  readonly width: number | undefined;
} {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const commit = (next: number): void => {
      setWidth((previous) => (previous === next ? previous : next));
    };

    if (typeof ResizeObserver === "undefined") {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0) commit(rect.width);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize[0];
        commit(box !== undefined ? box.inlineSize : entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}

/**
 * Below this element width a month GRID is not drawable: seven columns need
 * room for a day number and one event title each, and a grid that scrolls
 * sideways is not a calendar. A narrower box gets the agenda list instead.
 */
export const GRID_MIN_WIDTH = 560;

/**
 * Below this element width a grid cell shows only a dot per event instead of
 * its title — the cell still says "something is on this day", which is the
 * information a month view exists to carry.
 */
export const CELL_DENSE_WIDTH = 760;
