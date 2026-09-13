/**
 * HOW THE LISTING PAGE LAYS OUT ITS PHOTOGRAPHS — and why the answer is a
 * class and a prop rather than an inline `display`.
 *
 * ── The defect a container was carrying ───────────────────────────────────
 *
 * The gallery is an element-width grid (`repeat(auto-fit, minmax(14rem,
 * 1fr))`), which on a 390px phone resolves to ONE column: a listing with three
 * pictures pushes its own title and price nearly three screens down, and the
 * first thing a person sees after tapping a search result is a photograph with
 * nothing beside it. A phone lays photographs out as a snap-scrolling STRIP —
 * one visible with the next peeking, title and price directly under it.
 *
 * That is layout, and layout is the container's to decide. But the pane wrote
 * `display: grid` INLINE, and an inline declaration is beaten by nothing that
 * is not `!important` — so a live storefront carried
 * `[data-testid="listings-detail-gallery"] { display: flex !important }`
 * against a pair's own geometry, named by a test id, to say a thing the pair
 * offered no way to say (a client storefront's own stylesheet, §2).
 *
 * ── The seam ──────────────────────────────────────────────────────────────
 *
 * Two halves, and both matter:
 *
 *  1. `<ListingDetailPane galleryLayout>` — the pane ships BOTH layouts and
 *     the host names one, exactly as it already names `layout="split"` and
 *     `gutter`. The host is the side that knows the viewport it granted;
 *     a media query guessed in a leaf is the thing this package does not do.
 *  2. `display` and the track are no longer inline. They live on this
 *     stylesheet, at one class plus one attribute, so a host that wants
 *     something neither arm offers can still write CSS for it at its own
 *     breakpoints — and needs no `!important` to be heard, only a selector of
 *     its own (`[data-testid="listings-detail-gallery"][data-gallery-layout]`
 *     ties; add any third condition and it wins).
 *
 * What stays inline is what nobody overrides and what a stylesheet would make
 * worse: the `gap` (the page's own responsive gutter token, D418 — a var, so
 * a resize reflows it) and `position: relative`, which is the containing block
 * the `actionsPlacement="gallery"` overlay is pinned to.
 *
 * ── WHERE THE STRIP IS, and why a tap could not answer it ─────────────────
 *
 * The strip arm is a native scroll container: a finger moves it, a fling
 * settles it on a snap point, and neither of those is an event this package
 * fires. So the page carried a strip that scrolled correctly and a "1 of 7"
 * that did not move — measured on the reference walk (§20b: `scrollLeft`
 * driven a full slide, the indicator still reading the first photograph).
 * Anything keyed off a TAP is the wrong instrument here, because the gesture
 * that changes the photograph is not a tap.
 *
 * {@link useGalleryPosition} is the answer, and it is the strip's own
 * `scroll` event throttled to one measurement per animation frame — the same
 * shape `SkinCarousel` already uses for the card's dots, written here because
 * the detail gallery is this package's own element and mounts no carousel.
 * `scrollend` is deliberately NOT the trigger: Safari has no such event, and
 * an indicator that only settles is an indicator that lies for the length of
 * a fling. The index is read from live rectangles rather than from
 * `scrollLeft / slideWidth`, for the reason `nearestSlideIndex` gives: the
 * arithmetic version has to know the gap, the peek and the writing direction.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { cssVar, fontSize, radii, spacing } from "@stapel/tokens";

/**
 * The narrowest a gallery tile may get before the grid drops a column. A
 * measure rather than a pixel: the tiles then fill whatever the ELEMENT is,
 * which is §83's geometry rule — one photo per row on a phone, three on a
 * desktop pane, and no `width: 320` that is near-full-bleed on one and a
 * postage stamp on the other.
 *
 * Declared here rather than in `<ListingDetailPane>` because this is the file
 * that writes the track it feeds; the pane re-exports it, so the public name
 * is unchanged.
 */
export const DETAIL_PHOTO_MIN = "14rem";

/**
 * Which shape the photographs take. See the file header, and
 * {@link ListingHeroGallery} for the third.
 *
 *  - `"grid"` — the element-width grid this pane has always drawn;
 *  - `"strip"` — the phone's snap-scrolling row;
 *  - `"hero"` — the DESKTOP's anatomy: one large photograph, a filmstrip of
 *    thumbnails under it, and a lightbox behind a click on the large one.
 */
export type ListingGalleryLayout = "grid" | "strip" | "hero";

/** The class the gallery box carries. */
export const LISTINGS_GALLERY_CLASS = "stapel-listings-detail-gallery";

/** The `href` the hoisted gallery stylesheet is deduplicated by. */
export const LISTINGS_GALLERY_STYLE_HREF = "stapel-listings-detail-gallery";

/** The class the strip's "3 of 16" pill carries. */
export const LISTINGS_GALLERY_COUNTER_CLASS = "stapel-listings-detail-count";

