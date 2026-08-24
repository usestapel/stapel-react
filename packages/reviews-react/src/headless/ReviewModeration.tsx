import { useCallback, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { actionAvailable, actionBlocked, firstBlock } from "@stapel/core";
import type { ActionAvailability, FlowError } from "@stapel/core";
import type {
  Review,
  ReviewModerationAction,
  ReviewStatus,
  ReviewTarget,
} from "../api/types.js";
import { REVIEWS_I18N_KEYS } from "../i18n/keys.js";
import { reviewVisibility } from "../model/list.js";
import { useModerateReview } from "../model/mutations.js";
import {
  isModerationForbidden,
  isReviewGone,
  isSignInRequired,
  toReviewsError,
} from "../model/refusals.js";

/** What `<ReviewModeration>` hands its render prop, for ONE review. */
export interface ReviewModerationBag {
  readonly review: Review;
  /**
   * Where the row stands NOW — after a verdict has landed, this is the status
   * the server answered with, not the one the row was loaded at. A moderator
   * who hides a review sees the badge change without waiting for the list to
   * refetch.
   */
  readonly visibility: ReviewStatus | "unknown";
  /**
   * The moderator's note. Never rendered to a reader or to the author: it
   * rides into the emitted moderation fact, which is where an audit reads it.
   */
  readonly reason: string;
  readonly setReason: (reason: string) => void;
  /** Take the review off the page and out of the rating. */
  readonly hide: () => void;
  /** Put it back. */
  readonly publish: () => void;
  /**
   * Whether each verdict may be pressed, and if not, the sentence saying why.
   * A verdict that would be a no-op upstream (hiding a hidden row) is blocked
   * HERE rather than sent and silently ignored — the round trip would answer
   * 200 and change nothing, which reads as a broken button.
   */
  readonly canHide: ActionAvailability;
  readonly canPublish: ActionAvailability;
  readonly moderating: boolean;
  /** The verdict that landed, once one has. */
  readonly settled: ReviewModerationAction | null;
  /**
   * The server refused the actor as a moderator
   * (`error.403.reviews_cannot_moderate`). Also what a target type with NO
   * `can_moderate` callback answers, because the gate is fail-closed — so this
   * is as much "moderation is not wired up here" as "not you".
   */
  readonly forbidden: boolean;
  /** The review is gone (404) — deleted or erased since the list was read. */
  readonly gone: boolean;
  /** The write answered 401: a verdict needs an identity to attribute it to. */
  readonly signInRequired: boolean;
  /**
   * The refusal, for the error surface — `undefined` once it has become one of
   * the named flags above. An unknown verdict
   * (`error.400.reviews_invalid_moderation_action`) deliberately stays HERE:
   * it means this build and the server disagree about what verdicts exist, and
   * that is not something to translate into a friendly sentence.
   */
  readonly error: FlowError | undefined;
}

export interface ReviewModerationProps {
  /** The target, for cache invalidation — a verdict moves the aggregate. */
  readonly target: ReviewTarget;
  readonly review: Review;
  /**
   * Does the HOST believe this viewer moderates this target? The server is
   * still the authority (the callback is fail-closed and answers 403), but a
   * client that offered the verdict to every reader would be offering an
   * action that is refused for almost everyone. Absent/`false` blocks both
   * verdicts WITH a reason rather than hiding them: a moderator whose callback
   * is mis-wired needs to see that the control exists and why it is off.
   */
  readonly canModerate?: boolean;
  readonly children: (bag: ReviewModerationBag) => ReactNode;
}

/**
 * The headless moderator verdict over one review — `POST {id}/moderate`.
 *
 * ── Why the two verdicts are two gates and not one toggle ──────────────────
 *
 * `hide` and `publish` are not each other's opposite from the client's side.
 * A row can be in three states, and `pending` is neither hidden nor published:
 * from there BOTH verdicts are meaningful, and a toggle would have to pick one
 * to show. So each verdict carries its own availability, and the arithmetic
 * that decides them is stated once here instead of in every console that
 * renders a queue.
 *
 * ── Why re-applying a state is blocked rather than sent ────────────────────
 *
 * `services.moderate_review` short-circuits when the status already matches:
 * no fact, no change, 200 OK. A button that sends that answers instantly and
 * does nothing, which is indistinguishable from a broken one. The block
 * ("Already hidden") is the same fact, said before the click.
 */
export function ReviewModeration(props: ReviewModerationProps): ReactElement {
  const { target, review, canModerate = false, children } = props;
  const mutation = useModerateReview(target);
  // `mutate` is stable across renders (TanStack v5); `mutation` is not.
  const { mutate } = mutation;
  const [reason, setReason] = useState("");
  const [settled, setSettled] = useState<ReviewModerationAction | null>(null);

  const failure = mutation.error ?? undefined;
  const forbidden = failure !== undefined && isModerationForbidden(failure);
  const gone = failure !== undefined && isReviewGone(failure);
  const signInRequired = failure !== undefined && isSignInRequired(failure);
  // Deliberately NOT folded into a named flag: an unknown verdict means this
  // build and the server disagree about what verdicts exist, and the raw
  // refusal is the more useful thing to show.
  const named = forbidden || gone || signInRequired;

  // The row as it now stands: the server's answer wins over the loaded copy.
  const current = mutation.data ?? review;
  const visibility = reviewVisibility(current.status);

  const common = firstBlock(
    canModerate
      ? actionAvailable()
      : actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedNotModerator),
    signInRequired
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedSignIn)
      : actionAvailable(),
    forbidden
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedForbidden)
      : actionAvailable(),
    gone
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedGone)
      : actionAvailable(),
    mutation.isPending
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedPending)
      : actionAvailable()
  );

  const canHide = firstBlock(
    common,
    visibility === "hidden"
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedAlreadyHidden)
      : actionAvailable()
  );
  const canPublish = firstBlock(
    common,
    visibility === "published"
      ? actionBlocked(REVIEWS_I18N_KEYS.moderateBlockedAlreadyPublished)
      : actionAvailable()
  );

  const send = useCallback(
    (action: ReviewModerationAction) => {
      mutate(
        {
          reviewId: review.id,
          action,
          ...(reason.length > 0 ? { reason } : {}),
        },
        { onSuccess: () => setSettled(action) }
      );
    },
    [mutate, review.id, reason]
  );
  const hide = useCallback(() => {
    if (!canHide.available) return;
    send("hide");
  }, [canHide.available, send]);
  const publish = useCallback(() => {
    if (!canPublish.available) return;
    send("publish");
  }, [canPublish.available, send]);

  return (
    <>
      {children({
        review: current,
        visibility,
        reason,
        setReason,
        hide,
        publish,
        canHide,
        canPublish,
        moderating: mutation.isPending,
        settled,
        forbidden,
        gone,
        signInRequired,
        error:
          failure === undefined || named ? undefined : toReviewsError(failure),
      })}
    </>
  );
}
