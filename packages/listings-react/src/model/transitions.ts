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
 * server returns early on, so it counts as allowed. */
export function canTransition(
  from: ListingLifecycleStatus,
  to: ListingLifecycleStatus
): boolean {
  return from === to || LISTING_TRANSITIONS[from].includes(to);
}

/**
 * Deleting is not a transition and has its own rule
 * (`views.destroy`): a PUBLISHED or PENDING listing is refused with
 * `error.409.listing_cannot_delete_active` — archive it first.
 */
export function canDelete(status: ListingLifecycleStatus): boolean {
  return status !== "published" && status !== "pending";
}
