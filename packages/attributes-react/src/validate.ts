/**
 * The client-side validation MIRROR — instant feedback, never a verdict.
 *
 * "Client-side validation mirrors, server decides." Every rule here is
 * derived from the feature's own `config` so a person sees a problem as they
 * type instead of after a round trip; none of it is trusted. The server
 * re-runs `stapel_attributes.validate_dto_structured` on
 * `POST /categories/{pk}/validate-dto/` and again on
 * `POST /listings/{pk}/publish/`, and its `ValidationBatchResult` is the one
 * that counts. This function returns the SAME shape so a server answer can
 * replace a mirrored one with no translation step.
 *
 * ── Two contract details that are easy to get subtly wrong ─────────────────
 *
 * 1. **`pattern` matches the WHOLE value.** The engine uses `re.fullmatch`,
 *    and the admin JS mirrors it as `^(?:<pattern>)$`
 *    (`stapel-attributes/MODULE.md`, "Pattern contract"). A bare
 *    `RegExp.test` is a PREFIX match, so `^\d{4}$`-less patterns would pass
 *    here and fail there — the mirror telling a person their input is fine
 *    right before the server refuses it.
 *
 * 2. **String length is counted in Unicode CODE POINTS**, on both sides —
 *    same source. JavaScript's `String.length` counts UTF-16 code units, so
 *    one emoji is 2 and one astral CJK ideograph is 2. A `maxLength: 10`
 *    field would refuse ten emoji locally and accept them server-side.
 *
 * ── What the mirror deliberately does NOT judge ────────────────────────────
 *
 * - **A value type it does not know.** An unknown `config.type` may be a
 *   perfectly valid `EXTRA_TYPES` registration whose rules live only in
 *   Python. The mirror runs the type-independent checks (mandatory/empty) and
 *   leaves the rest to the server — a mirror that invented a refusal for a
 *   type it cannot read would block a submit the backend would have accepted.
 *   Whether such a type can be DRAWN is a separate question, answered loudly
 *   by `unsupportedTypes`/`unsupportedTypeGate`.
 *
 * - **`convertible_unit` range.** `min`/`max` are expressed in the unit
 *   family's canonical base unit and the value is converted before comparison
 *   (`stapel_attributes.types.convertible_unit`), and the family table is
 *   Python-side. Mirroring the comparison without the conversion would report
 *   "too large" for a perfectly good number in the other unit system. The
 *   number and the unit code ARE checked; the range is the server's.
 */
import type {
  FeatureDef,
  FeatureValidationResult,
  FeaturesDto,
  FeatureValueDto,
  ValidationBatchResult,
  ValidationErrorCode,
} from "./types.js";
import { featureConfig, featureName, featureType } from "./types.js";
import type { RuleState } from "./rules.js";
import {
  FeatureRulesError,
  VISIBLE_STATE,
  evaluateRules,
  featureRuleState,
  narrowFeature,
} from "./rules.js";
import { ERROR_CODE_TO_KEY } from "./errors.js";

/** `stapel_attributes.types.hex_color.constants.SIMPLE_COLORS` — the closed
 * set of colour categories a `hex_color` value must name. */
export const SIMPLE_COLORS: readonly string[] = [
  "black",
  "white",
  "gray",
  "silver",
  "red",
  "pink",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "brown",
  "gold",
  "beige",
  "turquoise",
  "clear",
  "multicolor",
  "custom",
];

const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const TRUE_STRINGS = new Set(["true", "1", "yes", "on"]);
const FALSE_STRINGS = new Set(["false", "0", "no", "off"]);

/** What a rule reports: the engine's machine code plus the constraint that
 * was violated, exactly as `FeatureValidationError` carries them. */
interface Refusal {
  readonly code: ValidationErrorCode;
  readonly ref_value?: unknown;
}

/** Length in Unicode code points — the unit BOTH sides count in. */
export function codePointLength(text: string): number {
  return [...text].length;
}

