/**
 * The wire shapes of `stapel_attributes`, as this package sees them.
 *
 * There is no generated `schema.ts` here and there never will be:
 * stapel-attributes is an **L1 library with no HTTP surface at all** — no
 * models, no views, no urls (`stapel-attributes/docs/readme.md`), so it emits
 * no `docs/schema.json` for `pnpm gen:api` to read. Its shapes reach a browser
 * embedded in someone ELSE's response: a category's features arrive from
 * `GET /categories/api/v1/categories/{id}/features/`, a validation verdict
 * from `POST /categories/{pk}/validate-dto/` and from
 * `POST /listings/{pk}/publish/`. The owning pair generates those; this
 * package types the payload they carry.
 *
 * Every field here was read off the Python it mirrors, and the mirrors are
 * named in the doc comments so the next person can check rather than trust.
 */

/**
 * A feature's type-specific configuration. `type` is the discriminator — the
 * **value type's slug**, and the axis this whole package switches on.
 *
 * ── The distinction that must not be swallowed ─────────────────────────────
 *
 * stapel-attributes has TWO field vocabularies, and `@stapel/forms-react`
 * works with the other one:
 *
 *  - `FormField.kind` (`stapel_attributes/config_form.py`) — the field kinds
 *    of the ADMIN form that configures a type. That is what
 *    `GET /forms/api/v1/field-kinds` enumerates and what forms-react's widget
 *    registry keys on.
 *  - `config["type"]` — the VALUE type: `int`, `float`, `string`, `bool`,
 *    `hex_color`, `select`, `date`, `header`, `hierarchical_select`,
 *    `convertible_unit`. That is what a person filling in a listing actually
 *    edits, and it is what this package keys on.
 *
 * A storefront therefore needs **no catalogue endpoint**: the type arrives in
 * the data, on every feature.
 *
 * `type` is optional here because the wire can omit it. The features endpoint
 * serializes `obj.config` verbatim (`stapel-categories`
 * `FeatureCompactSerializer.get_config`), NOT `get_config_with_defaults()`, so
 * a config saved without its defaults arrives without them — including,
 * for a malformed row, without a `type`. A missing type is an unsupported
 * type, loudly, rather than a crash.
 */
export interface FeatureConfig {
  readonly type?: string;
  readonly [key: string]: unknown;
}

/**
 * One feature of a category — the browser's view of `stapel_attributes.base
 * .FeatureDef`, as `stapel-categories`' `FeatureCompactSerializer` sends it
 * (`fields = [id, tn_parent, name, slug, icon, comment, config, mandatory,
 * show_as_badge, show_at_title, translate]`).
 */
export interface FeatureDef {
  /** Payload key this feature's value is submitted under. */
  readonly slug: string;
  readonly config?: FeatureConfig;
  readonly id?: number | string | null;
  /** Display name or translation key. Falls back to `slug` server-side. */
  readonly name?: string | null;
  readonly mandatory?: boolean;
  readonly show_at_title?: boolean;
  readonly show_as_badge?: boolean;
  readonly translate?: string | null;
  readonly icon?: string | null;
  readonly comment?: string | null;
  readonly tn_parent?: number | string | null;
}

/**
 * One submitted value: `{type, value}` plus whatever else the type's DTO
 * carries. Exactly one builtin adds a key — `convertible_unit`, whose DTO is
 * `{type, value, unit}` because the number has to be tagged with the unit it
 * was typed in before the server converts to the family's base unit.
 */
export interface FeatureValueDto {
  readonly type: string;
  readonly value: unknown;
  readonly [key: string]: unknown;
}

/** The `features_draft`-shaped payload: `{slug: {type, value}}`. */
export type FeaturesDto = Readonly<Record<string, FeatureValueDto>>;

/** `stapel_attributes.results.ValidationStatus`. */
export type ValidationStatus = "ok" | "validation_failed";

/**
 * `stapel_attributes.results.ValidationErrorCode`, mirrored.
 *
 * Pinned against the engine's own generated corpus
 * (`stapel-attributes/tests/golden/error_codes.json`, itself generated from
 * the enum and asserted by both the Python and the TypeScript half of the
 * cross-language bridge) — see `test/contract.test.ts`.
 */
export type ValidationErrorCode =
  | "above_maximum"
  | "below_minimum"
  | "description_too_long"
  | "description_too_short"
  | "duplicate_slug"
  | "empty_options"
  | "invalid_config"
  | "invalid_format"
  | "invalid_type"
  | "mandatory_missing"
  | "min_greater_than_max"
  | "not_allowed"
  | "not_in_options"
  | "unknown_feature"
  | "unknown_feature_type";

/**
 * One row of a batch verdict — `stapel_attributes.results
 * .FeatureValidationResult` as its DRF serializer sends it.
 *
 * `slug` is the routing key: it is what puts a refusal on a control. The
 * server's `params` carry `{feature, slug}` (never `field`), so
 * `featureErrorsBySlug` adds `field` when folding a row into a `FlowError`,
 * which is what the fleet's `useFieldError` convention reads.
 */
export interface FeatureValidationResult {
  readonly slug: string;
  readonly status: ValidationStatus;
  readonly id?: number | string | null;
  readonly error?: ValidationErrorCode | null;
  /** The constraint that was violated (a limit, a list of options). */
  readonly ref_value?: unknown;
  readonly message?: string | null;
  /** `error.400.feature_*` — the key a person's sentence comes from. */
  readonly localizable_error?: string | null;
  readonly params?: Readonly<Record<string, unknown>> | null;
  /** Non-blocking findings (e.g. config keys the parser dropped). Never
   * flips `valid` — a warning is not a refusal. */
  readonly warnings?: readonly string[] | null;
}

/** `stapel_attributes.results.ValidationBatchResult`. */
export interface ValidationBatchResult {
  readonly valid: boolean;
  readonly results: readonly FeatureValidationResult[];
}

/**
 * A feature's declared value type, or `undefined` when the config carries
 * none. The ONE place `config.type` is read, so "which axis is this?" has a
 * single answer in this package.
 */
export function featureType(feature: FeatureDef): string | undefined {
  const type = feature.config?.type;
  return typeof type === "string" && type.length > 0 ? type : undefined;
}

/** A feature's config, never `undefined` — saves every reader a `?? {}`. */
export function featureConfig(feature: FeatureDef): FeatureConfig {
  return feature.config ?? {};
}

/** A feature's display name, falling back to its slug exactly as
 * `FeatureDef.__post_init__` does server-side. */
export function featureName(feature: FeatureDef): string {
  return feature.name ?? feature.slug;
}