/**
 * The class on the box that HOLDS the strip and its counter.
 *
 * A frame rather than the gallery itself, and the reason is mechanical: in the
 * strip arm the gallery element IS the scroll container, and an absolutely
 * positioned child of a scroller is laid out against its padding box — it
 * scrolls away with the third photograph. It also cannot be a child of the
 * strip at all, because `> *` makes every child a slide. So the counter is a
 * sibling of the strip inside a box that does not scroll.
 */
export const LISTINGS_GALLERY_FRAME_CLASS = "stapel-listings-detail-gallery-frame";

/* ── THE HERO ARM ──────────────────────────────────────────────────────────
 *
 * A desktop reads photographs the way the reference classified draws them:
 * ONE large picture with a row of thumbnails under it, and the whole set
 * behind a click on the large one. The grid arm answered none of that — every
 * photograph at the same size, nothing to click, and no way to see one bigger
 * than a third of the reading column (walk of 2026-09-12).
 *
 * These four classes are the arm's geometry, hoisted for the same reason the
 * strip's is: a thumbnail's flex basis and the lightbox's `:focus-visible`
 * cannot be said in a style attribute, and a host that wants a fifth shape
 * needs a selector rather than an `!important` over inline geometry.
 */

/** The class on the button holding the large photograph. */
export const LISTINGS_HERO_CLASS = "stapel-listings-detail-hero";

/** The class on the row of thumbnails under the hero. */
export const LISTINGS_FILMSTRIP_CLASS = "stapel-listings-detail-filmstrip";

/** The class one thumbnail button carries. */
export const LISTINGS_THUMB_CLASS = "stapel-listings-detail-thumb";

/** The class on the lightbox's own row: arrow, stage, arrow. */
export const LISTINGS_LIGHTBOX_CLASS = "stapel-listings-lightbox";

/** The class on the box the lightbox's photograph stands in — the element a
 * swipe is measured against. */
export const LISTINGS_LIGHTBOX_STAGE_CLASS = "stapel-listings-lightbox-stage";

/**
 * How wide ONE thumbnail is.
 *
 * A measure and not a pixel count, the same rule {@link DETAIL_PHOTO_MIN}
 * follows: the filmstrip scrolls when the set is longer than the row, so the
 * number decides how many thumbnails a reader sees at once and nothing else.
 * At 5rem a 1440px page shows about a dozen before the strip scrolls, which
 * is more photographs than a classified listing usually has.
 */
export const DETAIL_THUMB_SIZE = "5rem";

/**
 * The tallest the lightbox's photograph gets.
 *
 * `dvh` and not `vh`, for the reason the sheet's own maximum gives: on mobile
 * Safari `vh` is the tallest the viewport ever gets, so a picture sized
 * against it hides its own controls under the browser chrome.
 */
export const LIGHTBOX_MAX_HEIGHT = "78dvh";

/**
 * How much of the strip's width ONE photograph takes.
 *
 * Not 100: the remaining sliver of the next picture is the only thing on a
 * phone that says the strip scrolls at all. Exported so a host laying out
 * beside it measures against the same number instead of guessing it back out
 * of a screenshot.
 */
export const LISTINGS_GALLERY_STRIP_BASIS = "86%";

/**
 * The index of the child whose leading edge is nearest the box's.
 *
 * Exported because it is the whole claim of {@link useGalleryPosition} and a
 * test can put rectangles in front of it without a layout engine.
 */
export function nearestPhotoIndex(box: HTMLElement): number {
  const origin = box.getBoundingClientRect().left;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < box.children.length; i += 1) {
    const child = box.children.item(i);
    if (child === null) continue;
    const distance = Math.abs(child.getBoundingClientRect().left - origin);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/** What the gallery box is handed back — see {@link useGalleryPosition}. */
export interface GalleryPosition {
  /** The photograph on screen, 0-based. */
  readonly active: number;
  /** Attach to the scrolling box. */
  readonly ref: (node: HTMLElement | null) => (() => void) | undefined;
}

/**
 * WHICH PHOTOGRAPH THE STRIP IS SHOWING — read off the strip itself.
 *
 * `enabled` is false for the grid arm and for a single photograph: a grid does
 * not scroll horizontally and a lone picture has no position, so neither pays
 * for a listener. The ref then attaches nothing at all.
 *
 * The measurement is throttled to one per animation frame, because a momentum
 * scroll fires dozens of `scroll` events per frame and each measurement is a
 * layout flush. The state write is guarded on a CHANGE, so a scroll across one
 * photograph costs one render rather than sixty.
 */
export function useGalleryPosition(enabled: boolean): GalleryPosition {
  const [active, setActive] = useState(0);
  const frame = useRef<number | null>(null);
  // Reset when the arm goes away, so a host toggling `galleryLayout` does not
  // keep a stale index for a grid nobody can scroll back.
  useEffect(() => {
    if (!enabled) setActive(0);
  }, [enabled]);
  const ref = useCallback(
    (node: HTMLElement | null): (() => void) | undefined => {
      if (node === null || !enabled) return undefined;
      const read = (): void => {
        frame.current = null;
        setActive(nearestPhotoIndex(node));
      };
      const onScroll = (): void => {
        if (frame.current !== null) return;
        // No rAF (an old jsdom, a server-side shim): measure straight away.
        // A throttle that cannot be scheduled is not a reason to stop
        // reporting where the strip is.
        if (typeof requestAnimationFrame !== "function") {
          read();
          return;
        }
        frame.current = requestAnimationFrame(read);
      };
      // A strip can mount already scrolled (a restored position), so the
      // indicator opens truthful rather than at 1.
      read();
      node.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        node.removeEventListener("scroll", onScroll);
        if (frame.current !== null && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(frame.current);
        }
        frame.current = null;
      };
    },
    [enabled]
  );
  return { active, ref };
}

