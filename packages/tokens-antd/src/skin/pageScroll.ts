/**
 * Hold the document still while something stands over it — a dialog, a
 * sheet, a mega menu.
 *
 * `overflow: hidden` on the ROOT element, as an inline style that beats any
 * sheet the host wrote (a host's `html { overflow-x: clip }` would otherwise
 * make the viewport ignore anything set on `body`). Reference-counted,
 * because two panels may overlap — a picker sheet inside a host's own dialog,
 * a mega menu under a confirm — and the inner one closing must not hand the
 * page back while the outer one stands. The previous inline values are
 * restored exactly when the last lock lets go.
 *
 * `scrollbar-gutter: stable` beside it keeps a classic scrollbar's gutter
 * while the bar itself is gone, so a page with one does not widen by 15px
 * under the panel the moment it opens and snap back when it closes.
 *
 * This is the one copy: `SkinDialog` holds it for every dialog surface, and a
 * component that stands over the page without being a dialog calls it from
 * the same effect it opens in. No `body` juggling, no `position: fixed` with
 * a remembered scroll offset — the root's overflow is the whole mechanism.
 */
let pageScrollLocks = 0;
let unlockedRoot: { readonly overflow: string; readonly gutter: string } | null = null;

/**
 * Lock page scroll; returns the matching unlock. Call it when the panel
 * opens, call the returned function when it closes (an effect's cleanup is
 * the natural place). Safe without a document (SSR): a no-op pair.
 */
export function lockPageScroll(): () => void {
  if (typeof document === "undefined") return () => undefined;
  const root = document.documentElement;
  pageScrollLocks += 1;
  if (pageScrollLocks === 1) {
    unlockedRoot = {
      overflow: root.style.overflow,
      gutter: root.style.scrollbarGutter,
    };
    root.style.overflow = "hidden";
    root.style.scrollbarGutter = "stable";
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    pageScrollLocks -= 1;
    if (pageScrollLocks > 0) return;
    const previous = unlockedRoot;
    unlockedRoot = null;
    if (previous === null || previous.overflow === "") {
      root.style.removeProperty("overflow");
    } else {
      root.style.overflow = previous.overflow;
    }
    if (previous === null || previous.gutter === "") {
      root.style.removeProperty("scrollbar-gutter");
    } else {
      root.style.scrollbarGutter = previous.gutter;
    }
  };
}

/** How many locks are held right now — for tests and for a host's debugging
 * overlay; not a signal to branch UI on. */
export function pageScrollLockCount(): number {
  return pageScrollLocks;
}
