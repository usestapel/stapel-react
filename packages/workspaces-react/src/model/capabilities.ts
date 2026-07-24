/**
 * Client-side capability matcher (org-program §A1/§A2) — a PORT of
 * stapel-workspaces' `capabilities.capability_matches` (which is itself
 * mirrored by the consumer helper in `stapel_core.django.workspaces`).
 * KEEP SEMANTICS IN SYNC with the backend: capability strings are namespaced
 * `"<domain>.<action>"`, free-form for the client (`meetings.spotlight`,
 * `records.view`, …); a granted string may be the exact capability, the
 * global wildcard `"*"`, or a prefix wildcard like `"members.*"` (which
 * matches `members.remove` AND deeper `members.role.change`).
 *
 * The client-side check is a UI convenience (hide/disable affordances) —
 * NEVER an access decision: the backend re-checks every capability on every
 * operation (`has_capability` in-service, `workspaces.check_capability`
 * cross-service).
 */

/** Match one granted capability string against the requested one. */
export function capabilityMatches(
  capability: string,
  granted: string
): boolean {
  if (granted === "*" || granted === capability) return true;
  if (granted.endsWith(".*")) {
    return capability.startsWith(granted.slice(0, -1));
  }
  return false;
}

/** True if any of `granted` (verbatim registry strings, wildcards included)
 * matches `capability`. Empty/absent grants deny — deny-by-default. */
export function hasCapability(
  granted: readonly string[] | null | undefined,
  capability: string
): boolean {
  if (!granted) return false;
  return granted.some((g) => capabilityMatches(capability, g));
}
