/**
 * A stored CDN reference, drawn — or a designed placeholder saying why not.
 *
 * `Listing.images` carries opaque `<type>/<hash>` strings and no contract in
 * this fleet resolves a stranger's reference (`model/runtime.ts` argues it at
 * length). So this component asks the runtime's `resolveImage`, and when
 * there is no resolver — or the resolver has nothing for this reference — it
 * says so instead of emitting a broken `<img>`. An empty grey box that never
 * loads teaches a person nothing; a sentence gets the wiring fixed.
 *
 * The placeholder is TOKENISED and theme-aware. It was antd's `<Empty>`, whose
 * illustration is a flat `#d9d9d9` slab: it glared white on every dark page in
 * the visual pass and read as a broken image rather than as a designed "no
 * photo yet". It is now the aspect-ratio box the photo would have occupied,
 * painted from `colorFillQuaternary` with a camera glyph in
 * `colorTextQuaternary`, so it belongs to whichever side the theme is on and
 * never shifts the layout when a real photo lands.
 *
 * When the resolver DOES answer, `@stapel/image`'s `<Image>` takes over: it
 * measures the slot, picks the variant tier that fits, blur-ups from
 * `preview_b64` and never downgrades on a re-measure. None of that logic
 * belongs here — it is why `@stapel/image` exists.
 */
import type { CSSProperties, ReactElement } from "react";
import { useMemo } from "react";
import { Typography, theme as antdTheme } from "antd";
import { Image } from "@stapel/image";
import { SkinCarousel } from "@stapel/tokens-antd/skin";
import { useT } from "@stapel/core";
import type { LinkComponent } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import { useListingsRuntime } from "../model/context.js";
import {
  CARD_GALLERY_CLASS,
  CARD_GALLERY_STYLE_HREF,
  cardGalleryCss,
  useCardGallery,
} from "./cardGallery.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";


/**
 * The class a linked slide carries.
 *
 * `display:block` is the load-bearing half: an inline anchor around a block
 * image leaves a baseline gap under the picture, which on a grid of tiles is a
 * visible row of mismatched card heights. The rule itself lives in
 * `cardTargetCss()`, beside the card's other one-rule-per-defect entries.
 */
export const PHOTO_LINK_CLASS = "stapel-listing-photo-link";

/** The default shape of a listing photo box everywhere in this skin. Declared
 * once so a card, a detail hero and a dashboard thumbnail cannot drift into
 * three different crops. */
export const LISTING_PHOTO_ASPECT = "4 / 3";

export interface ListingPhotoProps {
  /** The stored reference, or `undefined` for a listing with no photos. */
  readonly imageRef: string | undefined;
  /** Alt text — required, and the caller has the context to write it. */
  readonly alt: string;
  readonly style?: CSSProperties;
}

/** A camera outline in `currentColor` — the house convention (`icons.tsx`):
 * no icon dependency, and it inherits the theme rather than carrying a
 * colour. `aria-hidden` because the sentence beside it is the label. */
function CameraGlyph(): ReactElement {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.2-2h6.2l1.2 2h1.7A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z" />
      <circle cx="12" cy="12.5" r="3.2" />
    </svg>
  );
}

export function ListingPhoto(props: ListingPhotoProps): ReactElement {
  const t = useT();
  const { token } = antdTheme.useToken();
  const runtime = useListingsRuntime();
  // Memoised on the REFERENCE, not called in render. A host resolver is a
  // plain function returning a fresh object (`resolveImage: (ref) => ({ … })`
  // is the documented shape), so calling it inline handed `<Image>` a new
  // `meta` identity on every render of this card — which is a load `<Image>`
  // then has to decide is or is not the same one. It defends itself now, and
  // a caller still should not manufacture the churn.
  const resolve = runtime.resolveImage;
  const imageRef = props.imageRef;
  const meta = useMemo(
    () => (imageRef === undefined || resolve === undefined ? undefined : resolve(imageRef)),
    [imageRef, resolve]
  );

  if (meta === undefined) {
    const caption = t(
      props.imageRef === undefined
        ? LISTINGS_I18N_KEYS.cardNoPhoto
        : LISTINGS_I18N_KEYS.cardPhotoUnavailable
    );
    return (
      <div
        role="img"
        aria-label={caption}
        data-testid="listings-photo-absent"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing[1],
          width: "100%",
          aspectRatio: LISTING_PHOTO_ASPECT,
          background: token.colorFillQuaternary,
          color: token.colorTextQuaternary,
          borderRadius: radii.md,
          ...props.style,
        }}
      >
        <CameraGlyph />
        <Typography.Text
          type="secondary"
          style={{ fontSize: token.fontSizeSM, textAlign: "center" }}
        >
          {caption}
        </Typography.Text>
      </div>
    );
  }

  return (
    <Image
      meta={meta}
      alt={props.alt}
      data-testid="listings-photo"
      style={{
        width: "100%",
        aspectRatio: LISTING_PHOTO_ASPECT,
        objectFit: "cover",
        borderRadius: radii.md,
        ...props.style,
      }}
    />
  );
}

