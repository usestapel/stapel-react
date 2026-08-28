/**
 * The refusal is read by CODE, never by status — proved against the real
 * envelopes, folded by the real client.
 *
 * This is the file that would have caught the bug the module invites: "you
 * have already reviewed this" is a 400 and the module's only 409 is about the
 * owner's reply, so a `status === 409` branch is wrong twice over.
 */
import { describe, expect, it } from "vitest";
import { StapelApiError } from "@stapel/core";
import {
  isDuplicateReview,
  isReviewingForbidden,
  isSignInRequired,
  isUnknownTargetType,
  REVIEWS_ERROR_ALREADY_RESPONDED,
  REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED,
  REVIEWS_ERROR_DUPLICATE,
  toReviewsError,
} from "../src/index.js";

const apiError = (status: number, code: string): StapelApiError =>
  new StapelApiError({ code, message: code, status });

describe("the duplicate refusal", () => {
  it("is a 400, and is recognised by its code", () => {
    expect(REVIEWS_ERROR_DUPLICATE).toBe("error.400.reviews_duplicate_review");
    expect(isDuplicateReview(apiError(400, REVIEWS_ERROR_DUPLICATE))).toBe(true);
  });

  it("is NOT the module's 409 — that one is about the owner's reply", () => {
    const conflict = apiError(409, REVIEWS_ERROR_ALREADY_RESPONDED);
    expect(isDuplicateReview(conflict)).toBe(false);
    // Stated as an assertion so the trap is documented in the suite: a form
    // that branched on 409 would have caught this one and missed the real
    // duplicate above.
    expect(toReviewsError(conflict).status).toBe(409);
    expect(toReviewsError(apiError(400, REVIEWS_ERROR_DUPLICATE)).status).toBe(400);
  });

  it("is not confused with the other 400s of the same module", () => {
    expect(isDuplicateReview(apiError(400, "error.400.reviews_invalid_rating"))).toBe(
      false
    );
    expect(
      isDuplicateReview(apiError(400, "error.400.reviews_unknown_target_type"))
    ).toBe(false);
  });
});

describe("the 401 only the WRITE can answer now", () => {
  // stapel-reviews 0.3.0 opened both reads (IsAuthenticatedOrReadOnly /
  // AllowAny), so this predicate serves the submit path alone — and it is
  // still needed there, because a POST has to attribute the review to an
  // author.
  it("is recognised by status, whatever key the body carried", () => {
    expect(isSignInRequired(apiError(401, "stapel.http.401"))).toBe(true);
    expect(isSignInRequired(apiError(401, "error.401.some_deployment_key"))).toBe(true);
  });

  it("is not a 403 — a signed-in caller refused by can_review is a different sentence", () => {
    const forbidden = apiError(403, "error.403.reviews_cannot_review");
    expect(isSignInRequired(forbidden)).toBe(false);
    expect(isReviewingForbidden(forbidden)).toBe(true);
  });
});

describe("the same refusal, spelled 403 for a minted GUEST", () => {
  // A storefront that mints anonymous accounts left this predicate blind: the
  // visitor IS authenticated, so no 401 arrives, and the module refuses the
  // write with `ALLOW_ANONYMOUS_WRITES`'s own 403 instead. Without this arm
  // the form rendered a raw i18n key nobody has copy for.
  it("recognises `error.403.reviews_anonymous_not_allowed`", () => {
    expect(REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED).toBe(
      "error.403.reviews_anonymous_not_allowed"
    );
    expect(
      isSignInRequired(apiError(403, REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED))
    ).toBe(true);
  });

  it("and is still NOT the can_review 403, which signing up does not fix", () => {
    expect(
      isReviewingForbidden(apiError(403, REVIEWS_ERROR_ANONYMOUS_NOT_ALLOWED))
    ).toBe(false);
  });
});

describe("the wiring fault", () => {
  it("names an unregistered (or missing) target type", () => {
    expect(
      isUnknownTargetType(apiError(400, "error.400.reviews_unknown_target_type"))
    ).toBe(true);
  });
});

describe("a non-API failure", () => {
  it("collapses to the pair's own fallback key, not to a raw message", () => {
    expect(toReviewsError(new Error("socket hang up")).code).toBe(
      "reviews.error.unknown"
    );
    expect(isDuplicateReview(new Error("socket hang up"))).toBe(false);
  });
});
