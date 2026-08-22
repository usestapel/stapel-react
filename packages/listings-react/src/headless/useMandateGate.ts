import { matchMandate, useMandate } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { actionAvailable, actionBlocked } from "@stapel/core";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";

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
export function useMandateGate(): ActionAvailability {
  const mandate = useMandate();
  return matchMandate<ActionAvailability>(mandate, {
    member: () => actionAvailable(),
    guest: () => actionBlocked(LISTINGS_I18N_KEYS.blockedGuest),
    anonymous: () => actionBlocked(LISTINGS_I18N_KEYS.blockedSignIn),
    asking: () => actionBlocked(LISTINGS_I18N_KEYS.blockedMandateUnknown),
    unavailable: () => actionBlocked(LISTINGS_I18N_KEYS.blockedMandateUnknown),
  });
}
