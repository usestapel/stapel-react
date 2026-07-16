import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface ImageSlotSize {
  width: number;
  height: number;
}

export interface ImageSlot<T extends HTMLElement = HTMLElement> {
  ref: RefObject<T | null>;
  /** `undefined` until mounted and first measured (SSR-safe, useBreakpoint pattern). */
  size: ImageSlotSize | undefined;
}

/**
 * Measures the rendered slot of an element with a ResizeObserver
 * (images-and-cdn.md §4). SSR-safe: `size` is `undefined` until mounted, so
 * server and first client render agree.
 *
 * High-water-mark per axis: the reported size only ever GROWS. A transient
 * shrink (splitter drag, viewport resize down, sidebar toggle) must not
 * re-pick a smaller, already-loaded tier — upgrades only (§4 "докачка только
 * вверх").
 */
export function useImageSlot<T extends HTMLElement = HTMLElement>(): ImageSlot<T> {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<ImageSlotSize | undefined>(undefined);

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }

    const grow = (width: number, height: number): void => {
      if (width <= 0 && height <= 0) {
        return;
      }
      setSize((prev) => {
        const next = {
          width: Math.max(prev?.width ?? 0, width),
          height: Math.max(prev?.height ?? 0, height),
        };
        if (prev !== undefined && next.width === prev.width && next.height === prev.height) {
          return prev;
        }
        return next;
      });
    };

    if (typeof ResizeObserver === "undefined") {
      // Environment without ResizeObserver: single static measurement.
      const rect = el.getBoundingClientRect();
      grow(rect.width, rect.height);
      return;
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const box = entry.contentBoxSize[0];
        if (box !== undefined) {
          grow(box.inlineSize, box.blockSize);
        } else {
          grow(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size };
}