/**
 * A listing's photos as ONE swipeable strip — the shape every card surface in
 * this pair uses, so there is one gallery and not three.
 *
 * ── Why the strip is never inside a card's anchor ──────────────────────────
 *
 * A `<SkinCarousel>` is a scroll container with its own tab stop, and a
 * horizontal swipe that ends inside an `<a>` is a swipe the browser may
 * deliver as a click: every attempt to look at photo two would open the
 * listing. A link may not contain a control, and a swipeable strip is a
 * control. So a card renders this as a SIBLING of its anchor and keeps the
 * anchor around everything a person READS — which is the arrangement
 * `<ListingSerpCard>` has shipped since it existed, and the one the live phone
 * SERP was measured correct on while the desktop card (a still `<img>` inside
 * the anchor, one photo, no dots) was not.
 *
 * ── …and why each SLIDE may still be one, when a card asks (`href`) ────────
 *
 * The rule above is about the STRIP, and it was read as a rule about the
 * picture. It is not, and the difference was measured: on a 1440px grid the
 * photo is 267x200 — the largest, most obvious target on the card — and
 * clicking it did nothing at all. `cursor: auto`, no hover, and the visitor
 * stayed on the page they were already on. A person who clicks a picture of a
 * phone is asking to see the phone; there is no reading of that click in which
 * the right answer is silence.
 *
 * So a card may hand this strip its own `href`, and each slide becomes a link
 * around its picture. What that does NOT do is make the strip a link: the
 * scroller, its arrows and its dots stay controls, outside every anchor,
 * because they are what the header's rule is actually protecting. And the
 * slide links are `tabIndex={-1}` + `aria-hidden`, so a card is still ONE tab
 * stop and one accessible name — the reading anchor's — rather than one per
 * photograph.
 *
 * A surface that does not pass `href` is byte-identical to before. The phone
 * SERP passes none: a horizontal swipe is a real gesture there, and it is the
 * gesture the header's rule was written for.
 *
 * A listing with no photos still gets one slide, so a row's height does not
 * depend on whether a seller uploaded anything, and a ONE-photo strip gets
 * neither peek nor dots: the sliver of a next slide is an affordance for
 * something that is there.
 */
export function ListingPhotoStrip(props: {
  /** The stored references, in the seller's order. */
  readonly images: readonly string[];
  /** The listing's title — the fallback alt for a single photo. */
  readonly title: string;
  /** The surface's own test id, so a screen holding two kinds of card does
   * not hand a test two elements under one name. */
  readonly testId: string;
  /**
   * Where a click on the PICTURE goes — the card's own `href`, when the card
   * wants its photograph to be part of its target. Omitted, every slide is
   * inert exactly as it has always been.
   */
  readonly href?: string;
  /** The host's `<Link>`, so the click stays inside the SPA. */
  readonly linkComponent?: LinkComponent;
}): ReactElement {
  const t = useT();
  const { images, title } = props;
  const many = images.length > 1;
  // Hover-scrub and swipe. Inert for a one-photo strip; see `cardGallery.ts`
  // for the two gates and why the keyboard path is untouched.
  const gallery = useCardGallery(images.length);

  /**
   * One slide, linked or not.
   *
   * `aria-hidden` + `tabIndex={-1}`: this is a SECOND way to reach a
   * destination the card already names, not a second destination. Without it a
   * grid of twenty-four cards grows twenty-four extra tab stops, each
   * announcing the same listing the card announced a moment ago.
   */
  const slide = (photo: ReactElement, key: string): ReactElement => {
    if (props.href === undefined) return photo;
    const Link = props.linkComponent;
    return Link !== undefined ? (
      <Link
        key={key}
        href={props.href}
        className={PHOTO_LINK_CLASS}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="listings-photo-link"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {photo}
      </Link>
    ) : (
      <a
        key={key}
        href={props.href}
        className={PHOTO_LINK_CLASS}
        aria-hidden="true"
        tabIndex={-1}
        data-testid="listings-photo-link"
        data-analytics="none"
        data-analytics-reason="business action — host app wraps with its own tracked()"
      >
        {photo}
      </a>
    );
  };

  return (
    <div
      ref={gallery.ref}
      className={CARD_GALLERY_CLASS}
      data-testid={`${props.testId}-gallery`}
      data-gallery-photos={String(images.length)}
      data-gallery-active={String(gallery.active)}
      data-scrubbing={String(gallery.scrubbing)}
      data-analytics="none"
      data-analytics-reason="a look, not an outcome — scrubbing photographs navigates nowhere and changes no record"
      onPointerMove={gallery.onPointerMove}
      onPointerDown={gallery.onPointerDown}
      onPointerUp={gallery.onPointerUp}
      onPointerCancel={gallery.onPointerCancel}
      onPointerLeave={gallery.onPointerLeave}
    >
      <style href={CARD_GALLERY_STYLE_HREF} precedence="default">
        {cardGalleryCss()}
      </style>
      <SkinCarousel
        label={t(LISTINGS_I18N_KEYS.cardPhotos)}
        aspectRatio={LISTING_PHOTO_ASPECT}
        peek={many}
        dots={many}
        // WHERE THE STRIP ACTUALLY IS, back into the gallery. A finger scrolls
        // this element natively; without this the hook's `active` was stale
        // the moment a swipe settled, and its effect scrolled the strip back
        // to the stale one. See `cardGallery.ts` — the carousel already
        // measures this for its dots, so it costs no second listener.
        onSlideChange={gallery.onSlideChange}
        data-testid={props.testId}
      >
        {images.length === 0
          ? slide(<ListingPhoto imageRef={undefined} alt={title} />, "empty")
          : images.map((reference, index) =>
              slide(
                <ListingPhoto
                  key={reference}
                  imageRef={reference}
                  alt={
                    many
                      ? t(LISTINGS_I18N_KEYS.detailPhotoAlt, {
                          index: index + 1,
                          total: images.length,
                        })
                      : title
                  }
                />,
                reference
              )
            )}
      </SkinCarousel>
    </div>
  );
}
