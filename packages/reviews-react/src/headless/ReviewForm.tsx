import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  firstBlock,
  matchMandate,
  useElevation,
  useMandate,
} from "@stapel/core";
import type { ActionAvailability, Elevation, FlowError } from "@stapel/core";
import type { Review, ReviewTarget } from "../api/types.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { useReviewsRuntime } from "../model/context.js";
import { useSubmitReview } from "../model/mutations.js";
import { reviewVisibility } from "../model/list.js";
import type { ReviewRatingBounds } from "../model/runtime.js";
import {
  isDuplicateReview,
  isReviewingForbidden,
  isSignInRequired,
  toReviewsError,
} from "../model/refusals.js";

/** What `<ReviewForm>` hands its render prop. */
export interface ReviewFormBag {
  /** The chosen rating, or `null` while nothing is chosen. */
  readonly rating: number | null;
  readonly setRating: (rating: number) => void;
  readonly body: string;
  readonly setBody: (body: string) => void;
  /** The deployment's inclusive bounds — the star row draws exactly these. */
  readonly bounds: ReviewRatingBounds;
  /** Send it. A no-op while {@link canSubmit} is blocked. */
  readonly submit: () => void;
  /** Whether the button may be pressed, and if not, the sentence saying why. */
  readonly canSubmit: ActionAvailability;
  readonly submitting: boolean;
  /**
   * The persisted review, once it exists. Its `status` is the whole point:
   * `published` means it is already on the page, `pending` means the
   * deployment pre-moderates and it is NOT — and the person who just wrote it
   * must be told that rather than left looking for it.
   */
  readonly submitted: Review | null;
  /** `submitted?.status`, narrowed, with a fourth arm for an unknown state. */
  readonly submittedVisibility: "published" | "pending" | "hidden" | "unknown" | null;
  /**
   * The server said this author has already reviewed this target
   * (`error.400.reviews_duplicate_review` — a 400, not a 409; see
   * `model/refusals.ts`). Or the host told us so up front via
   * `alreadyReviewed`.
   */
  readonly alreadyReviewed: boolean;
  /**
   * This visitor has no account a review can be attributed to.
   *
   * True BEFORE the click when the mandate axis says `guest`, or says
   * `anonymous` and the host has not listed
   * {@link REVIEWS_ELEVATION_ACTIONS.write} (which is every host that has not
   * also opened `ALLOW_ANONYMOUS_WRITES` upstream). True after the click when
   * the write comes back refused — a 401 for a visitor with
   * no session, or the module's 403
   * (`error.403.reviews_anonymous_not_allowed`) for a minted guest, which
   * `isSignInRequired` reads as the same refusal. The post-hoc arm is the net
   * under the up-front one: a mandate that resolves late, a host that never
   * wired the axis, a deployment that flips `ALLOW_ANONYMOUS_WRITES` while the
   * form is open.
   *
   * The LAST place this state survives. Since stapel-reviews 0.3.0 both reads
   * are anonymous (`IsAuthenticatedOrReadOnly` on the list class, `AllowAny`
   * on the aggregate), so a stranger reads the reviews and only the POST
   * refuses. That makes this a prompt to sign in at the moment it is actually
   * true, rather than a wall in front of content.
   */
  readonly signInRequired: boolean;
  /** The type's `can_review` callback refused this author for this target. */
  readonly forbidden: boolean;
  /**
   * The refusal, for the error surface — `undefined` once it has been
   * translated into one of the named flags above AND that flag is what the
   * skin renders. Duplicate/forbidden/sign-in are named states with their own
   * copy; everything else (an invalid rating the mirror let through, an
   * outage) stays here.
   */
  readonly error: FlowError | undefined;
}

export interface ReviewFormProps {
  readonly target: ReviewTarget;
  /**
   * The host already knows this author has reviewed the target — typically
   * from `findOwnReview()` over the loaded list. An OPTIMISTIC input: it
   * cannot see a pending review (the list is published-only), so a `false`
   * here never means "the server will accept this".
   */
  readonly alreadyReviewed?: boolean;
  readonly children: (bag: ReviewFormBag) => ReactNode;
}

/**
 * The name this pair's one gated write uses when asking core's elevation seam
 * whether an anonymous visitor may be given an identity instead of a refusal.
 *
 * **This is the client half of stapel-reviews' `ALLOW_ANONYMOUS_WRITES`, and
 * the two are joined by the HOST, not guessed by the pair.** The module's
 * switch decides whether a guest's `POST /reviews` is accepted; listing this
 * action decides whether the form is offered to one. A deployment that opens
 * the server switch lists this action too, and the two halves agree. A
 * deployment that lists nothing — every host today — keeps the wall on both
 * sides, which is the default that ships.
 *
 * Naming it is a real decision, not a formality: a review from an account
 * nobody can be traced to is weaker social proof and a wider abuse surface
 * than a favourite is. The pair has an opinion about that (the wall is the
 * default), but not the authority — that belongs to whoever runs the
 * marketplace, and it is already spelled once, in their settings.
 */
export const REVIEWS_ELEVATION_ACTIONS = {
  write: "reviews.write",
} as const;

/**
 * How the axis decides the review write.
 *
 * `"sign-in"` and `"asking"` are two different things and are never merged:
 * one is "you may not", the other is "we have not finished asking". The two
 * `unresolved` arms are why `matchMandate` demands five.
 */
type WriteMandate = "allowed" | "sign-in" | "asking";

