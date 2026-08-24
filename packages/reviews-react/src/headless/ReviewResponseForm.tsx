import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability, FlowError } from "@stapel/core";
import type { Review, ReviewOwnerResponse, ReviewTarget } from "../api/types.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { useRespondToReview } from "../model/mutations.js";
import {
  isAlreadyResponded,
  isModerationForbidden,
  isResponseNotAllowed,
  isReviewGone,
  isSignInRequired,
  toReviewsError,
} from "../model/refusals.js";

/** What `<ReviewResponseForm>` hands its render prop, for ONE review. */
export interface ReviewResponseBag {
  readonly review: Review;
  readonly body: string;
  readonly setBody: (body: string) => void;
  /** Send it. A no-op while {@link canSubmit} is blocked. */
  readonly submit: () => void;
  readonly canSubmit: ActionAvailability;
  readonly submitting: boolean;
  /**
   * The reply as it now stands: the one loaded with the review, or the one
   * just written. `null` means the review has none — which, for a viewer who
   * may write it, is the only state where the composer is worth showing.
   */
  readonly response: ReviewOwnerResponse | null;
  /** This reply was written HERE, just now (as opposed to loaded with the row). */
  readonly justSent: boolean;
  /**
   * The review already has a reply — from the loaded row, or from the module's
   * ONLY 409 (`error.409.reviews_already_responded`) when two tabs raced.
   */
  readonly alreadyResponded: boolean;
  /** Replies are switched off for this target type (`allow_response: false`). */
  readonly notAllowed: boolean;
  /** The server refused the actor as the owner (the fail-closed 403). */
  readonly forbidden: boolean;
  /** The write answered 401 — a reply needs an author to attribute it to. */
  readonly signInRequired: boolean;
  /** The review is gone (404). */
  readonly gone: boolean;
  /** Anything the named states above do not cover. */
  readonly error: FlowError | undefined;
}

export interface ReviewResponseFormProps {
  /** The target, for cache invalidation. */
  readonly target: ReviewTarget;
  readonly review: Review;
  /**
   * Does the HOST believe this viewer owns the reviewed item? Same contract as
   * `canModerate` — the server decides (and refuses with the same fail-closed
   * 403, because a reply uses the moderation gate), and absent/`false` blocks
   * the control WITH its reason rather than removing it.
   */
  readonly canRespond?: boolean;
  readonly children: (bag: ReviewResponseBag) => ReactNode;
}

/**
 * The headless owner's reply — `POST {id}/response`.
 *
 * ── One reply, forever, and the composer says so up front ──────────────────
 *
 * The module stores at most one `Response` per review and there is no endpoint
 * to edit or delete it: the second attempt is `error.409.reviews_already_
 * responded`. A composer that discovered this AFTERWARDS would be a text box
 * that silently turns out to have been the last word — so `canSubmit` is
 * blocked the moment a reply exists, and the skin states the one-shot rule
 * beside the box while it is still empty.
 *
 * ── An empty reply is blocked here, not upstream ───────────────────────────
 *
 * `RespondRequest.body` defaults to `""`, so the server would happily store a
 * blank reply and then refuse forever to replace it — the worst possible
 * outcome of a stray Enter. That is the one rule this form adds to the
 * contract rather than mirroring from it.
 */
export function ReviewResponseForm(
  props: ReviewResponseFormProps
): ReactElement {
  const { target, review, canRespond = false, children } = props;
  const mutation = useRespondToReview(target);
  const { mutate } = mutation;
  const [body, setBody] = useState("");

  const failure = mutation.error ?? undefined;
  const conflicted = failure !== undefined && isAlreadyResponded(failure);
  const notAllowed = failure !== undefined && isResponseNotAllowed(failure);
  const forbidden = failure !== undefined && isModerationForbidden(failure);
  const signInRequired = failure !== undefined && isSignInRequired(failure);
  const gone = failure !== undefined && isReviewGone(failure);

  // The server's answer carries the whole review, reply included; before it
  // arrives the loaded row is the authority.
  const sent = mutation.data ?? null;
  const response = sent?.response ?? review.response ?? null;
  const alreadyResponded = response !== null || conflicted;

  const canSubmit = firstBlock(
    canRespond
      ? actionAvailable()
      : actionBlocked(REVIEWS_I18N_KEYS.respondBlockedNotOwner),
    alreadyResponded
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedAlready)
      : actionAvailable(),
    notAllowed
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedNotAllowed)
      : actionAvailable(),
    signInRequired
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedSignIn)
      : actionAvailable(),
    forbidden
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedForbidden)
      : actionAvailable(),
    gone ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedGone) : actionAvailable(),
    mutation.isPending
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedPending)
      : actionAvailable(),
    body.trim().length === 0
      ? actionBlocked(REVIEWS_I18N_KEYS.respondBlockedEmpty)
      : actionAvailable()
  );

  const submit = useCallback(() => {
    const text = body.trim();
    if (text.length === 0) return;
    mutate({ reviewId: review.id, body: text });
  }, [body, mutate, review.id]);

  return (
    <>
      {children({
        review: sent ?? review,
        body,
        setBody,
        submit,
        canSubmit,
        submitting: mutation.isPending,
        response,
        justSent: sent !== null,
        alreadyResponded,
        notAllowed,
        forbidden,
        signInRequired,
        gone,
        error:
          failure === undefined ||
          conflicted ||
          notAllowed ||
          forbidden ||
          signInRequired ||
          gone
            ? undefined
            : toReviewsError(failure),
      })}
    </>
  );
}
