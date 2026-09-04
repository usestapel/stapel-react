/**
 * The card gallery's two gestures — the ones a classified is expected to have
 * and this pair did not.
 *
 * ── Hover scrub, on a device that has a pointer ──────────────────────────
 *
 * A card with six photographs showed one, and the only way to the other five
 * was to open the listing. Every mature classified answers this the same way:
 * the media box is divided into N equal segments, and the segment the cursor
 * is over IS the photograph on screen. Six photos become six glances and no
 * clicks, and the pointer leaving puts the first photo back — the card must
 * be in the same state after a hover as before one, or a grid of forty tiles
 * becomes forty different tiles depending on where a cursor happened to pass.
 *
 * It is gated on `(hover: hover) and (pointer: fine)` and on a `mouse`
 * pointer type, both, and the two gates are not redundant: the media query
 * says the DEVICE has a real pointer, the pointer type says THIS gesture came
 * from it. A touch laptop answers `hover: hover` and still delivers finger
 * events, and a scrub driven by a finger dragging across the box is the
 * gesture below wearing the wrong costume.
 *
 * ── Swipe, on a device that does not ─────────────────────────────────────
 *
 * A finger gets the same six photographs by swiping horizontally, one photo
 * per swipe, in either direction.
 *
 * The rule that matters is the one about the OTHER axis: a card is a small
 * box inside a long scrolling feed, and a gesture layer that treats every
 * touch as its own turns the page into something that will not scroll. So
 * the strip declares `touch-action: pan-y` — the browser keeps the vertical
 * axis, unconditionally, and can never be argued out of it — and this hook
 * only acts on a drag that has declared horizontal INTENT: past
 * {@link SWIPE_MIN_PX}, and further across than down by
 * {@link SWIPE_AXIS_RATIO}. A diagonal thumb scrolling the feed changes no
 * photograph.
 *
 * ── What neither gesture touches ─────────────────────────────────────────
 *
 * The keyboard, and the card's single link target. The strip underneath is
 * still `<SkinCarousel>`: a real scroll container, a tab stop, arrow-key
 * scrollable, with the slides in the document and its own dots reporting the
 * position. Both gestures below work by SCROLLING it — they set no state the
 * strip does not already publish — so what a keyboard reaches, what a screen
 * reader reads and what the dots say are unchanged, and the card stays one
 * anchor with one accessible name.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

/** The class the gallery's own box carries — see {@link cardGalleryCss}. */
export const CARD_GALLERY_CLASS = "stapel-listing-gallery";
/** The `href` the hoisted gallery stylesheet is deduplicated by. */
export const CARD_GALLERY_STYLE_HREF = "stapel-listings-card-gallery";

/** The environment a hover scrub is allowed in, and the only one. */
export const SCRUB_MEDIA = "(hover: hover) and (pointer: fine)";

/**
 * How far a finger travels before it has said "photo", in CSS pixels.
 *
 * Under this, a drag is a tap that wobbled — and a tap on a card is a
 * navigation, so a low threshold does not change a photograph, it changes one
 * and then leaves the listing.
 */
export const SWIPE_MIN_PX = 32;

/**
 * How much more horizontal than vertical a drag must be to count.
 *
 * 1.2 rather than 1: a thumb scrolling a feed travels a few degrees off
 * vertical, and a bare `|dx| > |dy|` comparison hands the gesture to the
 * gallery on the first pixel where the wobble wins.
 */
export const SWIPE_AXIS_RATIO = 1.2;

/**
 * Which of `count` equal segments the pointer is over.
 *
 * Clamped at both ends: `offsetX` can be reported one pixel past the box's
 * own width, and an index of `count` is a photograph that does not exist.
 */
export function segmentIndex(offsetX: number, width: number, count: number): number {
  if (count <= 1 || width <= 0) return 0;
  const raw = Math.floor((offsetX / width) * count);
  return Math.min(count - 1, Math.max(0, raw));
}

/**
 * A drag → the number of photographs it asks for: `1` forward, `-1` back, `0`
 * for a drag that has not declared horizontal intent.
 *
 * Dragging LEFT advances, the direction the content moves under the finger —
 * the same mapping the native scroller has.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  const across = Math.abs(dx);
  if (across < SWIPE_MIN_PX) return 0;
  if (across <= Math.abs(dy) * SWIPE_AXIS_RATIO) return 0;
  return dx < 0 ? 1 : -1;
}

/** Does this environment have a real pointer? `false` where there is no
 * `matchMedia` to ask (a server render, an old jsdom), which is the safe
 * side: a scrub that does not happen costs a hover, a scrub on a phone is a
 * photograph that changes when nobody touched it. */
export function hasFinePointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(SCRUB_MEDIA).matches;
  } catch {
    return false;
  }
}

/**
 * {@link hasFinePointer}, as state.
 *
 * It opens `false` and settles in an effect rather than reading the media
 * query during render: a server render has no `matchMedia`, and a first
 * client render that disagreed with it is a hydration mismatch on every card
 * on the page. Nothing is drawn differently either way — the flag only gates
 * a gesture — so the one frame it costs is invisible.
 */