/**
 * "Is there an account to attribute a review to?" — asked BEFORE the form is
 * offered, not after the POST.
 *
 * Every arm, and why it is what it is:
 *
 *  - `member` — write it.
 *  - `anonymous` — no identity, or one minted for a stranger (a mint leaves
 *    the axis at `anonymous` on purpose). The ONE arm elevation changes:
 *    where the host has listed {@link REVIEWS_ELEVATION_ACTIONS.write} the
 *    press mints an identity and writes, and everywhere else the wall stands
 *    and stapel-reviews' own `ALLOW_ANONYMOUS_WRITES` refuses the write with
 *    `error.403.reviews_anonymous_not_allowed`.
 *  - `guest` — a registered account holding no mandate. Not an elevation
 *    question: there is nothing to mint for somebody who already has an
 *    account, so the mandate axis alone decides, exactly as before.
 *  - `asking` — a WAIT. The control says "checking", not "you may not".
 *  - `unavailable` — we could not ask, so nothing changes: outside a
 *    `<MandateProvider>` core answers exactly this, and a host that never
 *    wired the axis must keep the form it has today. If the guess is wrong the
 *    module still refuses the POST, and `signInRequired` still says so.
 *
 * The elevation handle comes back with the verdict rather than being fetched
 * again by the caller: a caller that took the unblocked gate and forgot the
 * mint would send the write before the account exists and buy a 401.
 */
function useWriteGate(): {
  readonly mandate: WriteMandate;
  readonly elevation: Elevation;
} {
  const mandate = useMandate();
  const elevation = useElevation(REVIEWS_ELEVATION_ACTIONS.write);
  const verdict = matchMandate<WriteMandate>(mandate, {
    member: () => "allowed",
    guest: () => "sign-in",
    anonymous: () => (elevation.covers ? "allowed" : "sign-in"),
    asking: () => "asking",
    unavailable: () => "allowed",
  });
  return { mandate: verdict, elevation };
}

/**
 * The headless "rate this" form.
 *
 * The one rule it exists to hold: **the refusal is read by code, never by
 * status**. "You have already reviewed this" arrives as a 400 whose code is
 * `error.400.reviews_duplicate_review`, while the module's only 409 means the
 * owner's reply already exists. A form that branched on the number would miss
 * the first and mishandle the second.
 *
 * The second rule: a submitted review is not necessarily a visible one. The
 * bag reports the created row's `status` so a pre-moderated deployment can
 * say "sent — it will appear once it is checked", instead of leaving the
 * author to hunt for a review that is deliberately invisible.
 */
export function ReviewForm(props: ReviewFormProps): ReactElement {
  const { target, alreadyReviewed = false, children } = props;
  const runtime = useReviewsRuntime();
  const mutation = useSubmitReview(target);
  // Destructured because `mutation` is a new object every render while
  // `mutate` is stable (TanStack v5 contract) — depending on the object would
  // rebuild `submit` on every state change and re-render the whole render
  // prop below it.
  const { mutate } = mutation;
  const [rating, setRating] = useState<number | null>(null);
  const [body, setBody] = useState("");

  const { mandate: writeMandate, elevation } = useWriteGate();

  const submitted = mutation.data ?? null;
  // A failed MINT is a failed write from where the author stands, so it flows
  // through the same surface — and through the same predicates, which is what
  // keeps a 401 out of the generic red banner whichever call answered it.
  const failure = mutation.error ?? elevation.error ?? undefined;
  const duplicate = failure !== undefined && isDuplicateReview(failure);
  const forbidden = failure !== undefined && isReviewingForbidden(failure);
  // Up front from the axis, or after the fact from the refusal — one state, so
  // the skin has one door to draw and the visitor one sentence to read.
  const signInRequired =
    writeMandate === "sign-in" ||
    (failure !== undefined && isSignInRequired(failure));
  const alreadyKnown = alreadyReviewed || duplicate;

  const canSubmit = firstBlock(
    // First, because they are about the PERSON and not about what is typed:
    // "sign in" and "checking" must not be shadowed by "choose a rating".
    signInRequired
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedSignIn)
      : actionAvailable(),
    writeMandate === "asking"
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedMandateUnknown)
      : actionAvailable(),
    alreadyKnown
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedDuplicate)
      : actionAvailable(),
    submitted !== null
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedSubmitted)
      : actionAvailable(),
    // The mint counts as "sending": it is the first half of the same press.
    mutation.isPending || elevation.pending
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedPending)
      : actionAvailable(),
    rating === null
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedNoRating)
      : actionAvailable(),
    forbidden
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedForbidden)
      : actionAvailable()
  );

  // Honours its own gate rather than only the rating: a blocked control that
  // still fires is how a refused visitor's review reaches the wire anyway.
  // Depends on the BOOLEAN, not on the gate object, which is fresh each render.
  const gateOpen = canSubmit.available;
  const { run: elevateThen } = elevation;
  const submit = useCallback(() => {
    if (!gateOpen || rating === null) return;
    // Mints the anonymous account FIRST where the host listed this action, and
    // performs directly everywhere else. The order is the point: a review that
    // overtakes its own account buys the 401 the gate just avoided, and a mint
    // that fails never reaches the write.
    elevateThen(() => mutate({ rating, ...(body.length > 0 ? { body } : {}) }));
  }, [gateOpen, rating, body, mutate, elevateThen]);

  return (
    <>
      {children({
        rating,
        setRating,
        body,
        setBody,
        bounds: runtime.ratingBounds,
        submit,
        canSubmit,
        submitting: mutation.isPending || elevation.pending,
        submitted,
        submittedVisibility:
          submitted === null ? null : reviewVisibility(submitted.status),
        alreadyReviewed: alreadyKnown,
        signInRequired,
        forbidden,
        error:
          failure === undefined || duplicate || forbidden || signInRequired
            ? undefined
            : toReviewsError(failure),
      })}
    </>
  );
}
