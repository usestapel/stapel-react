/**
 * Step-up verification (the flagship cross-module flow, frontend-standard §2):
 * a 403 whose body carries a `verification` object is a challenge, not a
 * terminal error. `@stapel/core` hands the challenge to a configurable
 * handler (implemented by `@stapel/auth-react`'s factor machines or the
 * host) and retries the original request once on success.
 */
export interface VerificationChallenge {
  readonly challenge_id: string;
  /** What the challenge protects, e.g. `"billing.payout"`. */
  readonly scope?: string;
  /** Factors the user may satisfy, e.g. `["totp", "webauthn"]`. */
  readonly factors?: readonly string[];
  /** Backends may attach extra fields; kept for forward-compat. */
  readonly [extra: string]: unknown;
}

export interface VerificationOutcome {
  /** Retry the original request? */
  readonly retry: boolean;
  /** Sent as `X-Verification-Token` on the retry when present. */
  readonly token?: string;
}

export type VerificationChallengeHandler = (
  challenge: VerificationChallenge
) => Promise<VerificationOutcome>;

/** Header carrying the verification proof on retried requests. */
export const VERIFICATION_TOKEN_HEADER = "X-Verification-Token";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extract a verification challenge from a 403 response body, or `null` when
 * the body is a plain error envelope.
 */
export function extractVerificationChallenge(
  body: unknown
): VerificationChallenge | null {
  if (!isRecord(body)) return null;
  const verification = body["verification"];
  if (!isRecord(verification)) return null;
  if (typeof verification["challenge_id"] !== "string") return null;
  return verification as unknown as VerificationChallenge;
}