/**
 * The gallery's layout rules, for the hoisted `<style>`.
 *
 * The strip's child rule (`> *`) is the reason this is a stylesheet and not
 * two more inline properties: an inline style cannot reach a child, and the
 * flex basis is what makes the strip a strip rather than a row of squeezed
 * photographs.
 */
export function detailGalleryCss(): string {
  return `
.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="grid"] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(${DETAIL_PHOTO_MIN}, 1fr));
}
.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="strip"] {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
}
.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="strip"] > * {
  flex: 0 0 ${LISTINGS_GALLERY_STRIP_BASIS};
  scroll-snap-align: start;
  /* EVERY PHOTOGRAPH IS A DESTINATION, not a waypoint. A mandatory snap type
     alone only promises the strip will COME TO REST on a snap point — a fling
     with any momentum behind it still crosses two or three photographs on its
     way there, which is the owner's "the middle photo flies past" in its
     native form. "always" makes the scroller stop at the first snap point it
     reaches, so one gesture is one photograph here for the same reason the
     card's gesture layer clamps its own step to one. The same declaration
     SkinCarousel already carries on its slides. */
  scroll-snap-stop: always;
}
.${LISTINGS_GALLERY_CLASS}[data-gallery-layout="hero"] {
  display: flex;
  flex-direction: column;
}
/* A button, so the enlargement is reachable by keyboard and announced as a
   control — and stripped of every platform mark a button brings, because the
   photograph is the whole surface. The zoom cursor is the one affordance
   kept: it is what says the picture opens rather than navigates. */
.${LISTINGS_HERO_CLASS} {
  display: block;
  inline-size: 100%;
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  border-radius: ${String(radii.md)}px;
  overflow: hidden;
}
.${LISTINGS_FILMSTRIP_CLASS} {
  display: flex;
  gap: ${String(spacing[2])}px;
  overflow-x: auto;
  /* The thumbnails scroll sideways; the page's own vertical scroll stays the
     browser's, exactly as it does under the phone strip. */
  overscroll-behavior-x: contain;
}
.${LISTINGS_THUMB_CLASS} {
  flex: 0 0 ${DETAIL_THUMB_SIZE};
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: ${String(radii.sm)}px;
  overflow: hidden;
  /* Dimmed at rest so the CHOSEN one is the one that reads — see the
     aria-current rule below, which is the same state the screen reader is
     told about and not a second, silent one. */
  opacity: 0.55;
  transition: opacity 120ms ease-out;
}
.${LISTINGS_THUMB_CLASS}:hover {
  opacity: 0.8;
}
.${LISTINGS_THUMB_CLASS}[aria-current="true"] {
  opacity: 1;
  outline: 2px solid ${cssVar("brand")};
  outline-offset: -2px;
}
.${LISTINGS_LIGHTBOX_CLASS} {
  display: flex;
  align-items: center;
  gap: ${String(spacing[3])}px;
  /* The box the counter is pinned inside. The container itself takes no
     offsets, so it moves no pixel of what is already in it. */
  position: relative;
}
.${LISTINGS_LIGHTBOX_STAGE_CLASS} {
  flex: 1 1 auto;
  min-inline-size: 0;
  /* The horizontal gesture is this component's; the vertical one is the
     page's. Without this a swipe on a touch screen scrolls instead. */
  touch-action: pan-y;
}
.${LISTINGS_GALLERY_FRAME_CLASS} {
  position: relative;
  min-inline-size: 0;
}
.${LISTINGS_GALLERY_COUNTER_CLASS} {
  position: absolute;
  inset-block-end: ${String(spacing[2])}px;
  inset-inline-end: ${String(spacing[2])}px;
  z-index: 1;
  pointer-events: none;
  padding: ${String(spacing[1] / 2)}px ${String(spacing[2])}px;
  border-radius: ${String(radii.full)}px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: ${String(fontSize.xs.fontSize)}px;
  line-height: ${String(fontSize.xs.lineHeight)}px;
  font-variant-numeric: tabular-nums;
}
`.trim();
}
