/**
 * ELEMENT WIDTH, NOT VIEWPORT WIDTH.
 *
 * The console is the surface where this matters most: a moderation queue is
 * routinely mounted inside an admin shell's content column, a split view, or a
 * drawer beside the thing being moderated. antd's `Row`/`Col` breakpoints are
 * CSS media queries on the VIEWPORT, so a 380px panel on a 1920px desktop
 * would still get the eight-column table — unreadable — while the same markup
 * at 900px of viewport inside a narrow container would get the phone layout.
 *
 * `useDialogSurface()` (the sheet rule) answers the same question for DIALOGS
 * and is right there, because a dialog IS the viewport on a phone. A table
 * inside a container is not, which is why the queue measures itself.
 *
 * ── Why the unmeasured answer is the WIDE one ─────────────────────────────
 *
 * Before the first observation there is no width. A first paint that is briefly
 * a table and settles into cards is a reflow; one that is cards and settles
 * into a table is a visible jump on every desktop load. Server renders and
 * environments without `ResizeObserver` stay on the wide answer, which has
 * always been the safe default for a container of unknown size.
 *
 * This is billing-react's `elementWidth.ts` shape (audit GAP-B7 is a CLASS
 * finding — every pair using viewport breakpoints has it); it belongs beside
 * `SkinDialog` in `@stapel/tokens-antd/skin` and is filed as such.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { breakpoints } from "@stapel/tokens";

/** Below this, an operations table becomes a card list. The tablet breakpoint
 * from `@stapel/tokens` — the same number the dialog surface splits on, so
 * "narrow" means one thing across the skin. */
export const TABLE_MIN_WIDTH: number = breakpoints.tablet;

/** Does this width get cards instead of a table? `undefined` (not measured
 * yet, no observer, server render) answers `false` — see the module note. */
export function isNarrowWidth(width: number | undefined): boolean {
  return width !== undefined && width < TABLE_MIN_WIDTH;
}

/** What {@link useElementWidth} hands back. */
export interface ElementWidth<T extends HTMLElement = HTMLElement> {
  /** Put this on the element whose width decides the layout. */
  readonly ref: RefObject<T | null>;
  /** Its content-box width in CSS pixels, or `undefined` before the first
   * observation. */
  readonly width: number | undefined;
}

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
      const next = entry.contentRect.width;
      // A detached or `display:none` element reports 0. That measures nothing,
      // and letting it through would collapse a hidden tab to cards for good.
      if (next <= 0) return;
      setWidth((previous) => (previous === next ? previous : next));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}
