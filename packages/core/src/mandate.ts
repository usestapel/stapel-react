/**
 * The mandate axis — the third principal state, on the frontend.
 *
 * stapel-core 0.27 made the backend's principal vocabulary three-valued:
 * ANONYMOUS (no identity that could hold anything), GUEST (a real account
 * holding no active membership anywhere), MEMBER (holds a mandate). The
 * frontend had one bit — "authenticated" — so a guest was rendered every
 * module's nav entry and mounted every screen, each of which then answered
 * 403. That is the "controls that lead to a refusal" defect at library level:
 * the door is drawn, the person walks to it, the door says no.
 *
 * ── The fourth value, and why it is not a principal ────────────────────────
 *
 * The question "does this person hold a mandate?" can fail to be answered:
 * the list that carries the answer is still in flight, or the backend is
 * mid-redeploy and answers 502, or the workspaces module is unreachable and
 * its consumer helper raises `WorkspaceLookupUnavailable`. `"unresolved"` is
 * that outcome, and it is deliberately NOT a member of
 * {@link MandatePrincipal}: there is no way to spell "we could not ask, so
 * treat them as barred".
 *
 * **"We could not ask" must never render as "you may not."** A wait is a
 * wait and an outage is an explained error; neither is a refusal, and
 * neither is a silent hide. This is the frontend projection of the backend
 * canon that an unavailable authority answers 503 rather than deny (see
 * `stapel_core.django.workspaces`' `WorkspaceLookupUnavailable`, and
 * `isAuthVerdict` in `@stapel/auth-react`).
 *
 * The type enforces it three ways, none of them a comment:
 *
 *  1. `unresolved` carries no principal, so nothing can read a verdict off it.
 *  2. It carries a REASON — `"asking"` (wait) or `"unavailable"` (explain) —
 *     so a host cannot render one as the other either.
 *  3. {@link matchMandate} takes five REQUIRED arms. Letting "asking" fall
 *     into the same branch as "anonymous" by omission does not compile.
 *
 * Anything that consumes the axis as an authorization input (today:
 * `resolveNav`'s audience in `@stapel/shell-react`) takes a
 * {@link MandatePrincipal}, never a `MandateState` — so a caller must narrow
 * past `unresolved`, at which point handling it is unavoidable.
 */

/**
 * A principal whose mandate is KNOWN.
 *
 * `"anonymous"` covers both an anonymous session (a real user row with
 * `is_anonymous`, minted for the street) and no session at all: neither
 * carries an identity that could hold a membership, and the surfaces open to
 * them are the same. `"guest"` is the state that is easy to miss — a
 * registered, signed-in, entirely mandate-less account.
 */
export type MandatePrincipal = "anonymous" | "guest" | "member";

/** Why the mandate is not known. `"asking"` is a wait; `"unavailable"` is an
 * error with something to say. Neither is a verdict. */
export type MandateUnresolvedReason = "asking" | "unavailable";

/** The mandate was obtained. */
export interface MandateResolved {
  readonly mandate: MandatePrincipal;
}

/** The answer is still in flight (including a request not yet allowed to
 * start — a session still bootstrapping). Renders as a wait. */
export interface MandateAsking {
  readonly mandate: "unresolved";
  readonly reason: "asking";
}

/** The answer could not be obtained. Renders as an explained error — the
 * thrown value travels so the host can render it through the same error
 * dialect as everything else (`toStapelApiError` / `useErrorText`). */
export interface MandateUnavailable {
  readonly mandate: "unresolved";
  readonly reason: "unavailable";
  readonly error: unknown;
}

/** The mandate axis as a discriminated union. */
export type MandateState = MandateResolved | MandateAsking | MandateUnavailable;

const ASKING: MandateAsking = { mandate: "unresolved", reason: "asking" };

/** A known principal. */
export function mandateResolved(principal: MandatePrincipal): MandateResolved {
  return { mandate: principal };
}

/** Still asking (a shared frozen singleton — it carries nothing). */
export function mandateAsking(): MandateAsking {
  return ASKING;
}

/** Could not ask, carrying the thrown value verbatim. */
export function mandateUnavailable(error: unknown): MandateUnavailable {
  return { mandate: "unresolved", reason: "unavailable", error };
}

/** Narrow to a known principal. The gate every caller that needs a verdict
 * has to pass, which is why it exists rather than a `state.mandate !==
 * "unresolved"` written out at each call site. */
export function isMandateResolved(state: MandateState): state is MandateResolved {
  return state.mandate !== "unresolved";
}

/**
 * Exhaustive render for a {@link MandateState}. All FIVE arms are required —
 * that is the mechanism, not an inconvenience: the two unresolved arms cannot
 * be quietly merged into a principal's branch, so a screen cannot tell a
 * person "you may not" when the truth is "we could not ask".
 */
export function matchMandate<R>(
  state: MandateState,
  arms: {
    anonymous: () => R;
    guest: () => R;
    member: () => R;
    asking: () => R;
    unavailable: (error: unknown) => R;
  }
): R {
  switch (state.mandate) {
    case "anonymous":
      return arms.anonymous();
    case "guest":
      return arms.guest();
    case "member":
      return arms.member();
    case "unresolved":
      return state.reason === "asking" ? arms.asking() : arms.unavailable(state.error);
  }
}
