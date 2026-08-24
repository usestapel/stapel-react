import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type {
  Review,
  ReviewModerationAction,
  ReviewTarget,
} from "../api/types.js";
import { useReviewsApi } from "./context.js";
import { reviewsQueryKeys } from "./queryKeys.js";

/** What {@link useSubmitReview} is called with. */
export interface SubmitReviewVariables {
  /** Inside the deployment's `[RATING_MIN, RATING_MAX]`; the server decides. */
  readonly rating: number;
  /** Optional — a rating with no words is a complete review here. */
  readonly body?: string;
}

/**
 * Write a review of a target (frontend-standard §2 — mutations invalidate on
 * success).
 *
 * ── Why the answer is invalidated rather than spliced in ───────────────────
 *
 * The created row comes back with its `status`, and under the module's
 * default (`MODERATION_DEFAULT: "post"`) that is `published` — so pushing it
 * into the cached window would be correct. Under `moderation: "pre"` it is
 * `pending`, and the SAME row must NOT appear in the list, because the list
 * this reader sees is published-only and a locally-spliced pending review
 * would vanish on the next refetch with no explanation.
 *
 * One behaviour for both policies, and the policy is not visible to the
 * client (no endpoint reports it): invalidate, let the server say what is
 * visible, and carry the created row separately as the SUBMISSION's outcome
 * (`headless/ReviewForm.tsx` renders "sent, awaiting moderation" off its
 * `status`). The aggregate moves for the same reason and is invalidated with
 * it — `avg` and `count` only count published rows.
 */
export function useSubmitReview(
  target: ReviewTarget
): UseMutationResult<Review, StapelApiError, SubmitReviewVariables> {
  const api = useReviewsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Review,
    StapelApiError,
    SubmitReviewVariables
  > = {
    mutationFn: (vars) =>
      api.createReview({
        targetType: target.targetType,
        targetKey: target.targetKey,
        rating: vars.rating,
        ...(vars.body !== undefined ? { body: vars.body } : {}),
      }),
    onSuccess: () => {
      // Both scopes of the list: a moderator's `include=all` window holds the
      // pending row this write may just have created.
      void queryClient.invalidateQueries({
        queryKey: reviewsQueryKeys.target(target),
      });
    },
  };
  return useMutation(options);
}

/** What {@link useModerateReview} is called with. */
export interface ModerateReviewVariables {
  readonly reviewId: string;
  readonly action: ReviewModerationAction;
  /** Rides into the emitted moderation fact; never shown to a reader. */
  readonly reason?: string;
}

/**
 * Hide or publish one review.
 *
 * ── Why the whole target is invalidated, not just the queue ────────────────
 *
 * Hiding a review takes it out of the AGGREGATE as well as out of the public
 * list: `avg` and `count` are computed over published rows, so a moderator who
 * hid a one-star review and watched the rating stay at 4.1 would be looking at
 * a stale number and would reasonably conclude the verdict did not land.
 * Publishing a pending row does the same in reverse. One invalidation of
 * `reviewsQueryKeys.target()` covers the published window, the `include=all`
 * window and the aggregate — the three reads that the verdict moved.
 *
 * The answer carries the review as it now stands, so the caller reports the
 * resulting status instead of assuming its own verdict took (re-applying a
 * state the review is already in is an upstream no-op, and the returned row is
 * how a client learns that).
 */
export function useModerateReview(
  target: ReviewTarget
): UseMutationResult<Review, StapelApiError, ModerateReviewVariables> {
  const api = useReviewsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Review,
    StapelApiError,
    ModerateReviewVariables
  > = {
    mutationFn: (vars) =>
      api.moderate(vars.reviewId, {
        action: vars.action,
        ...(vars.reason !== undefined ? { reason: vars.reason } : {}),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reviewsQueryKeys.target(target),
      });
    },
  };
  return useMutation(options);
}

/** What {@link useRespondToReview} is called with. */
export interface RespondToReviewVariables {
  readonly reviewId: string;
  /** The reply text. There is exactly one per review, forever. */
  readonly body: string;
}

/**
 * Write the target owner's single reply to a review.
 *
 * Invalidates the target rather than splicing the reply into the cached row,
 * for the reason the review submit gives: the server's copy of the row is the
 * one that carries `response.created_at` and `response.author_id`, and a
 * locally-assembled reply would differ from it in exactly the fields a second
 * reader sees. The mutation's own `data` is the review WITH its reply, so the
 * composer can show what it just published without waiting for the refetch.
 *
 * The aggregate does not move here — a reply is not a rating — but it rides
 * along in the same invalidation because splitting it would buy one skipped
 * request and a second code path.
 */
export function useRespondToReview(
  target: ReviewTarget
): UseMutationResult<Review, StapelApiError, RespondToReviewVariables> {
  const api = useReviewsApi();
  const queryClient = useQueryClient();
  const options: UseMutationOptions<
    Review,
    StapelApiError,
    RespondToReviewVariables
  > = {
    mutationFn: (vars) => api.respond(vars.reviewId, { body: vars.body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: reviewsQueryKeys.target(target),
      });
    },
  };
  return useMutation(options);
}
