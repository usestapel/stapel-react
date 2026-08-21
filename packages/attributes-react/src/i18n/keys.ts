import type { I18nDictionary, I18nEngine } from "@stapel/core";

/**
 * `@stapel/attributes-react`'s own translation KEYS (frontend-standard §4.2):
 * nothing in this package renders a literal string — a host resolves these
 * through core's i18n engine (`useT`).
 *
 * Two families live here, and only two:
 *
 *  - `attributes.*` — this package's OWN chrome: the unsupported-type notice,
 *    the blocked-submit reason, the empty/optional captions, the control
 *    placeholders.
 *  - `error.400.feature_*` / `error.400.description_*` — the engine's own
 *    error catalogue (`stapel_attributes.errors.ATTRIBUTES_ERRORS`, registered
 *    with stapel-core), carried here as an English floor so a host that has
 *    not installed a pair whose `gen:errors` bundle includes them still shows
 *    a sentence rather than a key. A host that HAS one registers it after
 *    this bundle and the generated copy wins.
 *
 * ── What is NOT a key here ─────────────────────────────────────────────────
 *
 * A feature's `name` and its options' `label`s are admin-authored content
 * carried in the category's own data, not keys of this package. When
 * `config.translatable_options` is set (the default) those labels ARE
 * translation keys — but they belong to the deployment's catalogue, not to
 * this bundle, which is why the formatter takes a `t` and never a table.
 */
export const ATTRIBUTES_I18N_KEYS = {
  /** The loud last rung of the resolution ladder. */
  unsupportedType: "attributes.unsupported_type",
  /** Why the submit is off while an undrawable feature is on screen. */
  submitBlockedUnsupportedType: "attributes.submit.blocked.unsupported_type",
  /** A feature whose config declares no type at all. */
  untypedFeature: "attributes.untyped_feature",
  /** Display side: the value is absent. Never rendered as an empty cell. */
  valueNotSet: "attributes.value.not_set",
  /** Display side: the type has no formatter in this build. */
  valueUnreadable: "attributes.value.unreadable",
  boolYes: "attributes.bool.yes",
  boolNo: "attributes.bool.no",
  selectPlaceholder: "attributes.select.placeholder",
  required: "attributes.required",
} as const;

export type AttributesI18nKey =
  (typeof ATTRIBUTES_I18N_KEYS)[keyof typeof ATTRIBUTES_I18N_KEYS];

/**
 * The engine's error catalogue, English — a verbatim mirror of
 * `stapel_attributes.errors.ATTRIBUTES_ERRORS`, including its
 * `{feature}`/`{min_length}`/`{max_length}` placeholders. Same key, same
 * sentence, whichever side of the wire noticed the problem.
 */
export const ATTRIBUTES_ERROR_BUNDLE_EN: I18nDictionary = {
  "error.400.feature_below_minimum": "Value is below minimum for {feature}",
  "error.400.feature_above_maximum": "Value is above maximum for {feature}",
  "error.400.feature_not_in_options": "Value is not in allowed options for {feature}",
  "error.400.feature_invalid_type": "Invalid type for {feature}",
  "error.400.feature_invalid_format": "Invalid format for {feature}",
  "error.400.feature_mandatory_missing": "Mandatory feature {feature} is required",
  "error.400.feature_unknown_type": "Unknown feature type for {feature}",
  "error.400.feature_not_allowed": "Feature {feature} is not allowed here",
  "error.400.feature_unknown": "Unknown feature {feature}",
  "error.400.feature_invalid_config": "Invalid config for {feature}",
  "error.400.description_too_short": "Description must be at least {min_length} characters",
  "error.400.description_too_long": "Description must be at most {max_length} characters",
};

export const attributesI18nBundleEn: I18nDictionary = {
  ...ATTRIBUTES_ERROR_BUNDLE_EN,
  "attributes.unsupported_type":
    "This build has no editor for the “{type}” attribute type, so it cannot be filled in here.",
  "attributes.submit.blocked.unsupported_type":
    "Some attributes cannot be filled in on this page: {types}",
  "attributes.untyped_feature": "This attribute declares no type and cannot be edited.",
  "attributes.value.not_set": "Not specified",
  "attributes.value.unreadable": "Cannot display a “{type}” value in this build",
  "attributes.bool.yes": "Yes",
  "attributes.bool.no": "No",
  "attributes.select.placeholder": "Choose",
  "attributes.required": "Required",
};

/** Register the package's `en` floor into a core i18n engine (call once at
 * startup, before any locale override — the convention every
 * `@stapel/*-react` package follows). */
export function registerAttributesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, attributesI18nBundleEn);
}
