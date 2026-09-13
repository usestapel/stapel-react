/**
 * ATTACHMENTS — the descriptor, read.
 *
 * stapel-chat 0.9.0 put everything a bubble needs on the message itself: the
 * open type registry (`image` / `gif` / `video` / `audio` / `file`, plus
 * whatever a deployment adds in BOTH registries), the geometry, the 16px
 * preview and the variant ladder, all resolved from stapel-cdn in one
 * `describe_many` inside the query the thread already costs. So a bubble paints
 * on first frame and **does not reflow when the asset lands**, which is the
 * whole of §83.2's ask — and this module is where that promise is kept or lost.
 *
 * ── Where a descriptor comes from, and where it does NOT ──────────────────
 *
 * REST only. `MessageResponse.attachments[]` is an `AttachmentResponse[]`; the
 * SOCKET payload carries the raw stored descriptors instead
 * (`stapel_chat.realtime` sends `list(msg.attachments or [])`), which is why
 * `realtime/frames.ts` types them as opaque and why a live message is resolved
 * by re-reading the thread rather than written into the cache from the frame.
 * That resolution is already batched by construction: `flows/freshness.ts`
 * collapses a burst of frames into ONE refetch of the window, so forty arriving
 * messages cost one request and not forty describes. Nothing here asks the CDN
 * for anything — a component that called `useDescribe` per bubble would undo
 * the batch the backend built.
 *
 * ── The registry is OPEN, so an unknown type is not an error ──────────────
 *
 * A deployment that registers `sticker` in both registries sends attachments
 * this build has never heard of. {@link attachmentMedium} answers `"file"` for
 * those — the arm that needs no geometry and no codec — rather than dropping
 * them or throwing. A type nobody here knows is still an attachment somebody
 * sent, and a thread that silently lost it would be lying about what was said.
 *
 * ── One dead attachment costs the message nothing ─────────────────────────
 *
 * A ref the CDN could not resolve comes back inside a 200 with
 * `meta_status: "missing"` and a named reason, and a malformed entry is dropped
 * by {@link readAttachments} without taking the other nine with it. Both are
 * the backend's own posture (`stapel_chat/attachments.py`: "a message with one
 * dead attachment still renders the other nine") mirrored on this side.
 */
import type { StapelImage, VariantMeta } from "@stapel/image";
import type { Attachment, ChatMessage } from "../api/types.js";

/**
 * Which ARM draws this attachment. Four, because four is how many genuinely
 * different renders there are — not five, and not one per registry type.
 *
 * `image` and `gif` are one arm with one flag between them (`animated`), which
 * is what lets a skin offer a play affordance without sniffing a mime type.
 */
export type AttachmentMedium = "image" | "video" | "audio" | "file";

/** The four registry types this build draws with something other than an icon. */
const MEDIUM_BY_TYPE: Readonly<Record<string, AttachmentMedium>> = {
  image: "image",
  gif: "image",
  video: "video",
  audio: "audio",
  file: "file",
};

/**
 * The arm for one attachment.
 *
 * Decided on `type` — the registry name, which is also the CDN's `kind`,
 * because they are one vocabulary by construction since 0.9.0. NOT on `mime`,
 * and not on the extension: both are facts about the bytes, while the arm is a
 * decision the deployment's registry already made.
 */
export function attachmentMedium(attachment: Attachment): AttachmentMedium {
  return MEDIUM_BY_TYPE[attachment.type] ?? "file";
}

/** Whether this one moves, so a skin offers a play affordance for a still. */
export function isAnimated(attachment: Attachment): boolean {
  return attachment.animated === true || attachment.type === "gif";
}

/**
 * The attachments on a message, with the unreadable entries dropped.
 *
 * `key` and `type` are the two fields every descriptor has and the two a
 * renderer cannot do without — a ref with no key names nothing and a ref with
 * no type has no arm. Everything else is allowed to be null: that is the whole
 * design of the contract (`meta_status` / `meta_reason` carry WHY), and a
 * reader that required a preview would refuse the very attachments this
 * module exists to draw a placeholder for.
 */
export function readAttachments(
  message: Pick<ChatMessage, "attachments">
): readonly Attachment[] {
  const raw = message.attachments;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is Attachment =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as Attachment).key === "string" &&
      (item as Attachment).key !== "" &&
      typeof (item as Attachment).type === "string" &&
      (item as Attachment).type !== ""
  );
}

/**
 * A message whose whole content IS its attachments.
 *
 * The body is empty and there is at least one descriptor — the case the
 * backend describes as "empty when only attachments are present". A bubble
 * draws no text line for it rather than an empty one, and the inbox says so
 * with an icon (`model/previews.ts`).
 */
export function isAttachmentOnly(message: ChatMessage): boolean {
  return message.body === "" && readAttachments(message).length > 0;
}

