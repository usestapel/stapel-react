import {
  actionAvailable,
  actionBlocked,
  firstBlock,
} from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import type { ListingLifecycleStatus } from "../api/types.js";
import {
  useArchiveListing,
  useCompleteListing,
  useDeleteListing,
} from "../model/mutations.js";
import { canDelete, canTransition } from "../model/transitions.js";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import { useMandateGate } from "./useMandateGate.js";

/**
 * The three lifecycle moves an owner can actually request, each behind a gate
 * that states its reason.
 *
 * ── The mirror is UX, the 409 is the verdict ───────────────────────────────
 *
 * `LISTING_TRANSITIONS` (`model/transitions.ts`) is a copy of the server's
 * whitelist, and it exists so a control can be switched off WITH a sentence:
 * "a listing that is sold cannot be archived that way" beats a toast after
 * the click. The server still decides — `transition_to` raises and the view
 * answers 409 `error.409.invalid_listing_transition` with
 * `params.from_status` — and that refusal is rendered as the named thing it
 * is. The mirror may never block what the server would allow, which is why it
 * is a copy of the table and not a summary of it.
 */
export interface ListingActionsBag {
  readonly archive: ActionAvailability;
  readonly complete: ActionAvailability;
  readonly remove: ActionAvailability;
  doArchive(): void;
  doComplete(): void;
  doRemove(): void;
  readonly inFlight: boolean;
  /** The last refusal from any of the three, in the one error dialect. */
  readonly error: unknown;
}

export function useListingActions(
  id: number,
  status: ListingLifecycleStatus | undefined
): ListingActionsBag {
  const mandate = useMandateGate();
  const archive = useArchiveListing();
  const complete = useCompleteListing();
  const remove = useDeleteListing();

  const inFlight = archive.isPending || complete.isPending || remove.isPending;
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

  return {
    archive: archiveGate,
    complete: completeGate,
    remove: removeGate,
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
    error: archive.error ?? complete.error ?? remove.error,
  };
}
