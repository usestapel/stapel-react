/**
 * Step-up ahead of the button, not behind it (org-program §A3).
 *
 * Some workspace operations are declared **high**: the backend gates them
 * with `stapel_core`'s `@requires_verification(scope="sensitive")` on top of
 * the capability check, so an ambient cookie is never enough. A client that
 * only learns this from the 403 shows the admin a button, a spinner and a
 * refusal; this module lets it know BEFORE the click.
 *
 * Two things travel from the backend, and they are not the same thing:
 *
 * 1. **A step-up CHALLENGE** — `verification.challenge_id` is present. This
 *    one nobody has to handle here: `@stapel/core`'s client intercepts it,
 *    hands it to the app's verification controller (auth-react's factor
 *    machines) and replays the original request with
 *    `X-Verification-Token`. It is a detour, not a failure.
 * 2. **An ENROLLMENT demand** — `verification.enroll === true` and there is
 *    NO challenge id, because the user holds no factor that could be
 *    challenged. Core deliberately does not intercept this one (there is
 *    nothing to drive), so it surfaces as a plain 403 and the app must send
 *    the user to factor enrollment first. {@link readVerificationEnrollment}
 *    is how a hook says "this is that, and these are the factors".
 *
 * KEEP IN SYNC with stapel-workspaces `capabilities.BUILTIN_CAPABILITY_LEVELS`
 * — a PORT for the same reason `capabilityMatches` is one: `GET /roles`
 * publishes each role's capabilities but not their levels, so the level map
 * cannot be read off the wire. A deployment may raise further capabilities via
 * `STAPEL_WORKSPACES["CAPABILITY_LEVELS"]`; those are additive, so treating an
 * unlisted capability as `standard` can only ever under-promise (the backend
 * still challenges, and core still drives it).
 */
import { isStapelApiError } from "@stapel/core";

/** The verification scope every `high` workspace capability is gated under. */
export const SENSITIVE_SCOPE = "sensitive";

/** Step-up level of a capability. */
export type CapabilityLevel = "standard" | "high";

/** PORT of `BUILTIN_CAPABILITY_LEVELS` — everything unlisted is `standard`. */
export const BUILTIN_CAPABILITY_LEVELS: Readonly<Record<string, "high">> = {
  "members.provision": "high",
  "members.password.reset": "high",
  "workspace.security.manage": "high",
};

/** The declared step-up level of one capability string. */
export function capabilityLevel(capability: string): CapabilityLevel {
  return BUILTIN_CAPABILITY_LEVELS[capability] ?? "standard";
}

/**
 * The 403 ENROLLMENT envelope: the caller must first enroll one of `factors`
 * — there is no challenge to complete, so core cannot drive it.
 */
export interface VerificationEnrollment {
  /** What the demand protects — `"sensitive"` for every `high` capability. */
  readonly scope: string;
  /** Interchangeable factors, any ONE of which unblocks the operation. */
  readonly factors: readonly string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Read the enrollment demand out of a rejected request, or `null` when the
 * error is anything else (including a step-up CHALLENGE, which carries a
 * `challenge_id` and is core's business, not the consumer's).
 */
export function readVerificationEnrollment(
  error: unknown
): VerificationEnrollment | null {
  // Both dialects, narrowed through the imported predicate (never through a
  // shape this call site invented): the typed error carries the parsed body,
  // a rethrown raw envelope IS the body.
  const body = asRecord(isStapelApiError(error) ? error.body : error);
  if (body === null) return null;
  const verification = asRecord(body["verification"]);
  if (verification === null) return null;
  if (verification["enroll"] !== true) return null;
  if (typeof verification["challenge_id"] === "string") return null;
  const factors = verification["factors"];
  return {
    scope:
      typeof verification["scope"] === "string"
        ? verification["scope"]
        : SENSITIVE_SCOPE,
    factors: Array.isArray(factors)
      ? factors.filter((f): f is string => typeof f === "string")
      : [],
  };
}