/**
 * Does `pattern` match the WHOLE of `text`? `re.fullmatch`, in JavaScript.
 *
 * A pattern JS cannot compile (a Python-only construct) is NOT the person's
 * problem: the mirror stands down and lets the server, which compiled it, be
 * the one to refuse. The `u` flag is tried first because it is what makes `.`
 * and quantifiers count code points rather than surrogate halves, and dropped
 * when a pattern is only valid without it.
 */
export function patternFullMatch(pattern: string, text: string): boolean | undefined {
  const anchored = `^(?:${pattern})$`;
  for (const flags of ["u", ""]) {
    try {
      return new RegExp(anchored, flags).test(text);
    } catch {
      continue;
    }
  }
  return undefined;
}

function num(config: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const raw = config[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function list(config: Readonly<Record<string, unknown>>, key: string): readonly unknown[] {
  const raw = config[key];
  return Array.isArray(raw) ? raw : [];
}

/** An option's value, from either shape the engine's types allow (a bare
 * scalar, or an object with `value`). */
function optionValue(option: unknown): unknown {
  if (option !== null && typeof option === "object" && "value" in option) {
    return (option as { value: unknown }).value;
  }
  return option;
}

/**
 * "Nothing was entered" — the one shape the mandatory rule fires on, and the
 * engine's own predicate: `raw_value is None or raw_value == '' or
 * raw_value == []` (`validation.py`). An explicit `false` is an ANSWER for a
 * `bool`, and `0` is an answer for an `int`, which is why this is not a
 * falsiness check.
 */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// ── "is an answer required here?" — a per-type hook, not an `if` on a slug ───

/**
 * A type that carries its OWN "an answer is required" switch, beside
 * `FeatureDef.mandatory`, and the refusal it produces when the answer is
 * blank.
 *
 * There is exactly one today, and the shape is a TABLE rather than an `if`
 * because the next one must not need this file re-reasoned about: a type
 * plugin's config is the type's business, and `mandatory` is the category's.
 */
interface RequiredRule {
  /** Does this config demand an answer even when `mandatory` is false? */
  required(config: Readonly<Record<string, unknown>>): boolean;
  /** What the server calls the blank answer, so the mirror says the same. */
  refusal(config: Readonly<Record<string, unknown>>): Refusal;
}

const REQUIRED_RULES: Readonly<Record<string, RequiredRule>> = {
  /**
   * `HierarchicalSelectConfig.required` defaults to **True**
   * (`types/hierarchical_select/config.py`), and
   * `HierarchicalSelectFeatureType.validate_dto` raises `MANDATORY_MISSING`
   * on an empty path when it is set — which is the RAISE-style pipeline
   * `stapel_listings.services.publish.publish_listing` runs at publish time
   * (`validate_dto`, not `validate_dto_structured`).
   *
   * Reading only `feature.mandatory`, as this file used to, left the field
   * unmarked and unmirrored: no asterisk, no client-side refusal, and a
   * publish the server rejects for an attribute the form never said was
   * needed. Upstream divergence worth knowing about: the STRUCTURED
   * pipeline behind `POST /categories/{pk}/validate-dto/` short-circuits an
   * empty value on `feature.mandatory` alone and answers `ok`, so preflight
   * and publish disagree server-side. The mirror follows the stricter of the
   * two — the one that can refuse a submit.
   */
  hierarchical_select: {
    required: (config) => config["required"] !== false,
    refusal: () => ({ code: "mandatory_missing" }),
  },
};

/**
 * Is an answer to this feature required — by the CATEGORY (`mandatory`) or by
 * the TYPE's own config?
 *
 * The one predicate both halves read: `validateFeatureValue` refuses a blank
 * answer with it, and `<FeatureFields>` draws the required marker from it, so
 * the asterisk and the refusal can never disagree. `header` is never required:
 * it holds no value at all.
 */
export function featureAnswerRequired(
  feature: FeatureDef,
  values?: Readonly<Record<string, unknown>>
): boolean {
  const type = featureType(feature);
  if (type === "header") return false;
  // With the form's answers in hand, requiredness comes from the RULE STATE —
  // `mandatory` is only half of it since stapel-attributes 0.5.0, and a hidden
  // field is never required no matter how it was flagged. Without them, the
  // static answer, which is what a caller drawing one row out of context has.
  const state =
    values === undefined
      ? { ...VISIBLE_STATE, required: feature.mandatory === true }
      : ruleStateOrStatic(feature, values);
  return requiredUnder(feature, state);
}

/** Requiredness under an already-computed {@link RuleState} — the one place
 * the CATEGORY's answer (`RuleState.required`, which folds `mandatory` and
 * every matching `require` rule) and the TYPE's own switch are combined, so
 * the marker, the mirror and the gate cannot disagree. */
function requiredUnder(feature: FeatureDef, state: RuleState): boolean {
  const type = featureType(feature);
  if (type === "header" || !state.visible) return false;
  if (state.required) return true;
  const rule = type === undefined ? undefined : REQUIRED_RULES[type];
  return rule !== undefined && rule.required(featureConfig(feature));
}

/** The feature's rule state, or the unconditioned one when its `rules` do not
 * parse. A broken rule set is reported as `invalid_rules` by
 * {@link mirrorValidate} and drawn as a notice by `<FeatureFields>`; it must
 * not additionally make a required marker throw mid-render. */
function ruleStateOrStatic(
  feature: FeatureDef,
  values: Readonly<Record<string, unknown>>
): RuleState {
  try {
    return featureRuleState(feature, values);
  } catch (thrown) {
    if (thrown instanceof FeatureRulesError) {
      return { ...VISIBLE_STATE, required: feature.mandatory === true };
    }
    throw thrown;
  }
}

/** The refusal a blank required answer produces — `mandatory_missing` unless
 * the type's own rule names a different code. */
function blankRefusal(feature: FeatureDef): Refusal {
  if (feature.mandatory === true) return { code: "mandatory_missing" };
  const type = featureType(feature);
  const rule = type === undefined ? undefined : REQUIRED_RULES[type];
  return rule === undefined
    ? { code: "mandatory_missing" }
    : rule.refusal(featureConfig(feature));
}

// ── per-type rules ───────────────────────────────────────────────────────────

function validateString(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  const text = typeof value === "string" ? value : String(value);
  const length = codePointLength(text);
  const minLength = num(config, "minLength");
  const maxLength = num(config, "maxLength");
  if (minLength !== undefined && length < minLength) {
    return { code: "below_minimum", ref_value: minLength };
  }
  if (maxLength !== undefined && length > maxLength) {
    return { code: "above_maximum", ref_value: maxLength };
  }
  const pattern = config["pattern"];
  if (typeof pattern === "string" && pattern.length > 0) {
    const matched = patternFullMatch(pattern, text);
    if (matched === false) return { code: "invalid_format", ref_value: pattern };
  }
  const options = list(config, "options");
  // `allowCustom` absent means TRUE for `string` (the dataclass default), so
  // an options list without an explicit `allowCustom: false` constrains
  // nothing. Reading an absent key as "closed set" would refuse values the
  // server accepts.
  if (options.length > 0 && config["allowCustom"] === false) {
    if (!options.some((option) => optionValue(option) === text)) {
      return { code: "not_in_options", ref_value: [...options].map(optionValue) };
    }
  }
  return undefined;
}

function validateNumber(
  config: Readonly<Record<string, unknown>>,
  value: unknown,
  isInt: boolean
): Refusal | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  if (typeof value === "boolean" || !Number.isFinite(parsed)) {
    return { code: "invalid_type" };
  }
  // `int`'s normalizer is Python's `int()`, which TRUNCATES toward zero
  // rather than refusing a fractional input — so the range check runs on the
  // truncated number, exactly as it does server-side.
  const number = isInt ? Math.trunc(parsed) : parsed;
  const min = num(config, "min");
  const max = num(config, "max");
  if (min !== undefined && number < min) return { code: "below_minimum", ref_value: min };
  if (max !== undefined && number > max) return { code: "above_maximum", ref_value: max };
  const options = list(config, "options");
  if (options.length > 0 && config["allowCustom"] === false) {
    const precision = isInt ? 0 : (num(config, "precision") ?? 2);
    const round = (n: number): number => Number(n.toFixed(precision));
    if (!options.some((option) => round(Number(optionValue(option))) === round(number))) {
      return { code: "not_in_options", ref_value: [...options].map(optionValue) };
    }
  }
  return undefined;
}

function validateBool(value: unknown): Refusal | undefined {
  if (typeof value === "boolean") return undefined;
  if (typeof value === "number") return undefined; // bool(n), server-side
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    return TRUE_STRINGS.has(lower) || FALSE_STRINGS.has(lower)
      ? undefined
      : { code: "invalid_type" };
  }
  return { code: "invalid_type" };
}

