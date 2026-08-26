/**
 * `useElementWidth` — the ONE element-width measurement in the fleet.
 *
 * The house rule is "geometry from the element's width, never the
 * viewport's": a table dropped into a 340px settings column on a 1280px
 * desktop is a narrow table, and an antd `Row`/`Col` breakpoint — a viewport
 * media query — draws the wide arm into a third of the room it needs. Every
 * pair that hit the rule wrote the observer itself: five copies this wave
 * (`billing-react/src/default/elementWidth.ts`,
 * `calendar-react/src/default/useElementWidth.ts`,
 * `docs-react/src/default/useSplitLayout.ts`, `geo-react`'s `TileMap`,
 * `gdpr-react/src/default/DataTable.tsx`), each with its own answer to the
 * two questions a measurement has: what a zero-width box means, and what a
 * box that has not been measured yet means.
 *
 * Both answers are stated here, once:
 *
 *  - **Zero is not a measurement.** A detached or `display:none` element
 *    reports 0. Letting it through collapses a hidden tab to its narrow arm
 *    and leaves it there when the tab is shown again, because 0 never
 *    changes back on its own.
 *  - **Unmeasured is `undefined`, not a number.** Before the first
 *    observation — a server render, an environment with no `ResizeObserver`,
 *    the frame before the effect runs — there is no width. Every threshold
 *    therefore answers `undefined` too, so a caller must say what it draws
 *    while it does not know: `below.cards ?? phone` (the dialog-surface rule
 *    is the honest seed on a phone), or `?? false` for a component whose
 *    wide arm reflows gracefully. A hook that answered `false` here would be
 *    deciding that for every caller, and the five copies did not agree.
 *
 * The observer is the only source. A window `resize` listener is both too
 * much — a resize that does not change THIS element is not a layout change
 * for it — and too little: a sider collapsing, a drawer opening or a pane
 * splitting changes the element without touching the window.
 *
 * The one component that legitimately does NOT use this is `SkinDialog`: a
 * sheet is anchored to the viewport's bottom edge and has no containing box
 * to measure (see `useDialogSurface`).
 */
import { useEffect, useState } from "react";
import type { RefObject } from "react";

export interface ElementWidthOptions<K extends string> {
  /**
   * Named widths to compare the element against, in CSS pixels — usually
   * derived from `@stapel/tokens`' breakpoints or `PANE_MEASURES` rather
   * than picked by hand.
   */
  readonly thresholds?: Readonly<Record<K, number>>;
}

export interface ElementWidthReading<K extends string> {
  /** The element's content-box width in CSS pixels, `undefined` until it has
   * been measured. */
  readonly width: number | undefined;
  /** `true` where the element is NARROWER than the named threshold,
   * `undefined` while the width is unknown. */
  readonly below: Readonly<Record<K, boolean | undefined>>;
}

function readBelow<K extends string>(
  width: number | undefined,
  thresholds: Readonly<Record<K, number>> | undefined
): Readonly<Record<K, boolean | undefined>> {
  const answers: Record<string, boolean | undefined> = {};
  if (thresholds !== undefined) {
    for (const [name, min] of Object.entries<number>(thresholds)) {
      answers[name] = width === undefined ? undefined : width < min;
    }
  }
  // The keys are exactly the caller's own threshold keys.
  return answers as Readonly<Record<K, boolean | undefined>>;
}

/**
 * Measure one element's width, live.
 *
 * ```tsx
 * const ref = useRef<HTMLDivElement | null>(null);
 * const { width, below } = useElementWidth(ref, { thresholds: { cards: breakpoints.tablet } });
 * const cards = below.cards ?? phone;
 * return <div ref={ref}>{cards ? <Cards/> : <Table/>}</div>;
 * ```
 *
 * The returned `below` object is rebuilt every render; read its booleans,
 * do not put it in a dependency array.
 */
export function useElementWidth<K extends string = never>(
  ref: RefObject<HTMLElement | null>,
  options?: ElementWidthOptions<K>
): ElementWidthReading<K> {
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return undefined;
    const commit = (next: number): void => {
      if (next <= 0) return;
      setWidth((previous) => (previous === next ? previous : next));
    };
    // The first read is synchronous: without an observer (jsdom, an older
    // engine) it is the only one there will ever be, and with one it saves
    // the first paint from a frame of "unmeasured".
    commit(element.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // `contentBoxSize` is the content box — padding and border excluded,
        // so the number compared against a threshold is the room the
        // children actually get.
        const box = entry.contentBoxSize[0];
        commit(box !== undefined ? box.inlineSize : entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return { width, below: readBelow(width, options?.thresholds) };
}
