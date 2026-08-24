/**
 * The upload tile's pixels — picked from the TILE, not from the ladder.
 *
 * Owner sweep 2026-08-24, defect class (c): a size decision made without
 * reference to the element it is for. Both upload skins rendered a raw `<img>`
 * into a hardcoded 96x96 box with `smallestVariantUrl(image)` as its `src` —
 * the lowest rung of the ladder, chosen with no reference to the box at all.
 * On a 2x or 3x phone that box needs ~192-288 device pixels and the smallest
 * tier is guaranteed to be under-resolution, so every thumbnail in the fleet's
 * upload grids was soft on exactly the screens that show it most.
 *
 * `@stapel/image`'s `<Image>` is the mechanism that already exists for this:
 * it measures the element's own rendered box, multiplies by the live device
 * pixel ratio, and picks the smallest tier that does not upscale — the same
 * arithmetic, done against the real number instead of a guess in either
 * direction. `smallestVariantUrl` stays exported (it is a published API and
 * still the right answer for a caller that genuinely wants the cheapest
 * possible byte), it is just no longer what a rendered tile uses.
 *
 * The local pick is a different case and stays a plain `<img>`: an object URL
 * has no ladder and no metadata, and the whole point of it is that it paints
 * before any request has been made.
 */
import type { CSSProperties, ReactElement } from "react";
import { useMemo } from "react";
import { Image } from "@stapel/image";
import type { CdnImage } from "../api/types.js";
import { toStapelImage } from "../model/refs.js";

export interface CdnThumbnailProps {
  /** The local object URL of the pick, when there is one. Wins: it is already
   * decoded and it is what the person just chose. */
  readonly localUrl: string | null;
  /** The uploaded row, once it exists and its ladder has been generated. */
  readonly image: CdnImage | null;
  /** The tile geometry. Both axes are set, so the metadata `aspect-ratio`
   * `<Image>` writes for layout-shift protection is inert here — the box is
   * fixed by design (see `phase.ts`). */
  readonly box: CSSProperties;
  readonly alt: string;
  readonly "data-testid"?: string;
}

/** One tile's image: the local pick, else the right tier for this box, else
 * the empty frame. */
export function CdnThumbnail(props: CdnThumbnailProps): ReactElement {
  const { image } = props;
  const meta = useMemo(
    () => (image === null || image.variants_meta.length === 0 ? null : toStapelImage(image)),
    [image]
  );

  if (props.localUrl !== null) {
    return (
      <img
        src={props.localUrl}
        alt={props.alt}
        style={props.box}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      />
    );
  }
  if (meta !== null) {
    return (
      <Image
        meta={meta}
        alt={props.alt}
        fit="cover"
        style={props.box}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      />
    );
  }
  // An unprocessed row (no ladder yet) still has one URL worth showing.
  if (image !== null && image.original_url) {
    return (
      <img
        src={image.original_url}
        alt={props.alt}
        style={props.box}
        {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
      />
    );
  }
  return (
    <div
      style={{ ...props.box, border: "1px dashed" }}
      {...(props["data-testid"] !== undefined ? { "data-testid": props["data-testid"] } : {})}
    />
  );
}
