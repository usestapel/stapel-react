import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Review,
  ReviewAggregate,
  ReviewListParams,
  ReviewModerationAction,
  ReviewPage,
  ReviewTarget,
} from "./types.js";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors auth-react and
 * chat-react): the simplest SPA rule is to always send
 * `X-Requested-With: XMLHttpRequest` on mutating requests. Header-token
 * clients ignore it, so it is harmless there and every mutation carries it.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(
  options?: Omit<StapelRequestOptions, "method" | "body">
): Omit<StapelRequestOptions, "method" | "body"> {
  return { ...options, headers: { ...CSRF_HEADERS, ...options?.headers } };
}

/** The target pair, as the two endpoints that read it spell it. */
function targetQuery(target: ReviewTarget): Record<string, string> {
  return { target_type: target.targetType, target_key: target.targetKey };
}

/**
 * The pair's typed operation surface — one method per stapel-reviews endpoint
 * a buyer's or a seller's browser may call, bound to the injected
 * {@link StapelClient} (the per-module override seam of frontend-standard
 * §7.2). Paths are relative to the runtime's `baseUrl` (`/reviews/api/v1`).
 *
 * ── The two reads are ANONYMOUS; the write is not ─────────────────────────
 *
 * Since stapel-reviews 0.3.0: `ReviewListCreateView` is
 * `IsAuthenticatedOrReadOnly` (GET open, POST still needs a real identity —
 * there is an author to attribute the review to) and `AggregateView` is
 * `AllowAny`. Both declare `stapel_anonymous_access = ANONYMOUS_ALLOWED` and
 * both are throttled from the module's own settings namespace
 * (`LIST_THROTTLE` 120/min, `AGGREGATE_THROTTLE` 300/min), not the project's
 * `DEFAULT_THROTTLE_RATES`.
 *
 * Nothing new became visible: both endpoints were already published-only for
 * a non-moderator. What changed for this pair is that a guest on a public
 * listing page now READS the reviews instead of being told to sign in — so
 * `signInRequired` is gone from the two read bags and survives only on the
 * write, where a 401 is still the honest answer.
 *
 * ── The two write operations a CONSOLE reaches ────────────────────────────
 *
 * `POST /reviews/{id}/moderate` (hide/publish) and `POST /reviews/{id}/response`
 * (the target owner's single reply) are both gated on the target type's
 * `can_moderate` callback, which is **fail-closed**: a type that names no
 * callback denies everyone (`registry.check_can_moderate`). This pair used to
 * omit them on the grounds that they belong to consoles it does not ship — and
 * the consequence was that stapel-reviews' moderation queue and the seller's
 * single reply were backend-only capabilities with no user-reachable surface
 * anywhere in the fleet.
 *
 * They are here now, and the fail-closed callback is exactly why they can be:
 * the SERVER is the authority on who may call them, so a client that offers
 * the control to somebody it should not costs a 403, not a leak. What the
 * client owes is the other half — the control must not be offered blindly.
 * Both surfaces take an explicit capability flag from the host
 * (`canModerate` / `canRespond`), and where it is off the control is rendered
 * switched off WITH its reason beside it rather than omitted, so a seller
 * looking at a review can see that a reply exists as a concept and why this
 * one is not theirs to write.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2; until then they are hand-authored here (the ONE legal home of path
 * strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface ReviewsApi {
  readonly client: StapelClient;

  /**
   * A page of a target's reviews, newest first. Anonymous callers welcome.
   *
   * Answers core's `AnchorPagination` envelope — declared as
   * `components/ReviewPage` since 0.3.0, so the shape is generated rather
   * than mirrored here. Anchors are `created_at` timestamps.
   */
  reviews(
    params: ReviewListParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ReviewPage>;

  /**
   * The module-owned rating aggregate for ONE target — mean and count over
   * published reviews. `AllowAny`.
   *
   * There is no batch form on the HTTP surface: `reviews.aggregates_by_keys`
   * is a comm Function for server-side projections, not an endpoint. A
   * storefront that needs a rating per card gets it from the listing rows its
   * own module serves (fed by the composite's projection), not by firing one
   * of these per card.
   */
  aggregate(
    target: ReviewTarget,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ReviewAggregate>;

  /**
   * Write a review of a target. The one operation here that needs a real
   * identity (`IsAuthenticatedOrReadOnly` refuses an anonymous POST).
   *
   * Refusals worth knowing by name, because their STATUS is not what a reader
   * expects: "you have already reviewed this" is
   * `error.400.reviews_duplicate_review` — a **400**, while the module's only
   * 409 (`error.409.reviews_already_responded`) is about the owner's reply.
   * Branching on the status code would therefore catch the wrong refusal;
   * `model/submit.ts` branches on the code.
   */
  createReview(
    body: {
      readonly targetType: string;
      readonly targetKey: string;
      readonly rating: number;
      readonly body?: string;
    },
    options?: { readonly signal?: AbortSignal }
  ): Promise<Review>;

  /**
   * Hide or publish one review — the moderator verdict. Answers the review as
   * it now stands (200), so the caller never has to guess the resulting
   * status.
   *
   * `reason` is not shown to anyone: it rides into the emitted visibility fact
   * (`services.moderate_review` → `_emit_review_fact`), which is where an
   * audit reads it. Re-applying the state a review is already in is a no-op
   * upstream — no fact, no change — so an idempotent retry is safe.
   *
   * Refusals: `error.403.reviews_cannot_moderate` when the type's callback
   * says no (and when the type names no callback at all — it is fail-closed),
   * `error.400.reviews_invalid_moderation_action` for anything but the two
   * verdicts, `error.404.reviews_review_not_found` for an id that is gone.
   */
  moderate(
    reviewId: string,
    body: {
      readonly action: ReviewModerationAction;
      /** Carried into the moderation fact, never rendered to a reader. */
      readonly reason?: string;
    },
    options?: { readonly signal?: AbortSignal }
  ): Promise<Review>;

  /**
   * Attach the target owner's single reply to a review. Answers the review
   * WITH its reply (201), which is why the caller gets a `response` object
   * back rather than having to re-read the list to see what it wrote.
   *
   * "Single" is enforced upstream and is the module's ONLY 409
   * (`error.409.reviews_already_responded`) — the one refusal whose status
   * reads the way a naive client expects, in a module where the duplicate
   * REVIEW is a 400. A deployment may also switch replies off per target type
   * (`allow_response`), which is `error.400.reviews_response_not_allowed`, and
   * the ownership gate is the same fail-closed `can_moderate` callback
   * moderation uses — so the seller's reply and the moderator's verdict are
   * refused with the same 403 code.
   */
  respond(
    reviewId: string,
    body: { readonly body: string },
    options?: { readonly signal?: AbortSignal }
  ): Promise<Review>;
}

const signalOf = (options?: {
  readonly signal?: AbortSignal;
}): { signal?: AbortSignal } =>
  options?.signal !== undefined ? { signal: options.signal } : {};

export function createReviewsApi(client: StapelClient): ReviewsApi {
  return {
    client,

    reviews: (params, options) =>
      client.get("/reviews", {
        query: {
          ...targetQuery(params),
          ...(params.include !== undefined ? { include: params.include } : {}),
          ...(params.anchor !== undefined ? { anchor: params.anchor } : {}),
          ...(params.direction !== undefined
            ? { direction: params.direction }
            : {}),
          ...(params.limit !== undefined ? { limit: params.limit } : {}),
        },
        ...signalOf(options),
      }),

    aggregate: (target, options) =>
      client.get("/reviews/aggregate", {
        query: targetQuery(target),
        ...signalOf(options),
      }),

    createReview: (body, options) =>
      client.post(
        "/reviews",
        {
          target_type: body.targetType,
          target_key: body.targetKey,
          rating: body.rating,
          // The body defaults to `""` in the request DTO
          // (`dto.ReviewCreateRequest.body: str = ""`) — a rating with no
          // words is a complete review here. Send the field only when there
          // is text, so an empty textarea is not spelled two ways.
          ...(body.body !== undefined && body.body.length > 0
            ? { body: body.body }
            : {}),
        },
        mutating(signalOf(options))
      ),

    moderate: (reviewId, body, options) =>
      client.post(
        `/reviews/${encodeURIComponent(reviewId)}/moderate`,
        {
          action: body.action,
          // `reason` defaults to `""` in the request DTO and is only ever read
          // into the emitted fact, so an empty box is spelled ONE way on the
          // wire — the same rule the review body follows.
          ...(body.reason !== undefined && body.reason.length > 0
            ? { reason: body.reason }
            : {}),
        },
        mutating(signalOf(options))
      ),

    respond: (reviewId, body, options) =>
      client.post(
        `/reviews/${encodeURIComponent(reviewId)}/response`,
        { body: body.body },
        mutating(signalOf(options))
      ),
  };
}
