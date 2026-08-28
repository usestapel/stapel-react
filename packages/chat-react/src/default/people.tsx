/**
 * WHO A THREAD IS WITH — the skin half of the people seam (`model/slots.ts`).
 *
 * A `ConversationResponse` has no title and names nobody: it carries a kind,
 * a clock and a list of participant IDS. The row used to render the kind,
 * which is how a seller came to see ten rows all headed "Direct message".
 * Names live in `@stapel/profiles-react`, a PEER of this pair that must never
 * be imported here, so the container hands them in through the runtime and
 * this file renders whatever came back — including "we could not name them",
 * out loud, when nothing did.
 *
 * ONE BATCH FOR THE WHOLE LIST. `<PeopleScope>` is mounted ONCE around the
 * rows with every id the page is about to draw, never once per row, so a host
 * wiring `useProfilesBatch` pays one request for an inbox.
 */
import type { ReactElement, ReactNode } from "react";
import { Avatar, theme as antdTheme } from "antd";
import { useT } from "@stapel/core";
import { spacing } from "@stapel/tokens-antd";
import type { Conversation } from "../api/types.js";
import { useChatRuntime } from "../model/context.js";
import { noPeopleSlot } from "../model/slots.js";
import type { ChatPeopleDirectory } from "../model/slots.js";
import { CHAT_I18N_KEYS } from "../i18n/keys.js";

/**
 * The OTHER people in a conversation, in wire order.
 *
 * With no viewer id nothing can be subtracted — a list that was never told
 * who is reading it names everybody rather than guessing which one to hide.
 */
export function counterpartyIds(
  conversation: Conversation,
  viewerId: string | null
): readonly string[] {
  const participants = conversation.participants ?? [];
  const others =
    viewerId === null
      ? participants
      : participants.filter((participant) => participant.user_id !== viewerId);
  return others.map((participant) => participant.user_id);
}

/** Every id a page of rows will need, de-duplicated, in first-seen order. */
export function conversationPeopleIds(
  conversations: readonly Conversation[],
  viewerId: string | null
): readonly string[] {
  const seen = new Set<string>();
  for (const conversation of conversations) {
    for (const id of counterpartyIds(conversation, viewerId)) seen.add(id);
  }
  return [...seen];
}

/**
 * Resolve a page of ids through the host's seam — or, with no seam, through
 * the directory that answers "nobody, and I am not pretending otherwise".
 */
export function PeopleScope(props: {
  readonly userIds: readonly string[];
  readonly children: (directory: ChatPeopleDirectory) => ReactNode;
}): ReactElement {
  const runtime = useChatRuntime();
  const People = runtime.slots.people ?? noPeopleSlot;
  return <People userIds={props.userIds}>{props.children}</People>;
}

/**
 * What to CALL this thread's other side.
 *
 * A support case is named by its kind, because there is no person on the far
 * end to name — an operator queue is the product, not a correspondent. Every
 * other kind is named by the people in it, and when the directory has no
 * answer the sentence says exactly that instead of falling back to a label
 * that looks deliberate.
 */
export function useCounterpartyLabel(
  conversation: Conversation,
  viewerId: string | null,
  directory: ChatPeopleDirectory
): string {
  const t = useT();
  if (conversation.kind === "support") return t(CHAT_I18N_KEYS.kindSupport);
  const ids = counterpartyIds(conversation, viewerId);
  if (ids.length === 0) return t(CHAT_I18N_KEYS.personUnnamed);
  const names = ids.map((id) => directory.lookup(id)?.displayName ?? null);
  const known = names.filter((name): name is string => name !== null);
  if (known.length === names.length) return known.join(", ");
  if (directory.pending) return t(CHAT_I18N_KEYS.personLoading);
  // Some are known and some are not: name the ones we have and say the rest
  // are missing, rather than silently shortening the room.
  return [...known, t(CHAT_I18N_KEYS.personUnnamed)].join(", ");
}

/** A head-and-shoulders outline in `currentColor` — the house icon convention. */
function PersonGlyph(): ReactElement {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.8 19.5a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

/**
 * The counterparty's avatar: their picture when the host resolved one, their
 * initial when it resolved a name only, and a neutral glyph when it resolved
 * nothing — never an initial invented from an id.
 */
export function CounterpartyAvatar(props: {
  readonly conversation: Conversation;
  readonly viewerId: string | null;
  readonly directory: ChatPeopleDirectory;
  readonly label: string;
  readonly size?: number;
}): ReactElement {
  const { token } = antdTheme.useToken();
  const ids = counterpartyIds(props.conversation, props.viewerId);
  const person = ids.length === 1 ? props.directory.lookup(ids[0] ?? "") : null;
  const url = person?.avatarUrl ?? null;
  const initial = person === null ? "" : [...person.displayName][0] ?? "";
  const size = props.size ?? spacing[7];
  return (
    <Avatar
      size={size}
      shape="circle"
      // The name is already beside it in text; a second announcement of the
      // same word is noise to a screen reader.
      aria-hidden="true"
      data-testid="chat-row-avatar"
      data-avatar={url !== null ? "photo" : initial !== "" ? "initial" : "unknown"}
      style={{
        background: token.colorFillQuaternary,
        color: token.colorTextSecondary,
        flex: "0 0 auto",
      }}
      {...(url !== null ? { src: url } : {})}
    >
      {url === null ? (initial !== "" ? initial.toUpperCase() : <PersonGlyph />) : null}
    </Avatar>
  );
}