function validateSelect(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  if (!Array.isArray(value)) return { code: "invalid_type" };
  const minSelected = num(config, "minSelected") ?? 0;
  const maxSelected = num(config, "maxSelected");
  if (value.length < minSelected) {
    return { code: "below_minimum", ref_value: minSelected };
  }
  if (maxSelected !== undefined && value.length > maxSelected) {
    return { code: "above_maximum", ref_value: maxSelected };
  }
  if (new Set(value).size !== value.length) return { code: "invalid_format" };
  const allowed = list(config, "options").map((option) => optionValue(option));
  for (const item of value) {
    if (typeof item !== "string") return { code: "invalid_type" };
    if (!allowed.includes(item)) {
      return {
        code: "not_in_options",
        ref_value: [...allowed].map(String).sort(),
      };
    }
  }
  return undefined;
}

/**
 * `ref_select` — SHAPE and CARDINALITY only.
 *
 * Whether a code exists in the vocabulary, and whether it is a child of the
 * parent feature's term, is the server's (`resolver.exists` / `is_child`); the
 * browser has neither the table nor the authority, and a mirror that guessed
 * would refuse a code the server accepts. What it CAN say is exactly what the
 * engine says before it reaches the resolver: a list of strings, no
 * duplicates, within `minSelected`/`maxSelected`.
 *
 * `maxSelected` ABSENT means **1** here — the engine's own default for this
 * type, and the opposite of `select`, where absent means unlimited. Reading it
 * as unlimited would let a person pick three models and be refused on submit.
 * An explicit `null` is the unlimited one.
 */