export function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    let query: MediaQueryList;
    try {
      query = window.matchMedia(SCRUB_MEDIA);
    } catch {
      return;
    }
    setFine(query.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setFine(event.matches);
    };
    // `addEventListener` is the modern spelling; Safari < 14 has only
    // `addListener`, and a card grid that throws on mount there is worse than
    // one that never notices a device changing its pointer.
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => {
        query.removeEventListener("change", onChange);
      };
    }
    return;
  }, []);
  return fine;
}

/** The handlers and the box reference a gallery hands its media well. */
export interface CardGallery {
  readonly ref: RefObject<HTMLDivElement | null>;
  /** The photograph currently on screen. */
  readonly active: number;
  /** True while a pointer is scrubbing — the box publishes it so the strip's
   * smooth-scroll can be switched off for the duration. */
  readonly scrubbing: boolean;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  readonly onPointerLeave: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

/** Scroll the strip inside `box` so that slide `index` is at its leading
 * edge. Rectangles rather than `scrollLeft / slideWidth`, for the reason
 * `SkinCarousel`'s own `nearestSlideIndex` gives: the arithmetic version has
 * to know the gap, the peek and the writing direction. */
function showSlide(box: HTMLElement, index: number, instant: boolean): void {
  const strip = box.querySelector<HTMLElement>("[data-stapel-carousel-strip]");
  if (strip === null) return;
  const slide = strip.children.item(index);
  if (slide === null) return;
  const left =
    slide.getBoundingClientRect().left - strip.getBoundingClientRect().left + strip.scrollLeft;
  if (typeof strip.scrollTo === "function") {
    strip.scrollTo({ left, behavior: instant ? "auto" : "smooth" });
  } else {
    strip.scrollLeft = left;
  }
}

/**
 * The gallery gestures for a media well holding `count` photographs.
 *
 * A well with one photograph gets an inert bag: every handler returns
 * immediately, so a grid of forty single-photo tiles pays for nothing.
 */
export function useCardGallery(count: number): CardGallery {
  const ref = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  // The origin of the drag in progress, or `null`. A ref rather than state:
  // it changes on every move and no render depends on it.
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fine = useFinePointer();
  const many = count > 1;

  // The one place the strip is driven. `active` is the whole state of both
  // gestures, so neither handler talks to the DOM.
  useEffect(() => {
    const box = ref.current;
    if (box === null || !many) return;
    showSlide(box, active, scrubbing);
  }, [active, scrubbing, many]);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!many) return;
      if (event.pointerType === "mouse") {
        if (!fine) return;
        const box = ref.current;
        if (box === null) return;
        const rect = box.getBoundingClientRect();
        setScrubbing(true);
        setActive(segmentIndex(event.clientX - rect.left, rect.width, count));
        return;
      }
      const from = origin.current;
      if (from === null) return;
      const step = swipeStep(event.clientX - from.x, event.clientY - from.y);
      if (step === 0) return;
      // The origin moves with the commit, so a long drag walks the strip one
      // photograph per threshold rather than one per gesture.
      origin.current = { x: event.clientX, y: event.clientY };
      setScrubbing(false);
      setActive((current) => Math.min(count - 1, Math.max(0, current + step)));
    },
    [count, fine, many]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>): void => {
      if (!many || event.pointerType === "mouse") return;
      origin.current = { x: event.clientX, y: event.clientY };
    },
    [many]
  );

  const endDrag = useCallback((): void => {
    origin.current = null;
  }, []);

  const onPointerLeave = useCallback((): void => {
    origin.current = null;
    if (!many) return;
    // The card goes back to the photograph it was drawn with. A hover is a
    // look, not an edit.
    setScrubbing(false);
    setActive(0);
  }, [many]);

  return {
    ref,
    active,
    scrubbing,
    onPointerMove,
    onPointerDown,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onPointerLeave,
  };
}

/**
 * The rules an inline style cannot reach: they apply to the STRIP inside the
 * carousel, which this package renders through a component and does not hold
 * a handle on.
 */
export function cardGalleryCss(): string {
  const box = `.${CARD_GALLERY_CLASS}`;
  return [
    // THE VERTICAL AXIS IS THE BROWSER'S, and is not negotiable: a card is a
    // small box in a long feed, and the one unacceptable outcome of a gallery
    // gesture is a page that will not scroll. `pan-y` says so at the platform
    // level, where no handler can argue with it, and takes the horizontal
    // axis for the swipe above.
    `${box} [data-stapel-carousel-strip]{touch-action:pan-y}`,
    // A per-pixel scrub must not animate: the strip's own `scroll-behavior:
    // smooth` is right for a swipe committing one photograph and turns a
    // cursor sweep into a queue of easing curves finishing after the pointer
    // has left.
    `${box}[data-scrubbing="true"] [data-stapel-carousel-strip]{scroll-behavior:auto}`,
  ].join("");
}
