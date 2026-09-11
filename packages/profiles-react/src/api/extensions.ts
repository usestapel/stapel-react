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
 * Anything a public profile answer says about a person's contacts. Typed
 * loosely on purpose: a host reads this off a profile it may have taken from
 * a search result, a batch answer or its own cache, and a profile shape that
 * predates stapel-profiles 0.20 has no `contacts` block at all.
 */
export interface ProfileWithContactFlags {
  readonly contacts?: { readonly phone?: boolean } | null;
}

/**
 * Is there a phone number on this profile worth asking for?
 *
 * The ONE bit a storefront draws the "Show phone" button from. True means:
 * at least one number that is switched on, proven by SMS, and not withheld
 * from everyone. It is NOT a promise that the caller will be handed a number
 * — the policy on each number is applied by the reveal endpoint, and the
 * answer there may still be an empty list or the registration door.
 *
 * Viewer-INDEPENDENT, by the backend's design: a bit that changed with the
 * viewer would leak the policy itself ("the button vanished when I signed
 * out, so that number is members-only").
 *
 * Anything else — no profile yet, an older profile shape, a `contacts` block
 * the serializer did not send — reads `false`: no button is the right answer
 * when nobody said there is a number.
 */
export function hasPhone(
  profile: ProfileWithContactFlags | null | undefined
): boolean {
  return profile?.contacts?.phone === true;
}

/**
 * One of the OWNER's own numbers, with everything but the last two digits
 * replaced — what their contacts screen shows until they ask to see it.
 *
 * A phone number on screen is readable by whoever is standing behind the
 * person holding the phone, and a contacts screen is long-lived (it is where
 * you go to change a policy, not to read your own number). The last two
 * digits are enough to tell two of your own numbers apart, which is the only
 * question this list has to answer at rest.
 *
 * Digits are masked; the leading `+` and any separators the owner typed stay,
 * so the shape of the number is still recognisable. A value with two digits
 * or fewer is returned untouched — there is nothing to hide behind.
 */
export function maskPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length <= 2) return value;
  let remaining = digits.length - 2;
  let out = "";
  for (const char of value) {
    if (/\d/.test(char) && remaining > 0) {
      out += "•";
      remaining -= 1;
    } else {
      out += char;
    }
  }
  return out;
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
