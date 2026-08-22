import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createReviewsApi } from "../api/reviewsApi.js";
import type { ReviewsApi } from "../api/reviewsApi.js";

/**
 * Inclusive rating bounds. These mirror `STAPEL_REVIEWS["RATING_MIN"]` /
 * `["RATING_MAX"]`, whose library defaults are 1 and 5 — and they are
 * OVERRIDABLE here for the same reason cdn-react's size ceilings are: they
 * are deployment knobs, not constants, and a hardwired client would refuse a
 * rating the server would have accepted (a 1..10 deployment) or offer one it
 * would refuse (a 1..3 one).
 *
 * There is no endpoint that reports them, so a host that moves the knob tells
 * this pair too. The mirror is a UI affordance only: the star row draws
 * `max - min + 1` choices, and the server remains the authority
 * (`error.400.reviews_invalid_rating`).
 */
export interface ReviewRatingBounds {
  readonly min: number;
  readonly max: number;
}

/** stapel-reviews' own defaults (`conf.DEFAULTS`). */
export const DEFAULT_RATING_BOUNDS: ReviewRatingBounds = { min: 1, max: 5 };

/**
 * The wired reviews runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2), plus the deployment's rating bounds. The returned
 * `client` is what the host injects into core's `StapelConfigProvider` (as the
 * default or the `"reviews"` module client), preserving the client-injection
 * fork seam (frontend-standard §7.2).
 *
 * MEMBER-ONLY, AND THE PAIR SAYS SO. Unlike categories-react, every endpoint
 * behind this runtime is `IsAuthenticated` — a signed-out visitor gets 401 on
 * the review list and on the aggregate. The read hooks are therefore gated on
 * `useActiveSessionReady()` (so a bootstrapping session is not mistaken for an
 * anonymous one) and the 401 is surfaced as a named "sign in to see reviews"
 * state instead of an empty list.
 */
export type ReviewsRuntime = ModuleRuntime<ReviewsApi> & {
  readonly ratingBounds: ReviewRatingBounds;
};

export interface CreateReviewsRuntimeOptions extends CreateModuleRuntimeOptions {
  /** Mirror of the deployment's `RATING_MIN`/`RATING_MAX`. Defaults to 1..5. */
  readonly ratingBounds?: Partial<ReviewRatingBounds>;
}

export function createReviewsRuntime(
  options: CreateReviewsRuntimeOptions
): ReviewsRuntime {
  const runtime = createModuleRuntime(createReviewsApi, options);
  return {
    ...runtime,
    ratingBounds: {
      min: options.ratingBounds?.min ?? DEFAULT_RATING_BOUNDS.min,
      max: options.ratingBounds?.max ?? DEFAULT_RATING_BOUNDS.max,
    },
  };
}