function validateRefSelect(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  if (!Array.isArray(value)) return { code: "invalid_type" };
  if (!value.every((item) => typeof item === "string")) return { code: "invalid_type" };
  const minSelected = num(config, "minSelected") ?? 0;
  if (value.length < minSelected) {
    return { code: "below_minimum", ref_value: minSelected };
  }
  const declaredMax = config["maxSelected"];
  const maxSelected = declaredMax === null ? undefined : (num(config, "maxSelected") ?? 1);
  if (maxSelected !== undefined && value.length > maxSelected) {
    return { code: "above_maximum", ref_value: maxSelected };
  }
  if (new Set(value).size !== value.length) return { code: "invalid_format" };
  return undefined;
}

/** `ref_hierarchical_select` — the DEPTH of the code path. Same division of
 * labour as {@link validateRefSelect}: existence and the parent chain are the
 * resolver's, the path's length is not. An absent `maxDepth` means the whole
 * `levels` chain, which is the engine's own fallback. */
function validateRefHierarchicalSelect(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  if (!Array.isArray(value)) return { code: "invalid_type" };
  if (!value.every((item) => typeof item === "string")) return { code: "invalid_type" };
  const minDepth = num(config, "minDepth") ?? 1;
  if (value.length < minDepth) return { code: "below_minimum", ref_value: minDepth };
  const levels = list(config, "levels");
  const maxDepth = num(config, "maxDepth") ?? (levels.length > 0 ? levels.length : undefined);
  if (maxDepth !== undefined && value.length > maxDepth) {
    return { code: "above_maximum", ref_value: maxDepth };
  }
  return undefined;
}