/**
 * The shape to reserve BEFORE anything has loaded, or `null` for "unknowable".
 *
 * This is the no-layout-jump rule itself, and the order matters:
 *
 * 1. the measured `aspect`, when the CDN probed the asset — the real answer;
 * 2. `width / height`, when the geometry arrived but the ratio did not;
 * 3. the shape `preview_kind` IMPLIES, which is known from `type` alone and
 *    therefore known while `preview_b64` is still null — a poster is 16:9, a
 *    waveform is a wide short strip;
 * 4. `null` for a still with no geometry at all, because a photograph can be
 *    any shape and a guessed box has to jump TWICE: once to the wrong shape
 *    and once to the right one.
 *
 * Steps 3 and 4 are `@stapel/image`'s own table (`PREVIEW_KIND_ASPECT`) and are
 * applied by `<Image>` itself; this function exists for the arms that do not go
 * through `<Image>` — a video's native player and an audio row's controls.
 */
export function reservedAspect(attachment: Attachment): number | null {
  if (typeof attachment.aspect === "number" && attachment.aspect > 0) {
    return attachment.aspect;
  }
  const { width, height } = attachment;
  if (
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0
  ) {
    return width / height;
  }
  switch (attachment.preview_kind) {
    case "poster":
      return 16 / 9;
    case "waveform":
      return 4;
    default:
      return null;
  }
}

/**
 * One ladder rung in `@stapel/image`'s spelling.
 *
 * THE TWO CONTRACTS DISAGREE ON `tier` and this is the only place in this pair
 * that knows: stapel-chat forwards stapel-cdn's snapshot, whose ladder rungs
 * carry an INT while the appended `original` entry carries the string
 * sentinel; `@stapel/image` wants a decimal string for both. `String()` is
 * right for either, which is why there is no branch — the same single-boundary
 * conversion `cdn-react/src/model/refs.ts` documents for the upload side.
 */
function toVariantMeta(variant: Readonly<Record<string, unknown>>): VariantMeta {
  const tier = variant["tier"];
  const branch = variant["branch"];
  return {
    tier: typeof tier === "string" || typeof tier === "number" ? String(tier) : "",
    branch: branch === "w" || branch === "h" ? branch : null,
    url: typeof variant["url"] === "string" ? variant["url"] : "",
    width: typeof variant["width"] === "number" ? variant["width"] : null,
    height: typeof variant["height"] === "number" ? variant["height"] : null,
  };
}

/**
 * A descriptor → what `<Image>` consumes.
 *
 * The display URL is the ladder's `original` rung when there is one and the
 * largest rung otherwise. An audio row and a document have NEITHER, so `url` is
 * `""` — which `<Image>` reads as "there is nothing to load" and answers with
 * the placeholder its `preview_kind` asks for. Building a URL out of `key`
 * instead would be this pair inventing addresses for an opaque reference, the
 * one thing the whole CDN seam refuses to do.
 */
export function attachmentToImage(attachment: Attachment): StapelImage {
  const rungs = Array.isArray(attachment.variants)
    ? attachment.variants
        .filter(
          (variant): variant is Record<string, unknown> =>
            typeof variant === "object" && variant !== null
        )
        .map(toVariantMeta)
        .filter((variant) => variant.url !== "")
    : [];
  const original = rungs.find((variant) => variant.tier === "original");
  const largest = rungs.reduce<VariantMeta | undefined>((best, variant) => {
    if (variant.tier === "original") return best;
    const size = Number(variant.tier);
    if (!Number.isFinite(size)) return best;
    return best === undefined || size > Number(best.tier) ? variant : best;
  }, undefined);
  const display = original ?? largest;
  return {
    source: "cdn",
    url: display?.url ?? "",
    mime: attachment.mime ?? null,
    width: attachment.width ?? null,
    height: attachment.height ?? null,
    aspect: attachment.aspect ?? null,
    square: attachment.square ?? false,
    preview_b64: attachment.preview_b64 ?? null,
    variants: rungs,
    // `type` IS the CDN kind (one vocabulary, 0.9.0) — so `<Image>`'s own
    // "may an <img> load this url" rule gets the truth rather than a default.
    kind: attachment.type,
    preview_kind: attachment.preview_kind ?? null,
    duration_ms: attachment.duration_ms ?? null,
    poster_url: attachment.poster_url ?? null,
    ...(attachment.meta_status === "ok" ||
    attachment.meta_status === "partial" ||
    attachment.meta_status === "missing"
      ? { meta_status: attachment.meta_status }
      : {}),
    meta_reason: attachment.meta_reason ?? null,
  } as StapelImage;
}

/**
 * The URL a medium can honestly be opened at, or `null`.
 *
 * A video reaches one through the ladder or its poster's sibling; a document
 * reaches NONE — a describe snapshot carries no canonical URL for a file and
 * there is no field on the wire that holds one. `null` is the honest answer,
 * and a skin draws the document without a download link rather than with a
 * link built out of the opaque key. Recorded as an upstream gap rather than
 * worked around.
 */
export function attachmentUrl(attachment: Attachment): string | null {
  const image = attachmentToImage(attachment);
  if (image.url !== "") return image.url;
  return null;
}

/** What a document's badge shows: the extension, uppercase, without its dot. */
export function attachmentExtension(attachment: Attachment): string {
  const ext = attachment.ext ?? "";
  if (ext !== "") return ext.replace(".", "").toUpperCase();
  const name = attachment.name ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
}
