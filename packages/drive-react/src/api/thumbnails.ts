/**
 * The thumbnail URL builder — the one place this pair spells the preview path.
 *
 * ── Why a URL and not a read ──────────────────────────────────────────────
 *
 * `GET /documents/:id/thumbnail?tier=` answers image BYTES through the same
 * `authorize()` choke point and the same storage seam as the content
 * endpoint (spec §3.6: "a preview is the document, smaller"). It is therefore
 * authenticated exactly like the content URL is — by the `stapel_jwt` cookie
 * the browser attaches to a same-origin (or `credentials`-configured
 * cross-origin) subresource request. Handing `<img src>` that URL is the
 * whole integration: the browser's image loader does the conditional GET, the
 * caching and the decode, and the response's `ETag` (`"<head_seq>-<tier>"`)
 * means a saved document addresses a different image rather than a stale one.
 *
 * The alternative — fetch the bytes and mint an object URL — would move the
 * image into JS memory, lose the HTTP cache and hand every list row a
 * lifecycle to revoke. The one thing it would buy is an Authorization HEADER,
 * which a host that authenticates by header (not cookie) needs; such a host
 * renders its own thumbnail component through the skin slot rather than
 * making every other host pay for the round trip.
 *
 * The tier ladder is fixed by the backend (160/480) and typed as a union
 * here, because an unknown tier is a 400 — not a smaller picture.
 */
import type { ThumbnailTier } from "./types.js";

/** Strip one trailing slash so `${base}${path}` never doubles it. */
function trimBase(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

/**
 * `<baseUrl>/documents/<id>/thumbnail?tier=<tier>` — the `<img src>` for a
 * document's cached preview at one rung of the ladder.
 */
export function thumbnailUrl(
  baseUrl: string,
  documentId: string,
  tier: ThumbnailTier
): string {
  return `${trimBase(baseUrl)}/documents/${encodeURIComponent(documentId)}/thumbnail?tier=${String(tier)}`;
}