function validateDate(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  // The engine's `normalize_dto` coerces int/float/numeric-string to an int
  // and turns ANYTHING else into `None`, which its `validate_dto` then
  // accepts. So a garbage date is silently dropped rather than refused — a
  // known upstream wart, mirrored rather than "improved", because a mirror
  // that refuses what the server accepts is a mirror that blocks a valid
  // submit. (`stapel_attributes.types.date.type.DateFeatureType`.)
  const timestamp =
    typeof value === "number" && Number.isFinite(value)
      ? Math.trunc(value)
      : typeof value === "string" && /^-?\d+$/.test(value.trim())
        ? Number.parseInt(value.trim(), 10)
        : undefined;
  if (timestamp === undefined) return undefined;
  const now = Math.floor(Date.now() / 1000);
  if (config["allowFuture"] === false && timestamp > now) {
    return { code: "above_maximum", ref_value: now };
  }
  if (config["allowPast"] === false && timestamp < now) {
    return { code: "below_minimum", ref_value: now };
  }
  const minDate = num(config, "minDate");
  const maxDate = num(config, "maxDate");
  if (minDate !== undefined && timestamp < minDate) {
    return { code: "below_minimum", ref_value: minDate };
  }
  if (maxDate !== undefined && timestamp > maxDate) {
    return { code: "above_maximum", ref_value: maxDate };
  }
  return undefined;
}

function validateHexColor(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return { code: "invalid_type" };
  }
  const entry = value as { hex?: unknown; simple?: unknown };
  if (entry.hex !== undefined && entry.hex !== null) {
    if (typeof entry.hex !== "string") return { code: "invalid_type" };
    const hex = entry.hex.trim();
    if (hex.length > 0 && !HEX_PATTERN.test(hex)) return { code: "invalid_format" };
  }
  if (entry.simple === undefined || entry.simple === null || entry.simple === "") {
    return { code: "invalid_format" };
  }
  if (typeof entry.simple !== "string") return { code: "invalid_type" };
  if (!SIMPLE_COLORS.includes(entry.simple)) {
    return { code: "not_in_options", ref_value: [...SIMPLE_COLORS] };
  }
  const options = list(config, "options");
  if (options.length > 0 && config["allowCustom"] !== true) {
    const matched = options.some(
      (option) =>
        option !== null &&
        typeof option === "object" &&
        (option as { simple?: unknown }).simple === entry.simple
    );
    if (!matched) {
      return {
        code: "not_in_options",
        ref_value: options.map((option) =>
          option !== null && typeof option === "object"
            ? (option as { simple?: unknown }).simple
            : option
        ),
      };
    }
  }
  return undefined;
}

function findOption(
  options: readonly unknown[],
  value: string
): { readonly children?: unknown } | undefined {
  for (const option of options) {
    if (option !== null && typeof option === "object") {
      if ((option as { value?: unknown }).value === value) {
        return option as { children?: unknown };
      }
    } else if (option === value) {
      return {};
    }
  }
  return undefined;
}

