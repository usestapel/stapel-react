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
  /**
   * The loud last rung of the resolution ladder.
   *
   * It interpolates NOTHING. It used to render the type SLUG —
   * "This build has no editor for the “size_grid” attribute type" — which the
   * visual pass filed as developer copy shipped to a person filling in a form
   * (class C-DEVCOPY): "this build" is a fact about our release process and
   * `size_grid` is an identifier from a Python registry. The row already
   * carries the feature's own NAME; the slug now travels as
   * `data-attributes-type` on the notice, where support can read it and a
   * seller cannot.
   */
  unsupportedType: "attributes.unsupported_type",
  /** Why the submit is off while an undrawable feature is on screen. Named by
   * FEATURE (what a person can see on the page), not by type slug. */
  submitBlockedUnsupportedType: "attributes.submit.blocked.unsupported_type",
  /** Why the submit is off while the mirror is refusing something. */
  submitBlockedInvalid: "attributes.submit.blocked.invalid",
  /** A feature whose config declares no type at all. */
  untypedFeature: "attributes.untyped_feature",
  /** Display side: the value is absent. Never rendered as an empty cell. */
  valueNotSet: "attributes.value.not_set",
  /** Display side: this build has no formatter for the value's type. Same
   * C-DEVCOPY rule as `unsupportedType`: no slug in the sentence. */
  valueUnreadable: "attributes.value.unreadable",
  /**
   * Display side: the value is withheld from this reader and the seller DID
   * fill it in. It says only that, because `present` is the only thing this
   * system observed — nothing in the fleet runs a VIN or an IMEI check, so
   * the sentence must not read as "we checked it". See `visibility.ts`.
   */
  valueProvided: "attributes.value.provided",
  /**
   * Display side: an outside check actually ran and said so
   * (`verification.status === "verified"`). Nothing writes one today; the key
   * exists so the badge upgrades the day something does, and never before.
   */
  valueVerified: "attributes.value.verified",
  /** Composer side: the tag beside a non-public field's label. The seller is
   * told AT THE FIELD that what they are about to type is not published —
   * before they type it, not in a help page. */
  visibilityNotPublished: "attributes.visibility.not_published",
  /** Composer side: `visibility: "owner"` — who does see it. */
  visibilityOwner: "attributes.visibility.owner",
  /** Composer side: `visibility: "staff"` — moderation only, and it is not
   * echoed back to the seller either, which they are owed before typing. */
  visibilityStaff: "attributes.visibility.staff",
  boolYes: "attributes.bool.yes",
  boolNo: "attributes.bool.no",
  selectPlaceholder: "attributes.select.placeholder",
  /** `select.lockUserInput` / `date.lockInput`: the catalogue set this value
   * and the control is deliberately read-only. A disabled control with no
   * sentence beside it is the dead rectangle §83 forbids. */
  lockedByConfig: "attributes.locked",
  /** `select.minSelected` — the floor antd's `Select` cannot enforce, said
   * beside the control instead of only after a refused submit. */
  selectMinSelected: "attributes.select.min_selected",
  /** Accessible name of the `hex_color` exact-shade picker, which antd renders
   * as an unlabelable trigger. */
  colorExact: "attributes.color.exact",
  /** Accessible name of the `convertible_unit` unit chooser. */
  unit: "attributes.unit",
  /**
   * A `ref_select` / `ref_hierarchical_select` is on screen and no
   * `VocabularyClientProvider` is above it.
   *
   * Its config carries a POINTER to a vocabulary, never a list of options, so
   * without a client there is nothing to offer — and an empty dropdown is a
   * mandatory attribute a person cannot answer and is not told about. Same
   * loud notice as an unsupported type, and the submit blocks through the
   * same channel.
   */
  vocabularyUnavailable: "attributes.vocabulary_unavailable",
  /** A vocabulary search came back with nothing — `notFoundContent`, so the
   * dropdown says "no match" instead of drawing an empty box that reads as a
   * broken control. */
  vocabularyNoMatches: "attributes.vocabulary.no_matches",
  /** The feature's `rules` do not parse, so neither its visibility nor its
   * requiredness is knowable and it cannot honestly be drawn. */
  invalidRules: "attributes.invalid_rules",
  /** A composite's row heading — "Step 1", "Step 2". Interpolates `{index}`,
   * one-based, because a person counts rows from one. */
  groupRow: "attributes.group.row",
  /** Add one row to a repeatable composite. Hidden entirely when `repeat` is
   * null (a single-row group has nothing to add). */
  groupAddRow: "attributes.group.add_row",
  /** Drop one row. Absent once `repeat.min` is reached, rather than disabled:
   * a control that can never be pressed is the dead rectangle §83 forbids. */
  groupRemoveRow: "attributes.group.remove_row",
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
  "error.400.feature_invalid_rules": "Invalid rules for {feature}",
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
  "attributes.unsupported_type": "This detail cannot be filled in here yet.",
  "attributes.submit.blocked.unsupported_type":
    "Some details cannot be filled in on this page: {features}",
  "attributes.submit.blocked.invalid": "Check the highlighted fields before continuing.",
  "attributes.untyped_feature": "This detail is misconfigured and cannot be filled in.",
  "attributes.value.not_set": "Not specified",
  "attributes.value.unreadable": "This value cannot be shown here",
  "attributes.value.provided": "Provided by the seller",
  "attributes.value.verified": "Verified",
  "attributes.visibility.not_published": "Not published",
  "attributes.visibility.owner":
    "You and our moderators can see it; buyers cannot.",
  "attributes.visibility.staff":
    "Only our moderators can see it \u2014 it is not shown back to you either.",
  "attributes.bool.yes": "Yes",
  "attributes.bool.no": "No",
  "attributes.select.placeholder": "Choose",
  "attributes.locked": "Set by the catalogue — it cannot be changed here.",
  "attributes.select.min_selected": "Choose at least {count}.",
  "attributes.color.exact": "Exact shade",
  "attributes.unit": "Unit",
  "attributes.vocabulary_unavailable": "This detail cannot be filled in here yet.",
  "attributes.vocabulary.no_matches": "Nothing matched",
  "attributes.invalid_rules": "This detail is misconfigured and cannot be filled in.",
  "attributes.group.row": "Row {index}",
  "attributes.group.add_row": "Add row",
  "attributes.group.remove_row": "Remove",
};

/** Register the package's `en` floor into a core i18n engine (call once at
 * startup, before any locale override — the convention every
 * `@stapel/*-react` package follows). */
export function registerAttributesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, attributesI18nBundleEn);
}
