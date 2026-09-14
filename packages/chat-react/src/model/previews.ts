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

/**
 * The mark per TYPE — `image`/`gif` draw one picture, so the table is keyed by
 * the glyph a type resolves to and deduplicated on it, never on the name.
 *
 * The names are the registry's, which are stapel-cdn's media kinds
 * (`stapel_chat.attachments` — "one vocabulary, not two"). The registry is
 * OPEN, so this table is NOT exhaustive and must never be read as an enum: a
 * deployment that registers `sticker` sends `sticker`, and an unknown name
 * falls back to the generic clip rather than disappearing off the row.
 */
const TYPE_GLYPH: Readonly<Record<string, string>> = {
  image: "\u{1F5BC}\u{FE0F}",
  gif: "\u{1F5BC}\u{FE0F}",
  video: "\u{1F3AC}",
  audio: "\u{1F3A4}",
  file: "\u{1F4CE}",
};

/** A type this build has never heard of — still an attachment, still a mark. */
const GENERIC_GLYPH = "\u{1F4CE}";
/** A tombstone. */
const DELETED_GLYPH = "\u{1F6AB}";

/**
 * How many marks a row draws before the rest become a number.
 *
 * Three, because the registry is open and the glyph strip shares a 300px row
 * with a name, a badge and a clock: a message with six kinds in it would push
 * the preview off the row to say something the `+N` says in two characters.
 */
const MAX_GLYPHS = 3;

/** What an inbox row draws before its last line. */
export interface InboxPreviewMarks {
  /** One glyph per DISTINCT kind, in the order the message carries them. */
  readonly glyphs: readonly string[];
  /** The `N` in `+N`, or `0` when every attachment already has a mark. */
  readonly overflow: number;
}

const NO_MARKS: InboxPreviewMarks = { glyphs: [], overflow: 0 };

/** `attachment_types` as this build is willing to read it, or `undefined`. */
function attachmentTypes(
  last: LastMessage
): readonly string[] | undefined {
  const types = (last as { attachment_types?: unknown }).attachment_types;
  return Array.isArray(types)
    ? types.filter((t): t is string => typeof t === "string" && t !== "")
    : undefined;
}

/** `attachment_count`, or the type count when the server did not send one. */
function attachmentCount(last: LastMessage, fallback: number): number {
  const count = (last as { attachment_count?: unknown }).attachment_count;
  return typeof count === "number" && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : fallback;
}

/**
 * The MARKS an inbox row draws in front of the wordless line's first word.
 *
 * A row whose last message was a photo used to read "Attachment", which is the
 * one word that is true of every attachment and descriptive of none. A mark
 * before the sentence is read at a glance, in every language, at the size an
 * inbox row actually gives it.
 *
 * ── IT IS ONE MARK PER TYPE NOW, AND WHY IT WAS NOT ──────────────────────
 *
 * Because the projection did not say which type it was.
 * `LastMessageResponse` carried `seq`, `kind`, `sender_id`, `created_at`,
 * `body_preview` and `preview_reason` and no attachment information at all, so
 * "a picture" and "a voice message" were indistinguishable here and a table of
 * five icons would have been this pair guessing which one to draw. **stapel-chat
 * 0.10.0 ships the two fields** — `attachment_types` (the DISTINCT types, in
 * order of appearance) and `attachment_count` (the total) — computed from the
 * message's own stored descriptors inside the query the list already runs. So
 * the row draws what is there, and this pair still asks the CDN nothing.
 *
 * ── THE THREE ARMS ───────────────────────────────────────────────────────
 *
 * - **A tombstone** draws its own mark and nothing else. The server sends an
 *   empty list and a `0` for it, and the check here is on `preview_reason`
 *   anyway: a withdrawn message must not announce what it had, whichever half
 *   of the wire is answering.
 * - **A server that names the types** (0.10.0+) gets one glyph per distinct
 *   kind, capped at {@link MAX_GLYPHS}, and `+N` for whatever the marks do not
 *   already stand for — `count - glyphs.length`, so six photos read
 *   "picture +5" and not "picture +6", which would be counting the one the
 *   glyph is already showing twice.
 * - **A server that does not** (the manifest claims `>=0.10 <0.11`, but a
 *   deployment lags its pair every day of a rollout) sends no field at all.
 *   `attachment_types` is `undefined` there and the row keeps the ONE generic
 *   clip it drew before, exactly where it drew it — a blank space would be
 *   this pair reporting "no attachment" about a message it simply cannot see
 *   the types of, which is the one thing a degraded arm must not say.
 *
 * A captioned photo draws marks too: the words and the picture are both on the
 * row, and `preview_reason` is `null` for it because there ARE words. That is
 * why the marks are read off `attachment_types` rather than off the reason —
 * the reason only ever spoke for the wordless case.
 *
 * The glyphs accompany the sentence rather than replacing it: a reader who gets
 * no pixels still needs the word, and a mark alone is not a label.
 */
export function inboxPreviewMarks(
  last: LastMessage | null | undefined
): InboxPreviewMarks {
  if (last === null || last === undefined) return NO_MARKS;

  const reason = previewReason(last);
  if (reason === "deleted") return { glyphs: [DELETED_GLYPH], overflow: 0 };

  const types = attachmentTypes(last);
  if (types === undefined || types.length === 0) {
    /* PRE-0.10 ONLY, plus the shape a 0.10 server cannot produce (a wordless
       attachment row with an empty list). Both keep the old generic mark, and
       both keep it only where the old rule drew it. */
    return reason === "attachment"
      ? { glyphs: [GENERIC_GLYPH], overflow: 0 }
      : NO_MARKS;
  }

  const glyphs: string[] = [];
  for (const type of types) {
    const glyph = TYPE_GLYPH[type] ?? GENERIC_GLYPH;
    if (!glyphs.includes(glyph)) glyphs.push(glyph);
    if (glyphs.length === MAX_GLYPHS) break;
  }
  const count = attachmentCount(last, types.length);
  return {
    glyphs,
    overflow: count > glyphs.length ? count - glyphs.length : 0,
  };
}

/**
 * The FIRST mark a row draws, or `null` — {@link inboxPreviewMarks} for one
 * glyph.
 *
 * Kept because it is this pair's published surface and a host may be drawing
 * its own row with it. It answers the per-type glyph now (a photo row returns
 * a picture, not a clip) for the same reason the row does: the server says
 * which, and one honest mark beats one generic one.
 */
export function inboxPreviewGlyph(
  last: LastMessage | null | undefined
): string | null {
  return inboxPreviewMarks(last).glyphs[0] ?? null;
}
