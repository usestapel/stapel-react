/**
 * The master/detail rule: a two-pane split becomes ONE pane at a time when
 * the box it lives in is too narrow for two.
 *
 * ── The defect this ends ──────────────────────────────────────────────────
 *
 * `FileManager` gave its folder tree `flex: "0 0 240px"` beside the document
 * list with no branch of any kind, so a 390px phone got a desktop two-pane
 * file manager with ~150px left for the list — the flagship surface of this
 * pair, unusable on the device most people open it on.
 *
 * ── Element width, not the viewport ───────────────────────────────────────
 *
 * The house rule is "geometry from the element's own width, never from the
 * viewport": a file manager mounted in a 380px side panel on a 1440px desktop
 * has exactly the phone's problem, and a viewport query answers "desktop" for
 * it. So this measures the CONTAINER through a `ResizeObserver` and decides
 * from that. The viewport is used only as the first answer, before any
 * measurement exists (a server render, the frame before the observer fires) —
 * where there is no box to measure, the viewport's shape is the best
 * available guess, and it is replaced the moment a real width arrives.
 *
 * ── Where this belongs ────────────────────────────────────────────────────
 *
 * In `@stapel/tokens-antd/skin`, beside `SkinDialog`'s bottom-sheet rule and
 * `SkinTheme`'s 44px controls — one responsive-pane primitive every pair
 * inherits instead of each writing a media query. The substrate does not ship
 * one yet, so it lives here, exported, and is recorded in the wave's REQUESTS
 * file as a `SkinSplitPane`/`useSkinLayout` candidate for the shared layer.
 */
import { useCallback, useState } from "react";
import { breakpoints } from "@stapel/tokens";
import { useBreakpoint } from "@stapel/core";

/**
 * At or below this container width a master/detail pair stacks into one pane.
 * The same `@stapel/tokens` `tablet` edge the bottom-sheet rule uses, so a
 * surface does not change shape at one width and its dialogs at another.
 */
export const SPLIT_STACK_WIDTH: number = breakpoints.tablet;

/** What {@link useSplitLayout} hands its caller. */
export interface SplitLayout {
  /** Attach to the element whose width decides the layout. */
  readonly containerRef: (node: HTMLElement | null) => void;
  /** One pane at a time (the container is narrower than {@link SPLIT_STACK_WIDTH}). */
  readonly stacked: boolean;
  /** The measured container width, `null` until the observer has answered. */
  readonly width: number | null;
}

/**
 * Measure the container and say whether a master/detail pair must stack.
 *
 * ```tsx
 * const { containerRef, stacked } = useSplitLayout();
 * <div ref={containerRef}>{stacked ? <OnePane/> : <TwoPanes/>}</div>
 * ```
 */
export function useSplitLayout(): SplitLayout {
  const [width, setWidth] = useState<number | null>(null);
  const viewport = useBreakpoint();

  const containerRef = useCallback((node: HTMLElement | null) => {
    if (node === null) {
      setWidth(null);
      return;
    }
    setWidth(node.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) setWidth(entry.contentRect.width);
    });
    observer.observe(node);
    // React 19 calls a ref callback's return value as its cleanup.
    return () => {
      observer.disconnect();
    };
  }, []);

  // A measured width of 0 is what an unlaid-out element (and jsdom) reports;
  // it is an absence of information, not a very narrow box, so it falls
  // through to the viewport answer rather than declaring every hidden pane
  // a phone.
  const measured = width !== null && width > 0 ? width : null;
  const stacked =
    measured !== null ? measured < SPLIT_STACK_WIDTH : viewport === "phone";

  return { containerRef, stacked, width: measured };
}
