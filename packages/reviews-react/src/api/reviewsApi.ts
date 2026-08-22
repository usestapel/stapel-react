import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import type {
  Review,
  ReviewAggregate,
  ReviewListParams,
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
 * ── EVERY endpoint here is `IsAuthenticated`, including the two reads ──────
 *
 * That is a fact about the module, not a choice of this pair: all four views
 * declare `permission_classes = [permissions.IsAuthenticated]`. A signed-out
 * visitor on a public listing page therefore gets 401 for the review list AND
 * for the aggregate. The pair does not paper over it — `model/queries.ts`
 * turns that refusal into a NAMED state ("sign in to see reviews") rather
 * than the empty list, which would tell a visitor that a well-reviewed seller
 * has no reviews. The upstream ask (make the two GETs `AllowAny`, or accept a
 * guest identity as the upload endpoints of stapel-cdn already do) is
 * recorded in the contract pin and in the README.
 *
 * ── The two operations that are NOT here, and why ─────────────────────────
 *
 * `POST /reviews/{id}/moderate` (hide/publish) and `POST /reviews/{id}/response`
 * (the target owner's single reply) are both gated on the target type's
 * `can_moderate` callback, which is **fail-closed**: a type that names no
 * callback denies everyone (`registry.check_can_moderate`). They belong to a
 * seller console and a moderator console, and this pair ships neither
 * (storefront spec §4.4: the owner's reply is DISPLAYED in the MVP and the
 * button to write one does not exist, rather than existing switched off).
 *
 * Both stay in the generated schema and therefore in `manifest.json`, which
 * lists the whole contract — nothing is hidden; they are simply not this
 * pair's surface. Adding them later is additive and needs no change here.
 *
 * These operations will be GENERATED from schema.json operationIds by gen-api
 * v2; until then they are hand-authored here (the ONE legal home of path
 * strings — `stapel/no-string-paths` §2.3 carve-out).
 */
export interface ReviewsApi {
  readonly client: StapelClient;

  /**
   * A page of a target's reviews, newest first.
   *
   * Answers core's `AnchorPagination` envelope, NOT the array the schema
   * declares (`api/types.ts` header). Anchors are `created_at` timestamps.
   */
  reviews(
    params: ReviewListParams,
    options?: { readonly signal?: AbortSignal }
  ): Promise<ReviewPage>;

  /**
   * The module-owned rating aggregate for ONE target — mean and count over
   * published reviews.
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
   * Write a review of a target.
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
  };
}
