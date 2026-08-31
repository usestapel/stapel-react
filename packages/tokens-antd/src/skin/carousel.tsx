/**
 * `SkinCarousel` — the fleet's ONE swipe primitive: a horizontal strip of
 * slides that snaps, peeks, and is scrolled by the browser.
 *
 * ## Why it lives in the token bridge
 *
 * A phone gallery is a DESIGN-SYSTEM shape, not a listings feature: the
 * classified's result card, the listing page's photos, a category rail and a
 * shop's promo row all want the same strip, and the moment two of them
 * hand-roll it there are two different swipe behaviours in one product. Same
 * argument as {@link SkinDialog}: `@stapel/tokens-antd` is the package every
 * antd default skin already depends on, so a rule stated here is inherited by
 * all of them without inverting the dependency graph.
 *
 * ## There is no gesture code, and that is the point
 *
 * The strip is a scroll container with `scroll-snap-type: x mandatory`; each
 * slide declares `scroll-snap-align: start`. Everything a hand-written
 * carousel spends a thousand lines on — momentum, rubber-band at the ends,
 * the fling curve, pointer capture, touch-vs-trackpad, the tap that must not
 * become a drag — is the platform's, tuned per-OS, and already correct. A JS
 * gesture layer can only be a worse copy of it, and it is the copy that breaks
 * on the next iOS release.
 *
 * What that buys, for free: two-finger trackpad scroll on a desktop,
 * shift+wheel, the browser's own "scroll the focused thing into view" when
 * Tab lands on a control inside slide 4, and a screen reader's normal reading
 * order — because the slides are simply IN the document, not swapped by state.
 *
 * ## `peek` is an affordance, not a decoration
 *
 * A full-width slide with nothing beside it says "this is a picture". The
 * refs' strip is ~92% of the container, so the EDGE of the next slide is
 * visible: that sliver is the only thing on screen that says there is more,
 * and it is what people swipe at. {@link SkinCarouselProps.peek} is that
 * sliver — `true` for the default {@link SKIN_CAROUSEL_PEEK}, a CSS length
 * for a fixed one, `false` for a full-width strip (a hero, a one-photo card).
 *
 * ## The scrollbar is hidden; nothing is reachable only through it
 *
 * A 15px grey trough under a photo is chrome nobody asked for, so it is hidden
 * (`scrollbar-width` / `::-webkit-scrollbar` — neither expressible as an
 * inline style, hence the hoisted sheet). That is only safe because the strip
 * itself is a focusable scroll container (`tabindex="0"`): a keyboard reaches
 * it and the arrow keys scroll it, exactly as they would with a visible bar.
 * Slides stay ordinary document content, so anything focusable inside one is
 * reached by Tab and scrolled into view by the browser.
 *
 * ## Copy, and the naming of things
 *
 * The bridge owns no i18n engine and must not invent user-facing English, so
 * {@link SkinCarouselProps.label} is a REQUIRED prop the caller supplies from
 * its own key registry — the same contract `SkinDialog.dismissLabel` states.
 *
 * That contract is also why the DOTS are an indicator and not a control: a
 * tappable dot needs a name per dot ("go to photo 3 of 12"), which is copy
 * this package cannot produce, and a nameless button is worse than no button.
 * The dots are `aria-hidden` and the position is carried instead by the
 * strip's LIST semantics — a screen reader announces "list, 12 items" and
 * "item 3 of 12" as it moves, which is the same fact, spoken properly, in
 * every locale, with no key to register.
 *
 * ## Custom properties are `--skin-*`, not `--stapel-*`
 *
 * The `--stapel-` namespace is the design system's ROLE catalogue and
 * `stapel/valid-token-name` guards it. The four properties below are a
 * component's private plumbing (how wide a slide is, how big the peek is) —
 * not roles a project retunes — so they carry the component's own prefix. The
 * COLOURS in them are `cssVar()` role references, which is what makes the dots
 * correct in dark mode by construction rather than by a second stylesheet.
 */
import { Children, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cssVar, radii, spacing } from "@stapel/tokens";

