/**
 * THE WIDTH OF THE BOX, NOT OF THE WINDOW.
 *
 * `<RevealPhoneButton>` is placed inside somebody else's card: a contact dock
 * on a phone, a ~300px buy column on a 1440px desktop, a seller page's wide
 * block. What it may draw on one line is decided by the width of THAT box, so
 * a viewport media query would get the desktop's narrow column wrong in
 * exactly the case the row has least room.
 *
 * The same shape `moderation-react`'s `elementWidth.ts`, `video-react`'s
 * `useNarrow` and `calendar-react`'s `useElementWidth` already carry (audit
 * GAP-B7 is a CLASS finding): it belongs beside `SkinDialog` in
 * `@stapel/tokens-antd/skin`, and is kept local until that lands rather than
 * blocking a row on it.
 *
 * ── Why the unmeasured answer is the NARROW one ──────────────────────────
 *
 * Before the first observation there is no width, and there is no
 * `ResizeObserver` at all on a server render. This hook's one caller uses the
 * width to decide whether a decorative word fits beside a number; the word is
 * carried by `aria-label`/`title` either way, so the unmeasured answer drops
 * it. A first paint that wraps onto a second line and settles back is the
 * jump this whole file exists to prevent.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

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
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const commit = (next: number): void => {
      // A detached or `display:none` element reports 0. That measures
      // nothing, and letting it through would answer "narrow" forever for a
      // box that is merely in a closed tab.
      if (next <= 0) return;
      setWidth((previous) => (previous === next ? previous : next));
    };

    if (typeof ResizeObserver !== "function") {
      commit(element.getBoundingClientRect().width);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const box = entry.contentBoxSize[0];
      commit(box !== undefined ? box.inlineSize : entry.contentRect.width);
    });
    observer.observe(element);
    commit(element.getBoundingClientRect().width);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, width };
}
