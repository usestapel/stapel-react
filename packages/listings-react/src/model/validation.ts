/**
 * What the composer knows before it asks, and what it does with the answer.
 *
 * Three jobs, and the boundaries between them are the point:
 *
 * 1. **The mirror.** Feature values are mirrored by
 *    `@stapel/attributes-react`'s `mirrorValidate` — the engine's own rules,
 *    the engine's own error keys, one implementation. This module adds only
 *    the checks that belong to LISTINGS rather than to a value type: the
 *    description length bounds and the price shape. Nothing here is a
 *    verdict; the server re-runs all of it.
 *
 * 2. **The split of the publish 400.** `POST /{pk}/publish/` answers a bad
 *    draft with a BARE `ValidationBatchResult` — no `localizable_error`, no
 *    envelope — so core wraps it as `stapel.http.400` with the batch sitting
 *    on `StapelApiError.body`. A promotion that fails afterwards answers the
 *    ordinary envelope (`error.400.publish_validation_failed`, or
 *    `error.400.image_required` where the deployment requires a photo). Two
 *    different 400s that mean different things; `publishRefusal` is the one
 *    place that tells them apart.
 *
 * 3. **Routing a refusal onto the control that caused it.**
 *    `featureErrorsBySlug` (attributes-react) adds the `field` param the
 *    fleet's `useFieldError` convention routes on — the engine sends
 *    `{feature, slug}` and never `field`. Listing-level rows (the
 *    description, which the batch carries under the slug `"description"`)
 *    are lifted out to their own control here.
 *
 * ── The mirror's ceilings are CONFIGURABLE, and that is not a nicety ───────
 *
 * `DESCRIPTION_MIN_LENGTH` / `DESCRIPTION_MAX_LENGTH` are `STAPEL_LISTINGS`
 * settings a deployment moves (`conf.py`). A hardcoded 4/500 would refuse a
 * perfectly valid submission on a host that widened them — and the server
 * would never even hear about the refusal, so there would be nothing to
 * appeal to. Same rule the cdn pair wrote down: **the mirror may not refuse
 * what the server would accept.**
 */
import { StapelApiError, isStapelApiError } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import type {
  FeatureDef,
  FeaturesDto,
  FeatureValidationResult,
  ValidationBatchResult,
} from "@stapel/attributes-react";
import {
  codePointLength,
  featureErrorsBySlug,
  mirrorValidate,
} from "@stapel/attributes-react";
import { LISTINGS_I18N_KEYS } from "../i18n/keys.js";
import type { ListingDraftValues } from "./draft.js";

/**
 * The deployment's own ceilings, mirrored client-side.
 *
 * Defaults are the LIBRARY defaults from `stapel_listings/conf.py`; a host
 * whose settings differ passes its own through `createListingsRuntime`.
 */
export interface ListingDraftLimits {
  /** `STAPEL_LISTINGS["DESCRIPTION_MIN_LENGTH"]`. */
  readonly descriptionMin: number;
  /** `STAPEL_LISTINGS["DESCRIPTION_MAX_LENGTH"]`. */
  readonly descriptionMax: number;
  /** `Listing.title` is `max_length=255` — a MODEL constraint, so it moves
   * only with a migration, but mirrored from the schema all the same. */
  readonly titleMax: number;
  /** How many photos a gallery may carry. stapel-cdn has no opinion and
   * stapel-listings stores an unbounded list; the storefront's ceiling is 10
   * (spec §4.1), which makes it the PAIR's rule — hence a setting and not a
   * constant, and hence a refusal in this pair's own namespace. */
  readonly maxImages: number;
  /** `STAPEL_LISTINGS["REQUIRE_IMAGE_ON_PUBLISH"]` — library default `True`.
   * The server raises a bare `ValidationError` for it, which the view turns
   * into `error.400.publish_validation_failed`; mirroring it lets the
   * composer say WHICH thing is missing before the round trip. */
  readonly requireImageOnPublish: boolean;
}

export const DEFAULT_DRAFT_LIMITS: ListingDraftLimits = {
  descriptionMin: 4,
  descriptionMax: 500,
  titleMax: 255,
  maxImages: 10,
  requireImageOnPublish: true,
};

/** The slug the description's refusal is filed under — the engine files it
 * the same way (`validate_description` returns a `FeatureValidationResult`
 * whose slug is not a feature's), so the composer has one routing table. */
export const DESCRIPTION_FIELD = "description";
export const TITLE_FIELD = "title";
export const PRICE_FIELD = "price";
export const IMAGES_FIELD = "images";
export const CATEGORY_FIELD = "category_id";

/** A client-side refusal. `status: 0` on purpose: a rule this build applied
 * must never be indistinguishable from one that came over the wire. */
function mirrored(code: string, params: Record<string, unknown> = {}): FlowError {
  return { code, params, status: 0, message: undefined, language: undefined };
}

const DECIMAL = /^\d{1,10}(?:\.\d{1,2})?$/;

/**
 * The listing-level half of the mirror: everything that is not a feature
 * value. Returns refusals keyed by control, empty when nothing is wrong.
 *
 * Note what is NOT judged: a missing title, a missing price and a missing
 * location. The server accepts a published listing without any of them
 * (`publish_listing` promotes `title_draft or title` and leaves the rest),
 * so refusing them here would block a submission the backend would take. A
 * skin may still *encourage* them; that is copy, not a gate.
 */