/** The class the carousel root carries. */
export const SKIN_CAROUSEL_CLASS: string = "stapel-carousel";
/** The class the scroll container (the `<ul>` of slides) carries. */
export const SKIN_CAROUSEL_STRIP_CLASS: string = "stapel-carousel-strip";
/** The class one slide well carries. */
export const SKIN_CAROUSEL_SLIDE_CLASS: string = "stapel-carousel-slide";
/** The class the position indicator's row carries. */
export const SKIN_CAROUSEL_DOTS_CLASS: string = "stapel-carousel-dots";
/** The class one indicator dot carries. */
export const SKIN_CAROUSEL_DOT_CLASS: string = "stapel-carousel-dot";

/** The `href` the hoisted carousel stylesheet is deduplicated by. */
export const SKIN_CAROUSEL_STYLE_HREF: string = "stapel-skin-carousel";

/**
 * How much of the container the NEXT slide keeps when `peek` is on — the
 * refs' "~92% wide, the edge of the next photo showing". A percentage rather
 * than a length so the sliver stays proportional from a 320px phone to a
 * 700px tablet column; a caller that wants a fixed one passes a CSS length.
 */
export const SKIN_CAROUSEL_PEEK: string = "8%";

/** The gutter between two slides. */
const SLIDE_GAP: number = spacing[2];
/** An inactive dot; the active one is a pill this wide. */
const DOT_SIZE: number = spacing[2];
const DOT_ACTIVE_WIDTH: number = spacing[5];

/**
 * The rules an inline style cannot express — the hidden scrollbar
 * (`scrollbar-width`, `::-webkit-scrollbar`), the focus ring
 * (`:focus-visible`), the active-dot selector, and the reduced-motion
 * override. Static: every value that varies per instance arrives as a
 * `--skin-carousel-*` property set on the element, so ONE hoisted copy serves
 * a page with twenty carousels on it, in either theme.
 */
export function skinCarouselCss(): string {
  const root = `.${SKIN_CAROUSEL_CLASS}`;
  const strip = `.${SKIN_CAROUSEL_STRIP_CLASS}`;
  const slide = `.${SKIN_CAROUSEL_SLIDE_CLASS}`;
  const dots = `.${SKIN_CAROUSEL_DOTS_CLASS}`;
  const dot = `.${SKIN_CAROUSEL_DOT_CLASS}`;
  return [
    `${root}{display:flex;flex-direction:column;gap:${String(spacing[2])}px}`,
    // The scroller. `mandatory` (not `proximity`) because a photo strip that
    // can rest halfway between two photos is the defect people call "it
    // doesn't snap"; `overscroll-behavior-inline: contain` so a flick past the
    // last slide does not hand the gesture to the page behind it.
    `${strip}{display:flex;flex-wrap:nowrap;align-items:stretch;` +
      `gap:var(--skin-carousel-gap);margin:0;padding:0;list-style:none;` +
      `overflow-x:auto;overflow-y:hidden;` +
      `scroll-snap-type:x mandatory;scroll-behavior:smooth;` +
      `overscroll-behavior-inline:contain;-webkit-overflow-scrolling:touch;` +
      `scrollbar-width:none;-ms-overflow-style:none}`,
    `${strip}::-webkit-scrollbar{display:none}`,
    // The strip is a tab stop (see the file header), so it must show one.
    `${strip}:focus-visible{outline:2px solid var(--skin-carousel-focus);outline-offset:2px}`,
    // `scroll-snap-stop: always` keeps a fast flick from skipping three photos
    // — on a gallery every slide is a destination, not a waypoint.
    `${slide}{flex:0 0 var(--skin-carousel-slide);min-inline-size:0;` +
      `scroll-snap-align:start;scroll-snap-stop:always;` +
      `aspect-ratio:var(--skin-carousel-ratio,auto);` +
      `overflow:hidden;border-radius:var(--skin-carousel-radius);position:relative}`,
    // A slide is a WELL: whatever is in it fills it, and an image is cropped
    // to it rather than letterboxed inside it.
    `${slide}>*{inline-size:100%;block-size:100%}`,
    `${slide}>img,${slide}>picture>img,${slide}>video{display:block;` +
      `inline-size:100%;block-size:100%;object-fit:cover}`,
    `${dots}{display:flex;justify-content:center;align-items:center;` +
      `gap:${String(spacing[1])}px}`,
    `${dot}{inline-size:${String(DOT_SIZE)}px;block-size:${String(DOT_SIZE)}px;` +
      `border-radius:${String(radii.full)}px;background:var(--skin-carousel-dot);` +
      `transition:inline-size 160ms ease,background-color 160ms ease}`,
    `${dot}[data-active="true"]{inline-size:${String(DOT_ACTIVE_WIDTH)}px;` +
      `background:var(--skin-carousel-dot-active)}`,
    // Smooth scrolling is a preference, not a requirement.
    `@media (prefers-reduced-motion:reduce){${strip}{scroll-behavior:auto}` +
      `${dot}{transition:none}}`,
  ].join("\n");
}

