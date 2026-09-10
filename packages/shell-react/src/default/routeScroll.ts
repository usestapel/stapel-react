/**
 * WHERE A ROUTE LANDS — the top on a PUSH, where you left it on a POP.
 *
 * A single-page app changes the address without loading a document, so the
 * browser has no reason to move the viewport: the offset the reader had on the
 * page they LEFT is still the offset of the page they arrive at. On a
 * storefront that is not a subtlety, it is the whole bug — a card tapped two
 * thousand pixels down a feed opens a listing already scrolled past its own
 * photographs, which reads as "the page opened at the bottom".
 *
 * The shells own the `<Outlet/>`, so the shells own this. A host cannot state
 * the rule from outside without a component of its own above every route, and
 * every host would then state it slightly differently.
 *
 * ── The four cases, and why they are four ─────────────────────────────────
 *
 *  1. **PUSH to another page** — a card, a tile, a link. Lands at the top.
 *  2. **POP** — the browser's Back. Restores the offset that entry was left
 *     at. This is the other half of the same complaint: a feed that comes
 *     back at the top has thrown away the reader's place in it, and on an
 *     infinite feed that place is expensive to reach twice.
 *  3. **A hash** — `#terms`. The target wins; nothing is reset over it.
 *  4. **The same page, a different query** — a chip, a tab, `?step=`. Nothing
 *     moves. This is the case react-router's own `<ScrollRestoration/>` gets
 *     wrong for a storefront: it resets on every PUSH unless each individual
 *     `<Link>` and `navigate()` opts out with `preventScrollReset`, so one
 *     forgotten call site throws a filtering reader back to the top of the
 *     results. Here the rule is read off the address instead — same pathname,
 *     same page — and there is nothing per call site to forget.
 *
 * REPLACE is a fifth case and it is deliberately inert. A replace is an
 * address being CORRECTED under a screen that is already standing (`/new`
 * becoming `/new/<draft id>` on the first save, a canonical redirect), and a
 * composer that jumped to the top mid-sentence on its own autosave would be a
 * worse defect than the one this module exists to fix.
 *
 * ── The scroll container is the viewport ──────────────────────────────────
 *
 * Both shells scroll the DOCUMENT: `AppShell` and `PublicShell` set a
 * `minHeight`, never a `height` with an `overflow`, so no box between the
 * document and the route is a scrollport. That is why this reads and writes
 * `window` — and it is a real constraint on the shells, not an assumption
 * about them: a chrome that grew an inner scroller would have to move this
 * hook onto that element in the same change.
 *
 * ── Why a `scroll` listener here, of all places ───────────────────────────
 *
 * The offset a POP has to restore is the offset the OUTGOING page had at the
 * moment the navigation started, and by the time any effect of ours runs
 * React has already committed the incoming page's DOM — a shorter document,
 * against which the browser clamps `scrollY` before we can read it. So the
 * number has to have been taken earlier. The listener is `passive` and its
 * whole body is one assignment to a ref: no state, no render, no layout read
 * beyond the one the browser has already done to fire the event. Elsewhere in
 * this package a scroll listener is refused in favour of an
 * `IntersectionObserver` (`PublicShell`'s header flag) because the question
 * there is a THRESHOLD, which an observer answers off the main thread. There
 * is no observer that reports an offset.
 */
import { useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/**
 * How many history entries' offsets one session remembers. A number rather
 * than an unbounded map: the keys are minted per navigation and a long
 * session on a feed makes thousands of them. The oldest goes first, which is
 * the entry a reader is least likely to reach with Back.
 */
const OFFSETS_KEPT = 64;

/** Bank one entry's offset, dropping the oldest once the cap is reached. */
function bank(offsets: Map<string, number>, key: string, value: number): void {
  offsets.delete(key);
  offsets.set(key, value);
  while (offsets.size > OFFSETS_KEPT) {
    const oldest = offsets.keys().next().value;
    if (oldest === undefined) break;
    offsets.delete(oldest);
  }
}

/**
 * Scroll to a hash target if it is already in the document.
 *
 * Returns whether it found one. A hash whose element has not rendered yet —
 * a page still fetching — is answered by the caller, not guessed at here.
 */
function toHash(hash: string): boolean {
  if (hash === "" || typeof document === "undefined") return false;
  let target: Element | null = null;
  try {
    target = document.getElementById(decodeURIComponent(hash.slice(1)));
  } catch {
    // A hash that is not decodable is not an element id. Not an error.
    return false;
  }
  // `scrollIntoView` does not exist in jsdom, and a chrome must not throw out
  // of an effect for a test environment.
  if (target === null || typeof target.scrollIntoView !== "function") return false;
  target.scrollIntoView();
  return true;
}

/**
 * The rule stated above, as a hook. Called by `<AppShell/>` and
 * `<PublicShell/>`; exported so a host with its own chrome can state the same
 * rule without copying it.
 *
 * `enabled` is the shells' `scrollRestoration` prop. Passing `false` leaves
 * the viewport entirely alone — including `history.scrollRestoration`, which
 * this hook otherwise takes over for as long as it is mounted, exactly as
 * react-router's `<ScrollRestoration/>` does. The two must not both run: a
 * host that mounts react-router's component is the reason the prop exists.
 */
export function useRouteScrollReset(enabled: boolean): void {
  const location = useLocation();
  const navigationType = useNavigationType();

  /** The live offset of the entry on screen. A ref: writing it costs no
   * render, which is what makes a per-frame listener affordable. */
  const offset = useRef(0);
  /** Offset per history entry, keyed by `location.key`. */
  const offsets = useRef<Map<string, number>>(new Map());
  /** The entry this hook last saw, or `null` before the first one. */
  const seen = useRef<{ key: string; pathname: string } | null>(null);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    // Manual for as long as this is mounted: the browser's own restoration
    // fires against a document the app has not finished rendering, so it
    // lands on the wrong offset and then fights the right one.
    window.history.scrollRestoration = "manual";
    const record = (): void => {
      offset.current = window.scrollY;
    };
    window.addEventListener("scroll", record, { passive: true });
    return () => {
      window.removeEventListener("scroll", record);
      window.history.scrollRestoration = "auto";
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const previous = seen.current;
    seen.current = { key: location.key, pathname: location.pathname };

    // The first location is the one the browser itself placed — a deep link
    // opened at the top, a reload the browser restored. Nothing to correct.
    if (previous === null) {
      offset.current = window.scrollY;
      return;
    }
    // The same entry twice: a re-render, or an effect re-run under
    // StrictMode. Not a navigation, and banking here would overwrite the
    // outgoing offset with the incoming one.
    if (previous.key === location.key) return;

    bank(offsets.current, previous.key, offset.current);

    const settle = (top: number): void => {
      window.scrollTo(0, top);
      offset.current = top;
    };

    if (navigationType === "POP") {
      // An entry with no banked offset is one from before a reload: the top
      // is the honest answer, and it is what the browser would have done.
      settle(offsets.current.get(location.key) ?? 0);
      return;
    }
    if (navigationType === "REPLACE") {
      offset.current = window.scrollY;
      return;
    }
    // PUSH.
    if (toHash(location.hash)) {
      offset.current = window.scrollY;
      return;
    }
    // A chip, a tab, `?step=` — the same page under a different query.
    if (location.pathname === previous.pathname) {
      offset.current = window.scrollY;
      return;
    }
    settle(0);
  }, [enabled, location, navigationType]);
}
