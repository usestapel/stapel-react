import { matchMandate, useElevation, useMandate } from "@stapel/core";
import type { ActionAvailability, Elevation } from "@stapel/core";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

/**
 * The names this pair's gated writes use when asking core's elevation seam
 * whether an anonymous visitor may be given an identity instead of a
 * refusal. A host lists the ones it permits (see `ElevationSource.actions`);
 * anything it leaves out keeps its wall.
 *
 * Only `favorite` is named. Publishing a listing is deliberately absent and
 * stays absent: a seller who cannot be reached again is not a seller, and an
 * automatically-minted account is exactly that. Saving something for later
 * is the opposite case — losing a shortlist because a stranger had not
 * registered is friction with nothing behind it.
 */
export const LISTINGS_ELEVATION_ACTIONS = {
  favorite: "listings.favorite",
} as const;

/**
 * "May this person act at all?" — the first gate on every write in the pair.
 *
 * Posting a listing, saving a draft, marking something sold and saving a
 * favourite are all `IsAuthenticated`. A visitor meeting one of them must be
 * told to sign in, WITH the reason and with a way to do it: a hidden button
 * teaches nothing (private-space canon §6.3), and a 401 after the click
 * teaches it too late.
 *
 * The axis is read through core's `MandateSource` seam, never derived here. A
 * storefront's derivation is "is there a session?"; a tenant app's is
 * `@stapel/workspaces-react`'s. This pair asks and does not care which.
 * `matchMandate` has five required arms, so the two `unresolved` outcomes
 * cannot fall into the refusal's branch by omission:
 *
 *  - `asking`  — we have not finished asking. The control waits; it does not
 *                say "you may not".
 *  - `unavailable` — we COULD NOT ask. Also not "you may not": the storefront
 *                spec's own negative leg (§7.4) is that `/me` answering 503
 *                must not render as a refusal.
 *
 * Outside a `<MandateProvider>` core answers `unresolved/unavailable` rather
 * than throwing, so a pair rendered in a host that never wired the axis
 * degrades to "we could not check" — visible, fixable, and not a blank page.
 */
export function useMandateGate(action?: string): ActionAvailability {
  return useElevatableMandateGate(action).gate;
}

/**
 * The same gate, with the elevation handle the caller needs to ACT on it.
 *
 * A control that passes an `action` is saying "for this one act, an
 * anonymous visitor may be given an identity rather than a refusal" — and
 * then it must run its write through `elevation.run`, or the write goes out
 * before the account exists and buys a 401. The two halves are returned
 * together so a caller cannot take the unblocked gate and forget the mint.
 *
 * Passing no `action` is the default and the majority: publishing, saving a
 * draft, marking something sold. Those keep the wall.
 */
export function useElevatableMandateGate(action?: string): {
  readonly gate: ActionAvailability;
  readonly elevation: Elevation;
} {
  const mandate = useMandate();
  const elevation = useElevation(action);
  const gate = matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionBlocked(LISTINGS_I18N_KEYS.blockedGuest),
    // The one arm elevation changes. An identity can be minted at the moment
    // of the act for the actions the host listed, so the control is offered
    // rather than refused — and the mandate axis itself is untouched, which
    // is what keeps the composer's wall standing for the same visitor.
    anonymous: () =>
      elevation.covers
        ? actionAvailable()
        : actionBlocked(LISTINGS_I18N_KEYS.blockedSignIn),
    asking: () => actionBlocked(LISTINGS_I18N_KEYS.blockedMandateUnknown),
    unavailable: () => actionBlocked(LISTINGS_I18N_KEYS.blockedMandateUnknown),
  });
  return { gate, elevation };
}