export interface SkinCarouselProps {
  /**
   * The strip's accessible name — i18n copy, so the CALLER supplies it from
   * its own key registry ("Photos of this listing"). Required for the same
   * reason `SkinDialog.dismissLabel` is: the token bridge owns no i18n engine
   * and must not invent user-facing English, and an unnamed scrollable region
   * is announced as nothing at all.
   */
  readonly label: string;
  /** The slides. Anything renderable; designed for `@stapel/image`'s `<Image>`. */
  readonly children: ReactNode;
  /**
   * How much of the next slide stays on screen — the affordance that there is
   * more (see the file header).
   *
   * - `true` (default) — {@link SKIN_CAROUSEL_PEEK}, the refs' proportional sliver.
   * - a CSS length/percentage (`"48px"`, `"12%"`) — a fixed one.
   * - `false` — full-width slides, no peek.
   */
  readonly peek?: boolean | string;
  /**
   * The shape of ONE slide well, as a CSS `aspect-ratio` value (`"4 / 3"`,
   * `"1"`, `"16 / 9"`). Absent, a slide is as tall as its content — which is
   * right for text slides and wrong for photos, where an unconstrained well
   * makes the strip's height jump per image as they load.
   */
  readonly aspectRatio?: string;
  /**
   * Draw the position indicator. Off by default: a single-slide strip and a
   * strip whose slides are self-labelling (a chip rail) do not want one.
   */
  readonly dots?: boolean;
  /**
   * Called when the slide nearest the strip's leading edge changes, with its
   * 0-based index. Fires on a settled CHANGE, never per scrolled pixel.
   */
  readonly onSlideChange?: (index: number) => void;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly "data-testid"?: string;
}

/** The `--skin-carousel-peek` value a `peek` prop asks for. */
function peekLength(peek: boolean | string | undefined): string {
  if (peek === false) return "0px";
  if (peek === undefined || peek === true) return SKIN_CAROUSEL_PEEK;
  return peek;
}

/**
 * The index of the slide whose leading edge is nearest the strip's.
 *
 * Measured from live rectangles rather than from `scrollLeft / slideWidth`:
 * the arithmetic version has to know the gap, the peek and the writing
 * direction, and gets the last slide wrong (it can never reach its own start
 * offset). Rectangles are read in one pass, so the browser flushes layout
 * once — and only on a frame the scroll actually asked for.
 */
function nearestSlideIndex(strip: HTMLElement): number {
  const slides = strip.children;
  const origin = strip.getBoundingClientRect().left;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < slides.length; i += 1) {
    const slide = slides.item(i);
    if (slide === null) continue;
    const distance = Math.abs(slide.getBoundingClientRect().left - origin);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  }
  return best;
}

/**
 * Stable keys for the indicator dots.
 *
 * A dot has no identity of its own — it is a position, and a position is
 * exactly what `react/no-array-index-key` exists to stop being used as a key.
 * Naming them once, up front, gives the row keys that are stable across
 * renders and across a changing slide count, without pretending an index is
 * an id; the pool grows on demand for a strip longer than the last one.
 */
const DOT_KEYS: string[] = [];
function dotKeys(count: number): readonly string[] {
  while (DOT_KEYS.length < count) DOT_KEYS.push(`dot-${String(DOT_KEYS.length)}`);
  return DOT_KEYS.slice(0, count);
}

