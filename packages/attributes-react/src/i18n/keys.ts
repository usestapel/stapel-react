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
  /**
   * `select.maxSelected` — the ceiling, said ON the chips it switches off.
   *
   * A capped multiple choice is drawn inline for exactly this reason: the
   * control can stop at the cap only while it owns the selection, and a chip
   * that cannot be added says why beside the row instead of letting the
   * person add a seventh answer the mirror is going to refuse.
   */
  selectMaxSelected: "attributes.select.max_selected",
  /** The picker sheet's commit button. It carries the count of what is about
   * to be kept, which is the difference between pressing it and dismissing. */
  pickerDone: "attributes.picker.done",
  /** The picker sheet's search box — its placeholder and its accessible
   * name. */
  pickerSearch: "attributes.picker.search",
  /** The heading of the sheet's first section: the codes this person picked
   * last, on this vocabulary level. Drawn only when there are any and the
   * search box is empty — a "recent" list that does not answer the query is
   * the stale list defect wearing a heading. */
  pickerRecent: "attributes.picker.recent",
  /** The tail row of a list too long to draw: more matched than is on
   * screen, so the search box is where the rest of them are. */
  pickerRefine: "attributes.picker.refine",
  /** A rung of a chained reference whose parent has not been answered yet.
   * Interpolates `{parent}` — the level's own name, because "choose the
   * previous one first" is not something a person can act on. */
  refParentFirst: "attributes.ref.parent_first",
  /** A value the form BAKED because the live constraint left exactly one
   * allowed answer (the bake rule): committed as if picked, drawn grey. The line
   * is the reason beside the disabled control — the house rule that nothing
   * is switched off silently. */
  bakedByConstraint: "attributes.baked",
  /** A typed number outside the vocabulary-backed allowed set. Interpolates
   * `{min}` and `{max}` — the ends of the LIVE set, not the static config
   * bounds. Shown beside the full recovery dropdown. */
  intOutOfAllowed: "attributes.int.out_of_allowed",
  /** Accessible names of the two steppers that walk the allowed set. */
  intStepUp: "attributes.int.step_up",
  intStepDown: "attributes.int.step_down",
  /** The disclosure that holds a long `description`. The help itself is the
   * catalogue's sentence; this is the handle, and it says what is behind it
   * rather than "More". */
  helpMore: "attributes.help.more",
  /** A bound with both ends. Interpolates `{min}` and `{max}`, already
   * formatted by the editor (numerals for a number, a date for a date). */
  hintRange: "attributes.hint.range",
  /** A bound with a floor only. */
  hintMin: "attributes.hint.min",
  /** A bound with a ceiling only. */
  hintMax: "attributes.hint.max",
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
  /**
   * Why the add button is off: `repeat.max` rows are already here.
   *
   * The button STAYS on screen with the sentence beside it, unlike the remove
   * control, because the two absences mean different things — "you cannot
   * remove the only row" is obvious from there being one row, while "five is
   * the most this catalogue allows" is a fact only the config knows.
   */
  groupAtMaxRows: "attributes.group.at_max_rows",
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
    "Only our moderators can see it — it is not shown back to you either.",
  "attributes.bool.yes": "Yes",
  "attributes.bool.no": "No",
  "attributes.select.placeholder": "Choose",
  "attributes.locked": "Set by the catalogue — it cannot be changed here.",
  "attributes.select.min_selected": "Choose at least {count}.",
  "attributes.select.max_selected": "Choose at most {count}.",
  "attributes.picker.done": "Done",
  "attributes.picker.search": "Search",
  "attributes.picker.recent": "Recent",
  "attributes.picker.refine": "Keep typing to narrow the list.",
  "attributes.ref.parent_first": "Choose {parent} first.",
  "attributes.baked": "Determined by your other selections.",
  "attributes.int.out_of_allowed": "Outside the allowed range — from {min} to {max}.",
  "attributes.int.step_up": "Next allowed value",
  "attributes.int.step_down": "Previous allowed value",
  "attributes.help.more": "How to fill this in",
  "attributes.hint.range": "From {min} to {max}.",
  "attributes.hint.min": "From {min}.",
  "attributes.hint.max": "Up to {max}.",
  "attributes.color.exact": "Exact shade",
  "attributes.unit": "Unit",
  "attributes.vocabulary_unavailable": "This detail cannot be filled in here yet.",
  "attributes.vocabulary.no_matches": "Nothing matched",
  "attributes.invalid_rules": "This detail is misconfigured and cannot be filled in.",
  "attributes.group.row": "Row {index}",
  "attributes.group.add_row": "Add row",
  "attributes.group.remove_row": "Remove",
  "attributes.group.at_max_rows": "This detail takes at most {count} rows.",
};

/** Register the package's `en` floor into a core i18n engine (call once at
 * startup, before any locale override — the convention every
 * `@stapel/*-react` package follows). */
export function registerAttributesI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, attributesI18nBundleEn);
}
