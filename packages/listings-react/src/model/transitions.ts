/**
 * The lifecycle whitelist, mirrored from `stapel_listings.models
 * .LISTING_TRANSITIONS`.
 *
 * ── A mirror, not a verdict ────────────────────────────────────────────────
 *
 * The server decides. `transition_to` raises `TransitionError` and the view
 * answers **409 `error.409.invalid_listing_transition`** with
 * `params.from_status`, and that refusal is rendered as the named sentence it
 * is. What the mirror buys is the difference between a button that is there
 * and does nothing and a button that is switched off WITH its reason: "you
 * cannot mark a draft sold — publish it first" beats a 409 toast after the
 * click, and beats a hidden control (which teaches nothing) by the whole
 * private-space canon §6.3.
 *
 * The mirror is deliberately CONSERVATIVE in one direction only: it may never
 * block something the server would allow. That is why it is a copy of the
 * table rather than a hand-written summary of it, and why `test/status.test
 * .ts` walks every source state.
 *
 * Two entries look odd and are correct:
 *  - `published → blocked` exists, but the owner API has no route to it: only
 *    `apply_moderation("rejected")` walks it. It is in the table because the
 *    table is the model's, and leaving it out would make the mirror a
 *    paraphrase.
 *  - `blocked → published` is reinstatement after a successful appeal, also
 *    moderation-driven. `archive` and `complete` are the only two transitions
 *    this pair's API can actually request.
 */
import type { ListingLifecycleStatus } from "../api/types.js";

export const LISTING_TRANSITIONS: Readonly<
  Record<ListingLifecycleStatus, readonly ListingLifecycleStatus[]>
> = {
  draft: ["pending", "archived"],
  pending: ["published", "rejected", "draft", "archived"],
  published: ["paused", "expired", "sold", "blocked", "archived"],
  blocked: ["published", "draft", "archived"],
  paused: ["published", "archived", "expired"],
  expired: ["pending", "published", "archived"],
  sold: ["archived", "published"],
  rejected: ["draft", "archived"],
  archived: ["draft"],
};

/** Would the server accept this move? A same-status move is a no-op the
 * server returns early on, so it counts as allowed.
 *
 * "Accept" and "offer" are NOT the same question, and conflating them is the
 * whole of defect D182: `canTransition("sold", "sold")` is true, so a SOLD
 * row's "Mark sold" button was enabled, clickable, and did nothing — and so
 * was an ARCHIVED row's "Archive". Ask {@link ownerMoves} what to OFFER.
 */
export function canTransition(
  from: ListingLifecycleStatus,
  to: ListingLifecycleStatus
): boolean {
  return from === to || LISTING_TRANSITIONS[from].includes(to);
}

/**
 * The SELLER's half of the machine above, mirrored from
 * `stapel_listings.models.OWNER_TRANSITIONS` (0.20.0).
 *
 * A subset of {@link LISTING_TRANSITIONS}, and what it leaves out is as
 * load-bearing as what it keeps: `pending → published` and
 * `blocked → published` are moderation's decisions, `published → blocked` is
 * a takedown, and none of the three is a thing one does to oneself. Putting
 * them here would make the cabinet a self-service publish gate.
 *
 * ── This is a FALLBACK, and the card's own field is the answer ─────────────
 *
 * `MyListingCard.available_transitions` is the server reporting this table
 * for one row, and where it is present nothing here is consulted: the set a
 * client offers and the set the route accepts are then one object rather than
 * two that agree today. This copy is for a surface that holds only a `status`
 * — a detail pane, a listing loaded before 0.20.0 — where the alternative is
 * offering nothing at all.
 */
export const OWNER_TRANSITIONS: Readonly<
  Record<ListingLifecycleStatus, readonly ListingLifecycleStatus[]>
> = {
  draft: ["pending", "archived"],
  pending: ["draft", "archived"],
  published: ["paused", "sold", "archived"],
  paused: ["published", "archived"],
  expired: ["pending", "archived"],
  sold: ["published", "archived"],
  rejected: ["draft", "archived"],
  blocked: ["draft", "archived"],
  archived: ["draft"],
};

/**
 * The order the moves are DRAWN in, wherever they came from.
 *
 * A row's action set changes as the listing moves through its life, and a set
 * that also reorders itself makes a person hunt for the button they used
 * yesterday. Forward first (back on sale, then submitted, then paused), exits
 * last — so "Archive" is never where "Publish again" was a moment ago.
 */
const MOVE_ORDER: readonly ListingLifecycleStatus[] = [
  "published",
  "pending",
  "paused",
  "sold",
  "draft",
  "rejected",
  "blocked",
  "expired",
  "archived",
];

/**
 * What to OFFER a seller looking at a row in *status*, in drawing order.
 *
 * Never the status the row is already in: a control that would leave the
 * world exactly as it found it is not an action, and four of them down a
 * dashboard taught a seller that half the buttons on this screen do nothing.
 *
 * Pass the card's own `available_transitions` when it has one — see
 * {@link OWNER_TRANSITIONS} for why the mirror is the second-best answer.
 */
export function ownerMoves(
  status: ListingLifecycleStatus | undefined,
  available?: readonly ListingLifecycleStatus[] | undefined
): readonly ListingLifecycleStatus[] {
  if (status === undefined) return [];
  const offered = available ?? OWNER_TRANSITIONS[status];
  const set = new Set(offered.filter((to) => to !== status));
  return MOVE_ORDER.filter((to) => set.has(to));
}

/**
 * Deleting is not a transition and has its own rule
 * (`views.destroy`): a PUBLISHED or PENDING listing is refused with
 * `error.409.listing_cannot_delete_active` — archive it first.
 */
export function canDelete(status: ListingLifecycleStatus): boolean {
  return status !== "published" && status !== "pending";
}