function validateHierarchicalSelect(
  config: Readonly<Record<string, unknown>>,
  value: unknown
): Refusal | undefined {
  if (!Array.isArray(value)) return { code: "invalid_type" };
  if (value.length === 0) return undefined; // the empty pre-check already ruled
  const minDepth = num(config, "minDepth") ?? 1;
  const maxDepth = num(config, "maxDepth");
  if (value.length < minDepth) return { code: "below_minimum", ref_value: minDepth };
  if (maxDepth !== undefined && value.length > maxDepth) {
    return { code: "above_maximum", ref_value: maxDepth };
  }
  let level: readonly unknown[] = list(config, "options");
  for (const step of value) {
    if (typeof step !== "string") return { code: "invalid_type" };
    const option = findOption(level, step);
    if (option === undefined) {
      return { code: "not_in_options", ref_value: level.map(optionValue) };
    }
    level = Array.isArray(option.children) ? option.children : [];
  }
  return undefined;
}

function validateConvertibleUnit(
  config: Readonly<Record<string, unknown>>,
  dto: FeatureValueDto
): Refusal | undefined {
  if (dto.value !== null && dto.value !== undefined) {
    const parsed = typeof dto.value === "number" ? dto.value : Number(dto.value);
    if (typeof dto.value === "boolean" || !Number.isFinite(parsed)) {
      return { code: "invalid_type" };
    }
  }
  const unit = dto["unit"];
  if (unit === undefined || unit === null) return undefined;
  const allowed = [config["unit_m"], config["unit_i"]].filter(
    (code): code is string => typeof code === "string" && code.length > 0
  );
  if (!allowed.includes(String(unit))) {
    return { code: "not_in_options", ref_value: allowed };
  }
  // `min`/`max` are in the family's BASE unit and the conversion table is
  // server-side — see this module's header.
  return undefined;
}

/**
 * Validate one submitted value against its feature's config. Returns the
 * mirrored refusal, or `undefined` when this side of the wire is satisfied.
 *
 * `header` is never validated: the engine regenerates a header's DAO from its
 * config and skips it outright in the batch validator, so a header has
 * nothing to check and must never carry a value.
 */
export function validateFeatureValue(
  feature: FeatureDef,
  dto: FeatureValueDto,
  values?: Readonly<Record<string, unknown>>
): FeatureValidationResult | undefined {
  const type = featureType(feature);
  if (type === "header") return undefined;
  const config = featureConfig(feature);

  if (isBlank(dto.value)) {
    return featureAnswerRequired(feature, values)
      ? failed(feature, blankRefusal(feature))
      : ok(feature);
  }

  const refusal = ((): Refusal | undefined => {
    switch (type) {
      case "string":
        return validateString(config, dto.value);
      case "int":
        return validateNumber(config, dto.value, true);
      case "float":
        return validateNumber(config, dto.value, false);
      case "bool":
        return validateBool(dto.value);
      case "select":
        return validateSelect(config, dto.value);
      case "date":
        return validateDate(config, dto.value);
      case "hex_color":
        return validateHexColor(config, dto.value);
      case "hierarchical_select":
        return validateHierarchicalSelect(config, dto.value);
      case "ref_select":
        return validateRefSelect(config, dto.value);
      case "ref_hierarchical_select":
        return validateRefHierarchicalSelect(config, dto.value);
      case "convertible_unit":
        return validateConvertibleUnit(config, dto);
      default:
        // An unknown type is the server's to judge — see the module header.
        return undefined;
    }
  })();

  return refusal === undefined ? ok(feature) : failed(feature, refusal);
}

function ok(feature: FeatureDef): FeatureValidationResult {
  return {
    slug: feature.slug,
    status: "ok",
    ...(feature.id === undefined || feature.id === null ? {} : { id: feature.id }),
  };
}

function failed(feature: FeatureDef, refusal: Refusal): FeatureValidationResult {
  return {
    slug: feature.slug,
    status: "validation_failed",
    error: refusal.code,
    localizable_error: ERROR_CODE_TO_KEY[refusal.code],
    // The engine's own params, verbatim: `{feature, slug}`. `field` is added
    // later, by `featureErrorsBySlug`, so the mirror's rows and the server's
    // rows go through the same one step.
    params: { feature: featureName(feature), slug: feature.slug },
    ...(feature.id === undefined || feature.id === null ? {} : { id: feature.id }),
    ...(refusal.ref_value === undefined ? {} : { ref_value: refusal.ref_value }),
  };
}

