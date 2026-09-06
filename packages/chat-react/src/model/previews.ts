/**
 * WHAT WAS LAST SAID, for a row of the inbox — read off the row.
 *
 * ── The gap this used to work around, now closed ──────────────────────────
 *
 * `ConversationResponse` carried no last message, so a preview could not be
 * READ off the list endpoint and the only two ways to invent one were both
 * wrong: a `GET /messages?limit=1` per row turns one screen into twenty-one
 * requests, and a made-up line is worse than a blank one. This module used to
 * be the third way — read the thread windows this client happened to hold,
 * ask for nothing, and show a preview only on the rows the reader had already
 * opened. Honest, and empty on a first visit, which is every visit that
 * matters.
 *
 * stapel-chat 0.8.3 ships the projection: `last_message` is annotated for the
 * whole page inside the query the list already runs (see `api/types.ts`). So
 * a row draws its line on FIRST paint, from the row, and this module is a
 * pure function over it.
 *
 * ── The three nulls, and the one that is a guess ──────────────────────────
 *
 * `body_preview` is `null` in exactly three cases and `kind` separates only
 * one of them:
 *
 *   `system` + null   an unlabelled marker (`video.call.ended:188`) — this
 *                     deployment gave it no words, so the row says only that
 *                     something happened;
 *   `text`   + null   EITHER an attachment-only message OR a tombstone. The
 *                     projection does not say which, and this pair does not
 *                     pretend to know: it draws the attachment line, which is
 *                     right for the common case and merely vague for the
 *                     other, rather than calling a picture "deleted".
 *
 * NAMED UPSTREAM GAP: a discriminator on the projection (`preview_reason:
 * "deleted" | "attachment" | "unlabelled"`, or simply the `deleted` flag the
 * message row already carries) is what would let a tombstone say so on the
 * inbox row again — the pair has the copy for it (`chat.list.preview_deleted`)
 * and no way to reach it. It is a contract change in stapel-chat, not
 * something a skin can paper over.
 */
import type { TranslateFn } from "@stapel/core";
import type { LastMessage } from "../api/types.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * The one line a row draws for its last message, already localized.
 *
 * `""` for a thread nobody has written in (`last_message: null`) — the row
 * draws no line at all rather than an empty grey strip, because "nothing has
 * been said here" is not a message that was said.
 *
 * `viewerId` is what turns the reader's own line into "You: …". It is the
 * projection's `sender_id` compared as a STRING: a host may hold the id as a
 * number and the wire always sends text.
 */
export function inboxPreviewLine(
  last: LastMessage | null | undefined,
  viewerId: string | null,
  t: TranslateFn
): string {
  if (last === null || last === undefined) return "";
  const preview = last.body_preview ?? null;
  if (preview === null) {
    // A system marker with no words in this deployment: the row says a system
    // line happened, which is what `kind` actually tells us. Anything more
    // specific would be this pair inventing the label the deployment declined
    // to give.
    if (last.kind === "system") return t(CHAT_I18N_KEYS.listPreviewSystem);
    // See the header: attachment-only and tombstone arrive as the same null.
    return t(CHAT_I18N_KEYS.listPreviewAttachment);
  }
  const own =
    viewerId !== null &&
    last.sender_id !== null &&
    last.sender_id !== undefined &&
    String(last.sender_id) === viewerId;
  return own
    ? t(CHAT_I18N_KEYS.listPreviewOwn, { text: preview })
    : preview;
}
