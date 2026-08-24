import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";

export interface ImageSlotSize {
  width: number;
  height: number;
}

export interface ImageSlot<T extends HTMLElement = HTMLElement> {
  ref: RefObject<T | null>;
  /** `undefined` until mounted and first measured (SSR-safe). */
  size: ImageSlotSize | undefined;
}

export interface ImageSlotOptions {
  /**
   * How long the element has to hold still before a new size is reported, in
   * ms. A resize is not one event — dragging a window edge fires the observer
   * dozens of times a second, and every intermediate width that reported would
   * be a tier decision, i.e. potentially a fetch. Default 120ms: below the
   * threshold where a person notices the image sharpening late, above the
   * length of any drag frame. `0` reports on the very next frame.
   */
  readonly settleMs?: number;
}

const DEFAULT_SETTLE_MS = 120;

/**
 * The rendered size of ONE element, in CSS pixels — the number a variant is
 * chosen from.
 *
 * ## What changed, and why the high-water mark had to go
 *
 * This hook used to report a per-axis HIGH-WATER MARK: the size only ever
 * grew, so a slot that shrank kept reporting its largest past size forever.
 * The intent was right — never re-fetch a smaller variant for an image already
 * on screen — but it was enforced in the wrong place, and enforcing it here
 * cost three things:
 *
 *  1. **it stopped being a measurement.** A page that lays out wide and then
 *     settles narrow (a card grid before its container query resolves, a
 *     flex row that wraps, a phone that starts in landscape) measured the
 *     WIDE box once and was frozen there — so a 96px thumbnail asked for the
 *     tier a 900px hero needs. "Small images must get small webp" cannot be
 *     true while the measurement is a maximum.
 *  2. **the two axes were maxed independently**, so `size` could describe a
 *     box that never existed — the widest width the element ever had beside
 *     the tallest height it ever had. `chooseVariant` derives the slot ASPECT
 *     from that pair, and the aspect decides the limiting axis. A box that
 *     never existed can pick the wrong axis entirely.
 *  3. **"never downgrade" is a statement about the NETWORK, not about the
 *     ruler.** It is only true once a larger variant is actually loaded and
 *     painted; before that, re-picking smaller is exactly right. Freezing the
 *     ruler applied the rule to the case it was never about.
 *
 * So the rule moved to where it belongs — `<Image>`'s load effect, which
 * knows what is on screen — and this hook now answers the question it is
 * named for: how big is this element, right now. It stays cheap by
 * coalescing: the observer's bursts are collapsed to one frame, and a new
 * size is reported only after the element has held still for `settleMs`.
 *
 * SSR-safe: `size` is `undefined` until mounted, so server and first client
 * render agree.
 */
export function useImageSlot<T extends HTMLElement = HTMLElement>(
  options?: ImageSlotOptions
): ImageSlot<T> {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ImageSlotSize | undefined>(undefined);
  const settleMs = options?.settleMs ?? DEFAULT_SETTLE_MS;

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }

    let frame: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: ImageSlotSize | null = null;

    const commit = (): void => {
      const next = pending;
      pending = null;
      if (next === null) {
        return;
      }
      setSize((prev) =>
        prev !== undefined && prev.width === next.width && prev.height === next.height
          ? prev
          : next
      );
    };

    /**
     * A box with a zero side is not a measurement of anything — it is the
     * element before layout, or display:none. Reporting it would make
     * `chooseVariant` divide by zero on the aspect. (The guard this replaces
     * used `&&`, so a `200 × 0` box got through and pinned an axis at 0.)
     */
    const observe = (width: number, height: number): void => {
      if (width <= 0 || height <= 0) {
        return;
      }
      pending = { width, height };
      if (settleMs <= 0) {
        if (frame !== null) {
          return;
        }
        frame = requestAnimationFrame(() => {
          frame = null;
          commit();
        });
        return;
      }
      // Trailing debounce: the LAST size of a drag is the one that matters,
      // and every intermediate one is a tier decision nobody asked for.
      if (timer !== null) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = null;
        commit();
      }, settleMs);
    };

    if (typeof ResizeObserver === "undefined") {
      // Environment without ResizeObserver: one static measurement, reported
      // immediately — there is nothing to debounce and nothing that will
      // report a second time.
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: rect.width, height: rect.height });
      }
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize[0];
        if (box !== undefined) {
          observe(box.inlineSize, box.blockSize);
        } else {
          observe(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      if (timer !== null) {
        clearTimeout(timer);
      }
    };
  }, [settleMs]);

  return { ref, size };
}

function dprSnapshot(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  return window.devicePixelRatio || 1;
}

/** The server has no screen; 1 is the only honest answer, and the client
 * corrects it on the first render after hydration. */
function dprServerSnapshot(): number {
  return 1;
}

function subscribeToDpr(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  // There is no `devicePixelRatio` event. The documented way to hear about a
  // change is a media query pinned to the CURRENT ratio, which stops matching
  // the moment the ratio moves — so the listener is re-armed after each one.
  let query = window.matchMedia(`(resolution: ${String(dprSnapshot())}dppx)`);
  let disposed = false;
  const handler = (): void => {
    if (disposed) {
      return;
    }
    query.removeEventListener("change", handler);
    query = window.matchMedia(`(resolution: ${String(dprSnapshot())}dppx)`);
    query.addEventListener("change", handler);
    onChange();
  };
  query.addEventListener("change", handler);
  return () => {
    disposed = true;
    query.removeEventListener("change", handler);
  };
}

/**
 * The device pixel ratio, re-read when it changes.
 *
 * It is not a constant: browser zoom changes it, and so does dragging a window
 * between a Retina display and a 1× one. Read once at mount, a slot on the 1×
 * monitor keeps its 1× tier after the window moves to the 2× one and stays
 * visibly soft — the one case where "recompute on layout change" is not about
 * layout at all.
 *
 * Unlike a slot size this IS a device-wide fact, so a global query is the
 * right instrument here; the geometry that must never come from a global is
 * the ELEMENT's size, which {@link useImageSlot} measures per element.
 */
export function useDevicePixelRatio(): number {
  return useSyncExternalStore(subscribeToDpr, dprSnapshot, dprServerSnapshot);
}