/**
 * A horizontal, snapping, peeking strip of slides.
 *
 * ```tsx
 * <SkinCarousel label={t(KEYS.photos)} dots aspectRatio="4 / 3">
 *   {photos.map((p) => <Image key={p.id} reference={p.ref} alt={p.alt} />)}
 * </SkinCarousel>
 * ```
 */
export function SkinCarousel(props: SkinCarouselProps): ReactElement {
  const { dots = false, onSlideChange } = props;
  const stripRef = useRef<HTMLUListElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);

  const count = Children.count(props.children);
  // Nothing is measured for a strip that neither draws dots nor reports:
  // the scroll listener is the only per-scroll work this component does, and
  // a card grid with forty carousels on it should pay for none of it.
  const tracks = dots || onSlideChange !== undefined;

  const publish = useCallback(
    (next: number): void => {
      if (next === activeRef.current) return;
      activeRef.current = next;
      // The state write is what keeps this off the per-pixel path: the
      // handler runs on every scroll frame, this runs on the handful of
      // frames where the answer actually changed.
      setActive(next);
      onSlideChange?.(next);
    },
    [onSlideChange]
  );

  useEffect(() => {
    if (!tracks) return;
    const strip = stripRef.current;
    if (strip === null) return;
    const read = (): void => {
      frameRef.current = null;
      publish(nearestSlideIndex(strip));
    };
    const onScroll = (): void => {
      // One measurement per animation frame, not per scroll event: a native
      // momentum scroll fires dozens of events per frame and every one of
      // them would otherwise cost a layout flush.
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(read);
    };
    // A strip can mount already scrolled (a restored position, a `scrollLeft`
    // set by the host) — read once so the indicator opens truthful.
    publish(nearestSlideIndex(strip));
    strip.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      strip.removeEventListener("scroll", onScroll);
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [tracks, publish, count]);

  const rootStyle: CSSProperties = {
    ["--skin-carousel-gap" as string]: `${String(SLIDE_GAP)}px`,
    ["--skin-carousel-peek" as string]: peekLength(props.peek),
    ["--skin-carousel-slide" as string]: "calc(100% - var(--skin-carousel-peek))",
    ["--skin-carousel-radius" as string]: `${String(radii.lg)}px`,
    ["--skin-carousel-focus" as string]: cssVar("focus-ring"),
    ["--skin-carousel-dot" as string]: cssVar("border"),
    ["--skin-carousel-dot-active" as string]: cssVar("text-muted"),
    ...(props.aspectRatio !== undefined
      ? { ["--skin-carousel-ratio" as string]: props.aspectRatio }
      : {}),
    ...props.style,
  };

  return (
    <div
      className={
        props.className !== undefined
          ? `${SKIN_CAROUSEL_CLASS} ${props.className}`
          : SKIN_CAROUSEL_CLASS
      }
      data-stapel-carousel=""
      data-stapel-carousel-peek={peekLength(props.peek)}
      data-stapel-carousel-slides={String(count)}
      {...(props["data-testid"] !== undefined
        ? { "data-testid": props["data-testid"] }
        : {})}
      style={rootStyle}
    >
      <style href={SKIN_CAROUSEL_STYLE_HREF} precedence="default">
        {skinCarouselCss()}
      </style>
      {/* `role="list"` is written out because `list-style: none` strips list
          semantics in WebKit — and those semantics ARE the position
          announcement the dots deliberately do not try to speak. `tabindex`
          makes the scroller reachable without a scrollbar to drag. */}
      <ul
        ref={stripRef}
        className={SKIN_CAROUSEL_STRIP_CLASS}
        role="list"
        aria-label={props.label}
        tabIndex={0}
        data-stapel-carousel-strip=""
      >
        {Children.map(props.children, (slide) => (
          <li className={SKIN_CAROUSEL_SLIDE_CLASS} data-stapel-carousel-slide="">
            {slide}
          </li>
        ))}
      </ul>
      {dots && count > 1 && (
        <div
          className={SKIN_CAROUSEL_DOTS_CLASS}
          data-stapel-carousel-dots=""
          aria-hidden="true"
        >
          {dotKeys(count).map((key, index) => (
            <span
              key={key}
              className={SKIN_CAROUSEL_DOT_CLASS}
              data-stapel-carousel-dot=""
              data-active={index === active ? "true" : "false"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
