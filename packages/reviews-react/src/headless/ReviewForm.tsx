import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability, FlowError } from "@stapel/core";
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
  /** The write failed with 401 — the form is offered to a signed-out reader. */
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

  const submitted = mutation.data ?? null;
  const failure = mutation.error ?? undefined;
  const duplicate = failure !== undefined && isDuplicateReview(failure);
  const forbidden = failure !== undefined && isReviewingForbidden(failure);
  const signInRequired = failure !== undefined && isSignInRequired(failure);
  const alreadyKnown = alreadyReviewed || duplicate;

  const canSubmit = firstBlock(
    alreadyKnown
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedDuplicate)
      : actionAvailable(),
    submitted !== null
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedSubmitted)
      : actionAvailable(),
    mutation.isPending
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedPending)
      : actionAvailable(),
    rating === null
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedNoRating)
      : actionAvailable(),
    forbidden
      ? actionBlocked(REVIEWS_I18N_KEYS.submitBlockedForbidden)
      : actionAvailable()
  );

  const submit = useCallback(() => {
    if (rating === null) return;
    mutate({ rating, ...(body.length > 0 ? { body } : {}) });
  }, [rating, body, mutate]);

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
        submitting: mutation.isPending,
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
