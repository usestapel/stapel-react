/**
 * THE SYSTEM LINES THIS MODULE ITSELF WRITES — machine vocabulary turned into
 * a sentence.
 *
 * ── What a system line is on the wire ─────────────────────────────────────
 *
 * A `system` message carries no author (`sender_id: null`) and its body is a
 * MARKER, not prose: `chat.participant.left:<user_id>`,
 * `video.call.ended:188`. stapel-chat writes those markers and deliberately
 * owns no words for them — `STAPEL_CHAT["SYSTEM_LINE_LABELS"]` is empty out
 * of the box, and the id after the colon is there precisely so a client can
 * name the person without the backend inventing a sentence in a language it
 * does not own.
 *
 * ── The table this file keeps, and the one it must never grow into ────────
 *
 * {@link CHAT_SYSTEM_LINE_LABELS} holds the markers **stapel-chat writes** and
 * nothing else. `video.call.ended:188` is @stapel/video-react's vocabulary
 * and stays the HOST's to draw (`<ConversationThreadPanel renderSystemMessage>`
 * — the panel's doc comment says why): a chat renderer carrying a table of
 * other modules' event names would be a copy going stale from the day it was
 * written, and this pair may not import those modules to keep it fresh. Chat's
 * own markers are the one case where none of that applies — this package and
 * the module that emits them ship as a pair, so the words belong here.
 *
 * ── Splitting on the FIRST colon ──────────────────────────────────────────
 *
 * The marker name is dotted and never contains a colon; the argument may be
 * anything (a uuid, a number). So the first colon separates them, and a body
 * with no colon at all is a marker with no argument rather than a parse
 * failure.
 */
import type { TranslateFn } from "@stapel/core";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/** A person left the thread. The argument is their user id. */
export const CHAT_MARKER_PARTICIPANT_LEFT = "chat.participant.left";

/**
 * The markers this module writes, keyed to the sentence that says them. The
 * whole rule, as a table — the shape `STAPEL_CHAT["SYSTEM_LINE_LABELS"]` has
 * on the server, with i18n keys in place of a deployment's literal strings.
 */
export const CHAT_SYSTEM_LINE_LABELS: Readonly<Record<string, string>> = {
  [CHAT_MARKER_PARTICIPANT_LEFT]: CHAT_I18N_KEYS.systemParticipantLeft,
};

/** A system body split into its marker and its argument. */
export interface ChatSystemMarker {
  /** The dotted name — `chat.participant.left`. */
  readonly marker: string;
  /** Whatever followed the first colon, or `null` when nothing did. */
  readonly argument: string | null;
}

/**
 * Read a system message's body as a marker.
 *
 * `null` for a body that is not one — an empty line, or a deployment that put
 * real prose in a system message. Nothing is inferred from the shape beyond
 * the colon: a marker this build has never heard of still parses, and it is
 * {@link systemLineText} that declines to invent a sentence for it.
 */
export function readSystemMarker(body: string): ChatSystemMarker | null {
  const trimmed = body.trim();
  if (trimmed === "") return null;
  const colon = trimmed.indexOf(":");
  if (colon < 0) return { marker: trimmed, argument: null };
  return {
    marker: trimmed.slice(0, colon),
    argument: trimmed.slice(colon + 1) || null,
  };
}

/**
 * The sentence for one of THIS module's system lines, already localized — or
 * `null` when the line is not one of them.
 *
 * `null` is the answer that matters: it is what keeps a marker belonging to
 * another module (or to a future stapel-chat) falling through to the host's
 * own renderer and, failing that, to the raw body. Printing a wrong sentence
 * over somebody else's vocabulary is worse than printing the machine string,
 * because only one of the two is visibly not for humans.
 *
 * `nameOf` resolves the argument to a display name through whatever the host
 * wired (`model/slots.ts`); `null` from it means this deployment cannot name
 * that person, and the sentence says "the other person" rather than printing
 * a uuid at a reader.
 */
export function systemLineText(
  body: string,
  t: TranslateFn,
  nameOf: (userId: string) => string | null
): string | null {
  const parsed = readSystemMarker(body);
  if (parsed === null) return null;
  const key = CHAT_SYSTEM_LINE_LABELS[parsed.marker];
  if (key === undefined) return null;
  const name =
    (parsed.argument === null ? null : nameOf(parsed.argument)) ??
    t(CHAT_I18N_KEYS.personSomeone);
  return t(key, { name });
}