export function mirrorListingFields(
  values: ListingDraftValues,
  limits: ListingDraftLimits
): Readonly<Record<string, FlowError>> {
  const out: Record<string, FlowError> = {};

  if (values.categoryId.length === 0) {
    out[CATEGORY_FIELD] = mirrored(LISTINGS_I18N_KEYS.composeCategoryRequired);
  }

  if (codePointLength(values.title) > limits.titleMax) {
    out[TITLE_FIELD] = mirrored(LISTINGS_I18N_KEYS.composeTitleTooLong, {
      max_length: limits.titleMax,
    });
  }

  // Length in Unicode CODE POINTS, the unit Python's `len()` counts in. One
  // emoji is one character on both sides of the wire; `String.length` would
  // call it two and refuse a description the server accepts.
  const described = codePointLength(values.description.trim());
  if (described < limits.descriptionMin) {
    out[DESCRIPTION_FIELD] = mirrored("error.400.description_too_short", {
      min_length: limits.descriptionMin,
      field: DESCRIPTION_FIELD,
    });
  } else if (described > limits.descriptionMax) {
    out[DESCRIPTION_FIELD] = mirrored("error.400.description_too_long", {
      max_length: limits.descriptionMax,
      field: DESCRIPTION_FIELD,
    });
  }

  if (values.price.length > 0 && !DECIMAL.test(values.price)) {
    // `validate_price_draft` refuses a negative, and the DecimalField refuses
    // anything outside `^-?\d{0,10}(\.\d{0,2})?$`. One sentence for both:
    // "that is not a price we can send".
    out[PRICE_FIELD] = mirrored(LISTINGS_I18N_KEYS.composePriceInvalid);
  }

  if (values.images.length > limits.maxImages) {
    out[IMAGES_FIELD] = mirrored(LISTINGS_I18N_KEYS.composeTooManyImages, {
      max: limits.maxImages,
    });
  }

  // The coordinates are a composite: half of one is not half a location.
  const { lat, lon } = values.location;
  const hasLat = lat !== null && lat.length > 0;
  const hasLon = lon !== null && lon.length > 0;
  if (hasLat !== hasLon) {
    out["location"] = mirrored(LISTINGS_I18N_KEYS.composeGeoIncomplete);
  }

  return out;
}

/**
 * The whole mirror: listing fields + feature values, in one routing table.
 *
 * Feature refusals go through `featureErrorsBySlug`, so a mirrored "too long"
 * and a server "too long" render the SAME sentence from the SAME key — they
 * are the same key, because the mirror speaks the engine's vocabulary.
 */
export function mirrorDraft(
  values: ListingDraftValues,
  features: readonly FeatureDef[],
  featuresDto: FeaturesDto,
  limits: ListingDraftLimits
): Readonly<Record<string, FlowError>> {
  return {
    ...featureErrorsBySlug(mirrorValidate(features, featuresDto)),
    ...mirrorListingFields(values, limits),
  };
}

/** Is this batch clean? `valid` is the server's own summary; a caller that
 * recomputed it from `results` could disagree with the field the API sends. */
export function isBatchValid(batch: ValidationBatchResult): boolean {
  return batch.valid;
}

function isValidationBatch(value: unknown): value is ValidationBatchResult {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { valid?: unknown; results?: unknown };
  return typeof candidate.valid === "boolean" && Array.isArray(candidate.results);
}

/** What a failed publish actually was. */
export type PublishRefusal =
  | {
      /** The draft did not validate: per-control refusals, already routed. */
      readonly kind: "invalid_draft";
      readonly batch: ValidationBatchResult;
      readonly fieldErrors: Readonly<Record<string, FlowError>>;
    }
  | {
      /** Anything else the server said, in the ordinary error dialect — a
       * missing photo, a 403 on somebody else's listing, a 503. */
      readonly kind: "error";
      readonly error: StapelApiError;
    };

/**
 * Split a thrown publish failure into its two meanings.
 *
 * The check is on the BODY, not on the status: a 400 whose body is a batch is
 * a per-field verdict, and a 400 whose body is an envelope is a sentence. A
 * caller that branched on `status === 400` alone would put
 * `error.400.image_required` under a feature control.
 */
export function publishRefusal(thrown: unknown): PublishRefusal {
  if (isStapelApiError(thrown) && isValidationBatch(thrown.body)) {
    const batch = thrown.body;
    return {
      kind: "invalid_draft",
      batch,
      fieldErrors: listingFieldErrors(batch),
    };
  }
  return {
    kind: "error",
    error: isStapelApiError(thrown)
      ? thrown
      : new StapelApiError({
          code: LISTINGS_I18N_KEYS.unknownError,
          message: "Publishing failed",
          status: 0,
          body: thrown,
        }),
  };
}

/**
 * A server batch → refusals keyed by CONTROL.
 *
 * One call, because the server already keys everything the way the composer
 * does. `services.publish.validate_draft` inserts `validate_description`'s
 * row at the FRONT of the same list, and that row's slug is literally
 * `"description"` (`stapel_attributes/validation.py:726`) — the same key
 * {@link DESCRIPTION_FIELD} names and the same key the mirror files its own
 * length refusal under. So the description's control receives the server's
 * verdict and the mirror's through one lookup, and neither can land in a
 * page-level banner because nothing routed it.
 */
export function listingFieldErrors(
  batch: ValidationBatchResult
): Readonly<Record<string, FlowError>> {
  return featureErrorsBySlug(batch);
}

/** The rows of a batch that failed, in the order the server sent them —
 * for a summary line above the form ("3 details need attention"). */
export function failedResults(
  batch: ValidationBatchResult
): readonly FeatureValidationResult[] {
  return batch.results.filter((result) => result.status === "validation_failed");
}
