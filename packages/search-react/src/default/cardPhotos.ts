/**
 * WHAT A SEARCH CARD ACTUALLY STORES FOR A PHOTO, and how it becomes something
 * `@stapel/image` can draw.
 *
 * ── The defect this file exists to end ────────────────────────────────────
 *
 * The default card used to read `card.image` expecting an object with a `url`
 * key, and fall back to `card.image_url`. Neither is what this fleet emits:
 *
 *  - `image_url` is a convention NOTHING in the fleet writes. It was declared
 *    in `GENERIC_CARD_FIELDS`, drawn in the demos from a data URI, and never
 *    once served by a backend.
 *  - `card.image` IS emitted — by `stapel-classified`'s search projection —
 *    and it is a plain `<type>/<hash>` STRING, not an object.
 *  - where a card DOES carry an object (chat's subject card, which serves the
 *    same CDN render descriptor its attachments carry), that object has `ref`
 *    and `variants[]` and NO top-level `url` — so the `"url" in rich` guard
 *    rejected the one rich shape the fleet has.
 *
 * The net effect was a card with no photo on every consumer that did not pass
 * its own `renderCard`. Read the two real shapes instead, and read `images[]`
 * first: since stapel-classified 0.7.0 the projection carries the whole
 * gallery in seller order, deduplicated and capped by `CARD_IMAGES_LIMIT`,
 * with the singular `image` kept as `images[0]`.
 *
 * ── Three shapes, one output ──────────────────────────────────────────────
 *
 * 1. A CDN reference (`"image/9f2c…"`) — resolved through the runtime's
 *    {@link SearchImageResolver}, the same seam `@stapel/listings-react`
 *    states, for the same reason: no contract in this fleet resolves a
 *    stranger's reference, so the deployment hands its own knowledge in once.
 * 2. A URL a doc type stored directly (`"https://…"`, `"/media/…"`,
 *    `"data:image/…"`) — no ladder to shop, so it degrades to `source:
 *    "link"`. A CDN reference is `<type>/<hash>`: no scheme and no leading
 *    slash, so the two are told apart by shape and never by a guess.
 * 3. A render descriptor object — `variants[]` with a `tier` each, an inline
 *    `preview_b64`, geometry. Read defensively (the field is `unknown` by
 *    contract) exactly as `@stapel/chat-react` reads the same descriptor.
 */
import type { StapelImage } from "@stapel/image";
import type { SearchImageResolver } from "../model/runtime.js";

/** A card's photo fields, and how many of them the card carried at all. */
export interface CardPhotos {
  /**
   * How many photo entries the card STORES — before resolving. `0` means the
   * doc type has no photo for this row (or no photo field at all), which is a
   * different thing from "a photo nothing could resolve", and the card draws
   * the two differently.
   */
  readonly stored: number;
  /** The ones that became something drawable, in the stored order. */
  readonly images: readonly StapelImage[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A stored string that is already a URL rather than a CDN reference.
 *
 * stapel-cdn's unit is `<type>/<hash>` — a relative pair with no scheme and no
 * leading slash — so anything carrying a scheme, a protocol-relative prefix or
 * a leading `/` is a URL the doc type stored itself.
 */
function isUrl(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("data:") ||
    /^[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

/** A bare URL as the descriptor `<Image>` consumes: one rung, no ladder. */
function linkImage(url: string): StapelImage {
  return {
    source: "link",
    url,
    mime: null,
    width: null,
    height: null,
    aspect: null,
    square: false,
    preview_b64: null,
    variants: [],
  };
}

/**
 * One rung of a render descriptor's ladder, in `@stapel/image`'s spelling.
 *
 * `tier` arrives in two spellings inside the SAME array — an int for the
 * ladder rungs and the string sentinel `"original"` for the entry the snapshot
 * builder appends. `String()` is right for both, which is why there is no
 * branch here (`@stapel/cdn-react`'s `model/refs.ts` argues it at length).
 */
function rung(value: unknown): StapelImage["variants"][number] | undefined {
  if (!isRecord(value)) return undefined;
  const url = str(value["url"]);
  if (url === undefined) return undefined;
  const tier = value["tier"];
  const branch = value["branch"];
  return {
    tier: typeof tier === "number" || typeof tier === "string" ? String(tier) : "",
    branch: branch === "w" || branch === "h" ? branch : null,
    url,
    width: num(value["width"]),
    height: num(value["height"]),
  };
}

/**
 * A CDN render descriptor → the descriptor `<Image>` consumes.
 *
 * The display URL is the descriptor's own `url` when it has one, else the
 * `original` rung, else the largest rung — a snapshot carries no
 * `original_url`, so the top of the ladder IS the original. With no rung at
 * all the inline `preview_b64` is used: a real, honestly blurry image beats
 * nothing. A descriptor with neither is not drawable and says so.
 */
function metaImage(meta: Readonly<Record<string, unknown>>): StapelImage | undefined {
  const raw = meta["variants"];
  const variants = (Array.isArray(raw) ? raw : [])
    .map(rung)
    .filter((v): v is StapelImage["variants"][number] => v !== undefined);
  const original = variants.find((v) => v.tier === "original");
  const largest = variants.reduce<StapelImage["variants"][number] | undefined>(
    (best, v) => {
      const size = Number(v.tier);
      if (!Number.isFinite(size)) return best;
      return best === undefined || size > Number(best.tier) ? v : best;
    },
    undefined
  );
  const preview = str(meta["preview_b64"]);
  const url = str(meta["url"]) ?? original?.url ?? largest?.url ?? preview;
  if (url === undefined) return undefined;
  return {
    source: "cdn",
    url,
    mime: str(meta["mime"]) ?? null,
    width: num(meta["width"]),
    height: num(meta["height"]),
    aspect: num(meta["aspect"]),
    square: meta["square"] === true,
    preview_b64: preview ?? null,
    variants,
  };
}

/** One stored entry, in whichever of the three shapes it arrived. */
export function cardImage(
  value: unknown,
  resolve: SearchImageResolver | undefined
): StapelImage | undefined {
  const ref = str(value);
  if (ref !== undefined) {
    return isUrl(ref) ? linkImage(ref) : resolve?.(ref);
  }
  if (isRecord(value)) return metaImage(value);
  return undefined;
}

/**
 * The card's gallery: `images[]` when the doc type carries one, the singular
 * `image` otherwise.
 *
 * Never both — `stapel-classified` stores `image` as `images[0]`, so reading
 * the singular after the list would draw the first photo twice. The singular
 * stays the fallback for a doc type that never grew a list.
 */
export function readCardPhotos(
  card: Readonly<Record<string, unknown>>,
  resolve: SearchImageResolver | undefined
): CardPhotos {
  const list = card["images"];
  const stored: readonly unknown[] = Array.isArray(list)
    ? list
    : card["image"] === undefined || card["image"] === null
      ? []
      : [card["image"]];
  const images = stored
    .map((entry) => cardImage(entry, resolve))
    .filter((image): image is StapelImage => image !== undefined);
  return { stored: stored.length, images };
}
