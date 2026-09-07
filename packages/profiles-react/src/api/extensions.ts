/**
 * Hand-authored API surface the codegen does not (yet) cover — browser-redirect
 * URL builders, open-redirect guards, narrow domain type-guards, header
 * conventions. Everything that CAN be derived from schema.json belongs in the
 * generated operations (`api/profilesApi.ts`), not here.
 */
import type { StapelImage } from "@stapel/image";
import type { Schemas } from "./types.js";

/**
 * A profile's avatar descriptor **as the wire declares it** — the generated
 * `StapelImageDTO`, which is NOT `@stapel/image`'s `StapelImage`:
 *
 *  - `source` is a bare `string` (drf-spectacular cannot type a plain-dataclass
 *    `str` attribute as a choices enum — the same under-description
 *    `ProfileFieldKind` documents), where `<Image>` wants `"cdn" | "file" |
 *    "link"`;
 *  - `variants` is OPTIONAL, where `<Image>` wants an array it can walk
 *    (`[]` is the honest empty ladder, `undefined` is a crash one `.length`
 *    away);
 *  - `variants[].branch` is a bare `string`, where the tier math wants
 *    `"w" | "h" | null`.
 *
 * So every call site that wanted to draw an avatar wrote `avatar_image as
 * StapelImage` — three of them in this package alone. A cast is not a
 * narrowing: it asserts the three differences away without checking any of
 * them, and it is the reason a consumer could not type an avatar at all
 * without repeating the same assertion in their own code.
 */
export type ProfileAvatarImage = Schemas["StapelImageDTO"];

/** Anything the reads answer with that carries an avatar descriptor —
 * `ProfilePublicResponse`, `ProfileResponse`, one entry of `POST /batch`. */
export interface ProfileWithAvatarImage {
  readonly avatar_image?: ProfileAvatarImage | null;
}

/**
 * One ladder rung, narrowed. `branch` falls to `null` for anything that is not
 * `"w"`/`"h"` — `null` is already the contract's word for "thumbnail-class, no
 * branch", so an unrecognized branch degrades to the rung being sized by its
 * own `width`/`height` rather than by a branch nobody can read.
 */
function rung(variant: Schemas["VariantMetaDTO"]): StapelImage["variants"][number] {
  return {
    tier: variant.tier,
    branch: variant.branch === "w" || variant.branch === "h" ? variant.branch : null,
    url: variant.url,
    width: variant.width,
    height: variant.height,
  };
}

/**
 * The three sources `stapel_core.media` declares. A deployment that grew a
 * fourth reads as `"link"` — the weakest TRUE statement about any descriptor
 * ("a URL, and no ladder this package can vouch for"), and one `<Image>`
 * branches on nowhere: it picks a rung out of `variants` and never reads this
 * field. Inventing a word here would be worse than the honest floor.
 */
function source(raw: string): StapelImage["source"] {
  return raw === "cdn" || raw === "file" ? raw : "link";
}

/**
 * A profile's avatar as the descriptor `<Image>` consumes, or `null` when the
 * profile has none (which every profile is allowed to be — a monogram is the
 * answer, never a broken `<img>`).
 *
 * ```tsx
 * const avatar = profileAvatarImage(profile);
 * {avatar ? <Image meta={avatar} fit="cover" alt="" /> : <Monogram />}
 * ```
 *
 * This is the ONE place the wire's three under-descriptions are repaired (see
 * {@link ProfileAvatarImage}), so a host drawing its own avatar gets the same
 * typed descriptor this pair's own `<PersonAvatar/>` draws, rather than
 * writing the cast again.
 */
export function profileAvatarImage(
  profile: ProfileWithAvatarImage | null | undefined
): StapelImage | null {
  const image = profile?.avatar_image;
  if (image === null || image === undefined) return null;
  return {
    source: source(image.source),
    url: image.url,
    mime: image.mime,
    width: image.width,
    height: image.height,
    aspect: image.aspect,
    square: image.square,
    preview_b64: image.preview_b64,
    // The ladder, always an array: `undefined` here is "the serializer did not
    // say", which for a ladder means there is none.
    variants: (image.variants ?? []).map(rung),
  };
}
