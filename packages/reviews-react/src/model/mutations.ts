import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UseMutationOptions, UseMutationResult } from "@tanstack/react-query";
import type { StapelApiError } from "@stapel/core";
import type { Review, ReviewTarget } from "../api/types.js";
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
