import {
  actionAvailable,
  actionBlocked,
  firstBlock,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type {
  ListingLifecycleStatus,
  ListingOwnerTransition,
} from "../api/types.js";
import {
  useArchiveListing,
  useCompleteListing,
  useDeleteListing,
  useTransitionListing,
} from "../model/mutations.js";
import { canDelete, canTransition, ownerMoves } from "../model/transitions.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * The lifecycle moves an owner can actually request, each behind a gate that
 * states its reason.
 *
 * ── The server says what is offerable; nothing here re-derives it ──────────
 *
 * `MyListingCard.available_transitions` (stapel-listings 0.20.0) is the
 * seller's half of the state machine, reported for ONE row by the module that
 * owns the machine — and it is the same list `POST {id}/transition/`
 * validates against, so the set a person is offered and the set the server
 * takes are one object rather than two that agree today.
 *
 * Before it, this hook offered a FIXED three (archive, complete, delete) and
 * gated them against a local copy of the table. That shipped two defects at
 * once, and both were live:
 *
 *  - **Buttons that did nothing.** `canTransition(from, to)` answers true for
 *    `from === to` — correctly, since the server returns early on a
 *    same-status move — so a SOLD row's "Mark sold" and an ARCHIVED row's
 *    "Archive" were enabled, clickable and inert. Two of four controls on
 *    every archived row.
 *  - **No way back.** The whole vocabulary was `archive` and `complete`, and
 *    both are EXITS. A seller who marked something sold by a misclick could
 *    not un-sell it: `SOLD → PUBLISHED` was in the machine and had no route,
 *    so the honest answer the cabinet had left was Delete and start again.
 *
 * {@link ListingActionsBag.moves} is now the whole answer for a dashboard:
 * whatever it holds is drawn, and a control that would be a no-op is not in
 * it. `ownerMoves` supplies the fallback for a surface that holds a bare
 * `status` (a detail pane, a row read before 0.20.0) — never as a second
 * opinion where the card carries the field.
 *
 * ── The mirror is UX, the 409 is the verdict ───────────────────────────────
 *
 * The server still decides — `transition_to` raises and the view answers 409
 * `error.409.invalid_listing_transition` with `params.from_status` — and that
 * refusal is rendered as the named thing it is.
 */

/** One move a seller may make from where the listing is now. */
export interface ListingMove {
  /** Where it lands. The vocabulary `available_transitions` speaks. */
  readonly to: ListingOwnerTransition;
  /** The caption's i18n KEY — never a literal; this is a headless hook. */
  readonly labelKey: string;
  /** Mandate and in-flight only: the move itself is offered, or it would not
   * be in this list. */
  readonly gate: ActionAvailability;
  /** A stable hook for a skin's `data-testid`, so a test names the MOVE
   * rather than the position of a button in a wrapping row. */
  readonly testId: string;
  run(): void;
}

export interface ListingActionsBag {
  /**
   * Every move this listing's owner may make, in drawing order, and NOTHING
   * else. Empty is a real answer (a row mid-load, a status with no owner
   * edges) and a skin draws no action row for it.
   */
  readonly moves: readonly ListingMove[];
  readonly archive: ActionAvailability;
  readonly complete: ActionAvailability;
  readonly remove: ActionAvailability;
  /**
   * Is deleting this listing a move this row HAS at all — the same question
   * {@link ListingActionsBag.moves} answers for the lifecycle edges, asked for
   * the one action that is not one of them.
   *
   * `false` for a listing that is on sale (PUBLISHED, PENDING): the server has
   * no route that deletes it, so there is nothing behind the control. It used
   * to be drawn anyway, switched off — and the desktop walk measured what that
   * costs (D425): twenty-six presses of a button that reads as live, carrying
   * `aria-disabled="true"`, opening no dialog and changing nothing. Whether the
   * refusal beside it is visible is a layout question, and pooling made the
   * answer "no" on that screen; a control with nothing behind it does not get
   * to depend on the answer. The move that IS available — archive — is in
   * `moves`, and after it the delete control appears and works.
   *
   * {@link ListingActionsBag.remove} keeps stating the reason, so a surface
   * that decides to draw the control anyway still says why it is off rather
   * than presenting a bare disabled box.
   */
  readonly removable: boolean;
  /**
   * Whether "edit this listing" is offerable — and if not, WHY.
   *
   * Editing is not an endpoint this pair calls: the composer is a screen, and
   * whether the app has one is the container's fact, which is why it arrives
   * as an argument rather than being derived. It is a gate all the same,
   * because the alternative shipped for two releases: `<GatedButton gate={{
   * available: true }}>` beside an absent `onEdit`, i.e. an enabled button
   * that did nothing at all in the scripted scaffold (§83, "a control that
   * offers something meaningless in the current state").
   */
  editGate(hasEditor: boolean): ActionAvailability;
  doArchive(): void;
  doComplete(): void;
  doRemove(): void;
  readonly inFlight: boolean;
  /** The last refusal from any of them, in the one error dialect. */
  readonly error: unknown;
}

/** What a caption says, keyed by where the move lands. */
const MOVE_LABEL: Readonly<Record<ListingOwnerTransition, string>> = {
  published: LISTINGS_I18N_KEYS.moveToPublished,
  pending: LISTINGS_I18N_KEYS.moveToPending,
  paused: LISTINGS_I18N_KEYS.moveToPaused,
  draft: LISTINGS_I18N_KEYS.moveToDraft,
  // These two edges have had buttons since this pane existed. They keep their
  // captions: renaming them now would be a change of wording dressed as a
  // change of capability.
  sold: LISTINGS_I18N_KEYS.mineComplete,
  archived: LISTINGS_I18N_KEYS.mineArchive,
  // In the vocabulary because the enum is the whole lifecycle; not in any
  // seller's offered set (`rejected` and `blocked` are moderation's verdicts,
  // `expired` is the clock's). Named anyway rather than left to a lookup that
  // could return undefined.
  rejected: LISTINGS_I18N_KEYS.statusRejected,
  blocked: LISTINGS_I18N_KEYS.statusBlocked,
  expired: LISTINGS_I18N_KEYS.statusExpired,
};

/**
 * The caption for moving from *from* to *to*.
 *
 * One edge earns a second sentence: `EXPIRED → PENDING` is the same move as
 * "send for review" asked at a different moment — nothing is wrong with the
 * listing, its time simply ran out — and "Renew" is what a person came to the
 * dashboard to do.
 */
function moveLabelKey(
  from: ListingLifecycleStatus,
  to: ListingOwnerTransition
): string {
  if (from === "expired" && to === "pending") {
    return LISTINGS_I18N_KEYS.moveRenew;
  }
  return MOVE_LABEL[to];
}

export interface UseListingActionsOptions {
  /**
   * The row's own `available_transitions`, when the caller has a
   * {@link MyListingCard} rather than a bare status. THE answer where it is
   * present; see this file's header.
   */
  readonly available?: readonly ListingOwnerTransition[] | undefined;
}

export function useListingActions(
  id: number,
  status: ListingLifecycleStatus | undefined,
  options: UseListingActionsOptions = {}
): ListingActionsBag {
  const mandate = useMandateGate();
  const archive = useArchiveListing();
  const complete = useCompleteListing();
  const remove = useDeleteListing();
  const move = useTransitionListing();

  const inFlight =
    archive.isPending ||
    complete.isPending ||
    remove.isPending ||
    move.isPending;
  const busy: ActionAvailability = inFlight
    ? actionBlocked(LISTINGS_I18N_KEYS.blockedInFlight)
    : actionAvailable();

  // An unknown status blocks with the loading reason rather than guessing:
  // the whitelist cannot be consulted for a state nobody has read yet.
  const known: ActionAvailability =
    status === undefined
      ? actionBlocked(LISTINGS_I18N_KEYS.detailLoading)
      : actionAvailable();

  function transitionGate(to: ListingLifecycleStatus): ActionAvailability {
    if (status === undefined) return known;
    return canTransition(status, to)
      ? actionAvailable()
      : actionBlocked(LISTINGS_I18N_KEYS.blockedTransition, {
          from_status: status,
        });
  }

  const archiveGate = firstBlock(mandate, known, busy, transitionGate("archived"));
  const completeGate = firstBlock(mandate, known, busy, transitionGate("sold"));
  const removeGate = firstBlock(
    mandate,
    known,
    busy,
    status !== undefined && !canDelete(status)
      ? actionBlocked(LISTINGS_I18N_KEYS.blockedDeleteActive)
      : actionAvailable()
  );

  // Mandate and in-flight, and nothing else: a move that is IN this list is
  // one the server has said it will take, so there is no third gate to
  // consult. The whole point of `available_transitions` is that "may I?" was
  // answered before the button was drawn.
  const moveGate = firstBlock(mandate, busy);
  const moves: readonly ListingMove[] =
    status === undefined
      ? []
      : ownerMoves(status, options.available).map((to) => ({
          to,
          labelKey: moveLabelKey(status, to),
          gate: moveGate,
          testId: `listings-mine-move-${to}`,
          run: () => {
            if (moveGate.available) move.mutate({ id, to });
          },
        }));

  return {
    moves,
    archive: archiveGate,
    complete: completeGate,
    remove: removeGate,
    // A status nobody has read yet offers nothing: `known` already blocks the
    // gate, and a control drawn for an unknown row is a control that may turn
    // out to have had no route behind it.
    removable: status !== undefined && canDelete(status),
    editGate: (hasEditor) =>
      firstBlock(
        mandate,
        hasEditor
          ? actionAvailable()
          : actionBlocked(LISTINGS_I18N_KEYS.blockedNoEditor)
      ),
    doArchive: () => {
      if (archiveGate.available) archive.mutate(id);
    },
    doComplete: () => {
      if (completeGate.available) complete.mutate(id);
    },
    doRemove: () => {
      if (removeGate.available) remove.mutate(id);
    },
    inFlight,
    error: archive.error ?? complete.error ?? move.error ?? remove.error,
  };
}
