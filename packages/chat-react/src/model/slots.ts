/**
 * HOST-SUPPLIED SEAMS — the three things a chat pair cannot know and refuses
 * to guess: who the other person IS, how to draw the thing a thread is about,
 * and what "report" and "block" mean in this product.
 *
 * ── Why seams and not imports ─────────────────────────────────────────────
 *
 * Names and avatars live in `@stapel/profiles-react`; report lives in
 * `@stapel/moderation-react`. Both are PEERS of this pair, and peers never
 * import each other — a chat that pulled profiles in would drag a second
 * module's runtime, its session gating and its bundle into every host that
 * only wanted messages. So the shape is the one `@stapel/listings-react`
 * already uses for `resolveImage`: the runtime takes a seam, the container
 * fills it once, and the pair states what it renders when nobody did.
 *
 * ── What "honest when absent" means here ──────────────────────────────────
 *
 * An unfilled seam must NOT fall back to something that reads as a deliberate
 * label. The inbox shipped ten rows titled "Direct message" because the row
 * title was the conversation KIND — a sentence that is true, looks designed,
 * and tells a seller nothing about which of ten buyers is writing. The
 * unresolved directory below therefore answers `null`, and the skin renders
 * "Name unavailable", which reads as the failure it is.
 *
 * `pending` is the other half of that honesty: while a host's lookup is still
 * in flight nobody has failed yet, and the skin must say "loading", not
 * "unavailable". A directory that could not tell those apart would flash the
 * failure copy on every first paint.
 */
import type { ReactNode } from "react";
import type { Subject } from "../api/types.js";

/**
 * A person, as a chat row needs them. Deliberately four fields: chat draws a
 * line in a list, it is not a profile viewer.
 */
export interface ChatPerson {
  readonly userId: string;
  /** What to call them. Never empty — a resolver with no name returns `null`. */
  readonly displayName: string;
  /** Ready-to-render avatar URL, if the host has one. */
  readonly avatarUrl?: string | null;
  /** Where their public page is, if this product has one. */
  readonly href?: string | null;
}

/** The answer to "who are these user ids", for one render. */
export interface ChatPeopleDirectory {
  /** The person, or `null` when this deployment cannot name them. */
  lookup(userId: string): ChatPerson | null;
  /** The lookup has not answered yet — say "loading", never "unavailable". */
  readonly pending: boolean;
}

export interface ChatPeopleSlotProps {
  /**
   * Every id the surface is about to draw, ONCE. The skin collects the whole
   * page before rendering a row, so a host wires `useProfilesBatch(userIds)`
   * and pays one request for the inbox — not one per row.
   */
  readonly userIds: readonly string[];
  readonly children: (directory: ChatPeopleDirectory) => ReactNode;
}

/**
 * The people seam. A COMPONENT, not a function, because the answer arrives
 * over the network and a host resolves it with its own hook
 * (`useProfilesBatch`) — which only a component may call.
 *
 * ```tsx
 * const ChatPeople: ChatPeopleSlot = ({ userIds, children }) => {
 *   const batch = useProfilesBatch(userIds);
 *   return children({
 *     pending: batch.isPending,
 *     lookup: (id) => {
 *       const entry = profileBatchEntry(batch.data, id);
 *       return entry.status === "found"
 *         ? { userId: id, displayName: entry.profile.display_name, avatarUrl: entry.profile.avatar_url }
 *         : null;
 *     },
 *   });
 * };
 * createChatRuntime({ baseUrl, slots: { people: ChatPeople } });
 * ```
 */
export type ChatPeopleSlot = (props: ChatPeopleSlotProps) => ReactNode;

/** What the skin gets when no host wired {@link ChatPeopleSlot}. */
export const UNRESOLVED_PEOPLE: ChatPeopleDirectory = {
  lookup: () => null,
  pending: false,
};

/**
 * The default people seam: it answers, immediately, that it cannot name
 * anybody. Not a no-op that renders nothing — a hole in a list is the one
 * defect nobody reports, and the row it feeds says "Name unavailable" out
 * loud so the wiring gets fixed.
 */
export const noPeopleSlot: ChatPeopleSlot = (props) =>
  props.children(UNRESOLVED_PEOPLE);

export interface ChatSubjectCardSlotProps {
  /** The subject as the server resolved it, card and degradation included. */
  readonly subject: Subject;
  readonly conversationId: string;
}

/**
 * How to draw what a thread is ABOUT.
 *
 * `SubjectResponse.card` is opaque by contract — stapel-chat stores a
 * `(type, key)` name and asks whoever owns that type for a card, and never
 * looks inside the answer. The default skin renders the conventional fields
 * (title, price, photo, link) that `classified.subject_cards` and its
 * siblings agree on; a product whose card is shaped differently replaces the
 * whole card here rather than teaching chat about its domain.
 */
export type ChatSubjectCardSlot = (props: ChatSubjectCardSlotProps) => ReactNode;

export interface ChatThreadActionSlotProps {
  readonly conversationId: string;
  /**
   * The other person, when the thread has exactly one — `null` for a group or
   * a support case, where "block them" has no single target.
   */
  readonly counterpartyId: string | null;
  readonly viewerId: string | null;
  /**
   * Dismiss the overflow menu. Call it when the slot takes the screen over
   * with a surface of its own, so a report sheet does not open on top of the
   * menu that launched it.
   */
  close(): void;
}

/**
 * One entry of the thread's overflow menu — `report` (wire
 * `@stapel/moderation-react`'s `ReportButton`) and `block` (wire
 * `@stapel/profiles-react`'s `useBlock` / `useRelationship`).
 *
 * Rendered when supplied, absent when not: a menu entry that is visibly
 * offered and does nothing is worse than one that is not there. When NEITHER
 * is supplied the skin draws no overflow control at all.
 */
export type ChatThreadActionSlot = (props: ChatThreadActionSlotProps) => ReactNode;

/**
 * Every host-supplied seam, in one bag on the runtime. Each is optional and
 * each absence has a stated rendering — see the types above.
 */
export interface ChatSlots {
  readonly people?: ChatPeopleSlot;
  readonly subjectCard?: ChatSubjectCardSlot;
  readonly report?: ChatThreadActionSlot;
  readonly block?: ChatThreadActionSlot;
}
