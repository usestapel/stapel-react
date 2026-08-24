/**
 * A stored CDN reference, drawn — or the reason it cannot be.
 *
 * `Listing.images` carries opaque `<type>/<hash>` strings and no contract in
 * this fleet resolves a stranger's reference (`model/runtime.ts` argues it at
 * length). So this component asks the runtime's `resolveImage`, and when
 * there is no resolver — or the resolver has nothing for this reference — it
 * says so instead of emitting a broken `<img>`. An empty grey box that never
 * loads teaches a person nothing; a sentence gets the wiring fixed.
 *
 * When the resolver DOES answer, `@stapel/image`'s `<Image>` takes over: it
 * measures the slot, picks the variant tier that fits, blur-ups from
 * `preview_b64` and never downgrades on a re-measure. None of that logic
 * belongs here — it is why `@stapel/image` exists.
 */
import type { CSSProperties, ReactElement } from "react";
import { useMemo } from "react";
import { Empty } from "antd";
import { Image } from "@stapel/image";
import { useT } from "@stapel/core";
import { useListingsRuntime } from "../model/context.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

export interface ListingPhotoProps {
  /** The stored reference, or `undefined` for a listing with no photos. */
  readonly imageRef: string | undefined;
  /** Alt text — required, and the caller has the context to write it. */
  readonly alt: string;
  readonly style?: CSSProperties;
}

export function ListingPhoto(props: ListingPhotoProps): ReactElement {
  const t = useT();
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
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        data-testid="listings-photo-absent"
        description={t(
          props.imageRef === undefined
            ? LISTINGS_I18N_KEYS.cardNoPhoto
            : LISTINGS_I18N_KEYS.cardPhotoUnavailable
        )}
        {...(props.style ? { style: props.style } : {})}
      />
    );
  }

  return (
    <Image
      meta={meta}
      alt={props.alt}
      data-testid="listings-photo"
      {...(props.style ? { style: props.style } : {})}
    />
  );
}
