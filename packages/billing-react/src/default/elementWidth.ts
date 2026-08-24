/**
 * ELEMENT WIDTH, NOT VIEWPORT WIDTH.
 *
 * `BuyOptions` used to lay its two columns out with antd's grid
 * (`<Col xs={24} md={12}>`), and antd's breakpoints are CSS media queries on
 * the VIEWPORT. So the shop dropped into a 380px side panel on a 1920px
 * desktop still rendered two columns squeezed side by side, and the
 * per-credit comparison the whole component exists for became unreadable —
 * while the same markup at 900px of viewport inside a narrow drawer got the
 * layout of a full page. The component was asking the wrong question: not
 * "how big is the screen" but "how much room do I have".
 *
 * This is the answer to the right one. `ResizeObserver` on the element
 * itself, so a surface reflows when its CONTAINER changes for any reason —
 * a sider collapsing, a modal resizing, a split view, a phone rotating.
 *
 * ── Why the unmeasured answer is `undefined`, not 0 ───────────────────────
 *
 * Before the first observation there is no width, and 0 is a number a
 * caller would compare against a threshold and lose to. `undefined` forces
 * every caller through {@link columnsForWidth}, which treats "not measured
 * yet" as the wide layout: a first paint that is briefly two columns and
 * settles to one is a reflow, while a first paint that is one column and
 * settles to two is a visible jump on every desktop load. Server renders and
 * environments with no `ResizeObserver` stay on that same wide answer
 * forever, which is the layout that has always been the safe default for a
 * container of unknown size.
 *
 * This belongs in `@stapel/tokens-antd/skin` beside `SkinDialog` — every pair
 * using antd `Row`/`Col` breakpoints has this bug (audit GAP-B7, a CLASS
 * finding). It lives here until that lands; see
 * `SCRATCH/wave-b/REQUESTS-billing-react.md`.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { breakpoints } from "@stapel/tokens";

/**
 * Room enough for two comparable columns. The tablet breakpoint from
 * `@stapel/tokens` — the same number the dialog surface splits sheet from
 * modal on, so "narrow" means one thing across the skin — read here as an
 * ELEMENT width instead of a viewport one.
 */
export const TWO_COLUMN_MIN_WIDTH: number = breakpoints.tablet;

/** What a surface lays out as. */
export type SkinColumns = 1 | 2;

/**
 * How many columns fit in `width`. `undefined` (not measured, no observer,
 * server render) answers 2 — see the module note.
 */
export function columnsForWidth(width: number | undefined): SkinColumns {
  if (width === undefined) return 2;
  return width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
}

/** What {@link useElementWidth} hands back. */
export interface ElementWidth<T extends HTMLElement = HTMLElement> {
  /** Put this on the element whose width decides the layout. */
  readonly ref: RefObject<T | null>;
  /** Its content-box width in CSS pixels, or `undefined` before the first
   * observation. */
  readonly width: number | undefined;
}

/**
 * Measure one element's width, live.
 *
 * The observer is the only source: no `resize` listener, because a window
 * resize that does not change THIS element is not a layout change for it,
 * and an element that changes without the window (a sider collapsing) is
 * exactly the case a window listener misses.
 */
export function useElementWidth<
  T extends HTMLElement = HTMLElement,
>(): ElementWidth<T> {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      // `contentRect` is the content box — padding and borders excluded, so
      // the number compared against a column threshold is the room the
      // children actually get.
      const next = entry.contentRect.width;
      // A detached or display:none element reports 0. That is not a
      // measurement of anything, and letting it through would collapse a
      // hidden tab's layout to one column and leave it there.
      if (next <= 0) return;
      setWidth((prev) => (prev === next ? prev : next));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}