/**
 * Validate a whole answer set against a category's features — the client-side
 * twin of `POST /categories/{pk}/validate-dto/`.
 *
 * Mirrors the engine's pre-pass and its two loops, because the order is what a
 * caller sees:
 *
 *  0. `evaluateRules(features, dto)` ONCE. A feature the rules hide is not
 *     validated and does not have to be answered; requiredness is
 *     `RuleState.required`, never `mandatory` alone.
 *  1. every SUBMITTED entry whose slug the category allows (an unknown slug is
 *     ignored, not refused — the engine's documented behaviour), against its
 *     config NARROWED by that state: a forbidden option therefore comes back
 *     as `not_in_options` and a tightened bound as `above_maximum`, through
 *     the ordinary per-type rules and with no error vocabulary of its own.
 *  2. every allowed feature that was never submitted, of which only a REQUIRED
 *     non-header one produces a row.
 *
 * A rule set that breaks the grammar fails the whole batch on `_root` with
 * `invalid_rules` — exactly as `validate_dto_structured` does. The SCHEMA is
 * broken, not the payload, and refusing per-field would tell a person to fix
 * a value that is fine.
 */
export function mirrorValidate(
  features: readonly FeatureDef[],
  dto: FeaturesDto
): ValidationBatchResult {
  const bySlug = new Map<string, FeatureDef>();
  for (const feature of features) {
    bySlug.set(feature.slug, feature);
    if (feature.id !== undefined && feature.id !== null) {
      bySlug.set(String(feature.id), feature);
    }
  }

  let states: Readonly<Record<string, RuleState>>;
  try {
    states = evaluateRules(features, dto);
  } catch (thrown) {
    if (!(thrown instanceof FeatureRulesError)) throw thrown;
    return {
      valid: false,
      results: [
        {
          slug: "_root",
          status: "validation_failed",
          error: "invalid_rules",
          localizable_error: ERROR_CODE_TO_KEY["invalid_rules"],
          params: { feature: thrown.slug ?? "_root", slug: thrown.slug ?? "_root" },
          message: thrown.message,
        },
      ],
    };
  }
  const stateOf = (feature: FeatureDef): RuleState => states[feature.slug] ?? VISIBLE_STATE;

  const results: FeatureValidationResult[] = [];
  const seen = new Set<string>();

  for (const [key, entry] of Object.entries(dto)) {
    const feature = bySlug.get(key);
    if (feature === undefined) continue; // unknown slug — ignored, per the engine
    seen.add(feature.slug);
    const state = stateOf(feature);
    // Hidden by a rule: silently accepted and dropped from the DAO. Reporting
    // a refusal for a control that is not on screen would send a person
    // looking for a field they cannot see.
    if (!state.visible) {
      results.push(ok(feature));
      continue;
    }
    if (featureType(feature) === "header") continue; // auto-generated, never answered
    // The empty check runs BEFORE the type's, exactly as the engine orders it:
    // a normalizer coerces an empty value into a valid one (`int` None -> 0)
    // and `normalize_to_dao` then drops it, so a required feature submitted
    // blank would pass validation and vanish from the DAO.
    if (isBlank(entry.value)) {
      results.push(
        requiredUnder(feature, state) ? failed(feature, blankRefusal(feature)) : ok(feature)
      );
      continue;
    }
    const result = validateFeatureValue(narrowFeature(feature, state), entry);
    if (result !== undefined) results.push(result);
  }

  for (const feature of features) {
    if (seen.has(feature.slug)) continue;
    if (featureType(feature) === "header") continue;
    if (!requiredUnder(feature, stateOf(feature))) continue;
    results.push(failed(feature, blankRefusal(feature)));
  }

  return {
    valid: results.every((result) => result.status === "ok"),
    results,
  };
}
