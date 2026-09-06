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
 * ── The three nulls, and the guess that is gone ───────────────────────────
 *
 * `body_preview` is `null` in exactly three cases, and until stapel-chat
 * 0.8.4 the projection did not say which:
 *
 *   an unlabelled system marker (`video.call.ended:188` — this deployment
 *   gave it no words), an attachment-only message, and a TOMBSTONE. `kind`
 *   separated the first; the other two arrived as the same `null` with
 *   `kind: "text"`, so this function drew the attachment line for both —
 *   right for the common case, and "Attachment" printed over a message
 *   somebody deleted for the other. The pair has had the copy for it
 *   (`chat.list.preview_deleted`) since it had an inbox, and no way to reach
 *   it.
 *
 * `preview_reason` is the discriminator (`services.last_line_reason`, decided
 * over the same columns `drawn_last_line` reads). It is the ONLY thing
 * consulted now: the guess is deleted rather than kept beside it, and `kind`
 * decides nothing about this line any more.
 *
 * ── The one arm that is a degradation, and says so ────────────────────────
 *
 * The manifest announces `>=0.8 <0.9`, so a deployment on 0.8.3 is inside the
 * range this pair claims and sends a body with no `preview_reason` at all.
 * {@link previewReason} answers `undefined` there and the row falls back to
 * what it drew before — including the guess, because on that server it is
 * still the best available answer and a blank line would say "nothing has
 * been said here", which is a DIFFERENT row's sentence (`last_message: null`)
 * and the one thing this file must not tell in place of another.
 */
import type { TranslateFn } from "@stapel/core";
import type { LastMessage, LastMessagePreviewReason } from "../api/types.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** The reason keyed by its i18n sentence — the whole rule, as a table. */
const REASON_KEY: Readonly<Record<LastMessagePreviewReason, string>> = {
  deleted: CHAT_I18N_KEYS.listPreviewDeleted,
  attachment: CHAT_I18N_KEYS.listPreviewAttachment,
  system: CHAT_I18N_KEYS.listPreviewSystem,
};

/**
 * Which of the three wordless cases this row is in, or `undefined`.
 *
 * `undefined` covers both "the line has words" (`null` on the wire) and "this
 * server does not say" (the field absent, pre-0.8.4) — the caller tells them
 * apart by whether `body_preview` is there, which is the only place the
 * difference matters. A value this build has never heard of is `undefined`
 * too: an unknown reason is not a sentence to invent one for.
 */
export function previewReason(
  last: LastMessage | null | undefined
): LastMessagePreviewReason | undefined {
  const reason = last?.preview_reason;
  return reason !== null && reason !== undefined && reason in REASON_KEY
    ? (reason as LastMessagePreviewReason)
    : undefined;
}

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

  // The server's own answer, first and last. Deleted, attachment or system —
  // three cases, three sentences, no inference from `kind`.
  const reason = previewReason(last);
  if (reason !== undefined) return t(REASON_KEY[reason]);

  const preview = last.body_preview ?? null;
  if (preview === null) {
    /* PRE-0.8.4 ONLY — see the header. This server sent no discriminator, so
       the row is back to what `kind` can and cannot say: a system marker with
       no words is one, and everything else is the old attachment-or-tombstone
       ambiguity drawn as the commoner of the two. */
    if (last.kind === "system") return t(CHAT_I18N_KEYS.listPreviewSystem);
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
