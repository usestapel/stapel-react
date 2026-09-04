/**
 * `@stapel/attributes-react` — the React value layer for `stapel-attributes`'
 * dynamic feature types.
 *
 * ── What this package is, and what it deliberately is not ──────────────────
 *
 * It is an **L0 package, not a pair**, modelled on `@stapel/image`: no client,
 * no queries, no `docs/schema.json`. Its backend counterpart is an L1 library
 * with no HTTP surface whatsoever (`stapel-attributes/docs/readme.md`) — there
 * is no `/attributes/api/v1/` to pair with. Feature definitions and validation
 * verdicts reach a browser inside the responses of the modules that OWN them
 * (categories, listings), and those pairs depend on this one to draw and check
 * what they carry.
 *
 * It switches on **`config.type`** — the value type (`string`, `int`,
 * `select`, `date`, `hex_color`, `hierarchical_select`, `convertible_unit`,
 * `bool`, `float`, `header`). That is a DIFFERENT axis from the one
 * `@stapel/forms-react` works on, which is `FormField.kind`: the field kinds
 * of the admin form that CONFIGURES a type. Same upstream library, two
 * vocabularies, and the storefront needs this one. A consequence worth
 * stating because it removes an upstream ask: a storefront needs **no
 * catalogue endpoint** for these types — the type arrives in the data, on
 * every feature.
 *
 * ── The three-rung ladder, verbatim from forms-react ───────────────────────
 *
 *   explicit `registerValueEditor(type, …)`  ← a host's, always wins
 *   → the skin's `BUILTIN_VALUE_EDITORS`     ← `/default`, ten types
 *   → `<UnsupportedValueEditor/>`            ← loud, never a skipped field
 *
 * and, while an undrawable feature is on screen, `unsupportedTypeGate` blocks
 * the submit with the reason NAMED. A category can legally carry a type this
 * build has no editor for; drawing nothing would silently drop a feature that
 * may be MANDATORY, and the person would submit a listing they could not
 * complete and be told, by the server, that an attribute they never saw is
 * missing.
 *
 * ── Layout ─────────────────────────────────────────────────────────────────
 *
 *   `.`          registry + mirror + DTO helpers + display formatting.
 *                React types only; no antd, no react-router, no fetch.
 *   `./default`  the antd skin: ten builtin editors, `<FeatureFields>`,
 *                `<FeatureBadges>`, `<FeatureValueList>`.
 *   `./i18n/ru`  opt-in locale bundles.
 *   `./i18n/es`
 */

export type {
  Cond,
  FeatureConfig,
  FeatureDef,
  FeatureValueDto,
  FeatureValidationResult,
  FeaturesDto,
  GroupConfig,
  GroupRepeat,
  Hint,
  OptionsRef,
  RefHierarchicalSelectConfig,
  RefSelectConfig,
  Rule,
  RuleWhen,
  ValidationBatchResult,
  ValidationErrorCode,
  ValidationStatus,
} from "./types.js";
export { featureConfig, featureName, featureType } from "./types.js";

export {
  FeatureRulesError,
  RULE_CONNECTIVES,
  RULE_EFFECTS,
  RULE_OPERATORS,
  VISIBLE_STATE,
  evaluateRules,
  featureRuleState,
  narrowConfig,
  narrowFeature,
  conditionSlugs,
  parseRules,
  ruleErrors,
  ruleStateToJson,
  ruleWhenMatches,
  stringify,
} from "./rules.js";
export type { RuleState } from "./rules.js";

// The live bound of a numeric field, WITH the answers that set it — what a
// control needs to say "for this generation, from 2018 to 2024" instead of
// repeating a range the person cannot act on.
export { featureBounds } from "./bounds.js";
export type { FeatureBounds } from "./bounds.js";

// Progressive disclosure and the bake rule — the dependent-field predicates
// `<FeatureFields>` and `toFeaturesDto` share, exported so a host drawing
// rows itself (renderRow, a filter panel) gates and bakes identically.
export {
  dependencyParentOf,
  sameAnswer,
  soleAllowedValue,
  undisclosedSlugs,
} from "./disclosure.js";

export {
  VOCABULARY_BACKED_TYPES,
  VocabularyClientProvider,
  firstCode,
  isPopularTerm,
  optionsRefOf,
  splitPopularBand,
  termPageOf,
  useVocabularyClient,
} from "./vocabulary.js";
export type {
  VocabularyClient,
  VocabularyTerm,
  VocabularyTermAnswer,
  VocabularyTermPage,
} from "./vocabulary.js";

export {
  INVALID_RULES_FEATURE,
  UNTYPED_FEATURE,
  registerValueEditor,
  registeredValueEditorTypes,
  resolveValueEditor,
  unregisterValueEditor,
  unsupportedFeatureNames,
  unsupportedTypeGate,
  unsupportedTypes,
} from "./registry.js";
export type {
  RenderabilityOptions,
  ValueEditor,
  ValueEditorProps,
} from "./registry.js";

export {
  ERROR_CODE_TO_KEY,
  VALIDATION_ERROR_CODES,
  featureErrorsBySlug,
  resultErrorKey,
} from "./errors.js";

export {
  SIMPLE_COLORS,
  codePointLength,
  featureAnswerRequired,
  featureRequiredUnder,
  isBlank,
  mirrorValidate,
  patternFullMatch,
  validateFeatureValue,
} from "./validate.js";

// What a HOST asks before it draws a step: is there anything in this block
// for the current answers, and what is still owed. Both are verdicts about
// values — the same two gates the renderer composes and the same requiredness
// the mirror refuses with — so a step ladder and the form agree.
export {
  hasVisibleFields,
  missingRequiredFeatures,
  visibleFeatureGroups,
  visibleFeatures,
} from "./formShape.js";
export type { VisibleFeatureGroup } from "./formShape.js";

export {
  defaultFeatureValue,
  initialFeatureValues,
  useFeatureFields,
} from "./useFeatureFields.js";
export type {
  FeatureFieldsState,
  UseFeatureFieldsOptions,
} from "./useFeatureFields.js";

export { fromFeaturesDto, toFeaturesDto } from "./dto.js";

export {
  FEATURE_VISIBILITIES,
  VERIFICATION_VERIFIED,
  featureVisibility,
  isPublicFeature,
  isRedactedValue,
  isValuePresent,
  isValueVerified,
  valueVerification,
} from "./visibility.js";
export type { FeatureVerification, FeatureVisibility } from "./visibility.js";

export { FORMATTABLE_TYPES, formatFeatureValue, hexColorSwatch } from "./format.js";
export type { FormatOptions } from "./format.js";

export {
  ATTRIBUTES_ERROR_BUNDLE_EN,
  ATTRIBUTES_I18N_KEYS,
  attributesI18nBundleEn,
  registerAttributesI18n,
} from "./i18n/keys.js";
export type { AttributesI18nKey } from "./i18n/keys.js";
