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
import { useT } from "@stapel/core";
import { radii, spacing } from "@stapel/tokens";
import { useListingsRuntime } from "../model/context.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

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
