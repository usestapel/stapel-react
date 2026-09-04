/**
 * Conditional feature RULES — the browser half of `stapel_attributes.rules`.
 *
 * A rule is a sibling of `mandatory` on a `FeatureDef`, never part of
 * `config`: `config` is parsed by a strict per-type serializer, while a rule
 * speaks only about *other* features' submitted values. The grammar is closed
 * on purpose — five effects, four operators, two connectives, no nesting — so
 * the same semantics are provable in two languages against ONE shared corpus.
 *
 * That corpus is not a metaphor: `test/fixtures/rules-corpus/index.json` is a
 * generated copy of `stapel-attributes/tests/golden/rules/`, whose `expect`
 * blocks Python RECORDS from its own evaluator, and `test/rules.golden.test.ts`
 * runs every one of them through the functions below. Two evaluators cannot
 * agree by review; they can only agree by being measured against the same
 * file.
 *
 * ── The three decisions this file must not soften ──────────────────────────
 *
 *  1. **One pass, no fixed point.** A controlling feature's own visibility is
 *     never consulted, so a rule cycle is impossible by construction and the
 *     result is deterministic. A controlling slug that the FEATURE SET does
 *     not define reads as `empty` — even when `values` carries one under that
 *     key — because a feature is reused across categories with different field
 *     sets, and the engine reads its inputs off the definitions.
 *  2. **`narrowConfig` REPLACES, it does not introduce.** A `limit` rule
 *     overwrites a `min`/`max` the config already declares and adds neither.
 *     A rule may tighten what a catalogue offered; it may not invent a bound
 *     for a type whose config never had one.
 *  3. **A malformed rule set is an ERROR, not "no rules".** {@link parseRules}
 *     throws {@link FeatureRulesError} exactly where Python raises
 *     `FeatureValidationError(code=INVALID_RULES)`. Swallowing it would draw a
 *     field as unconditionally optional because its `require` rule had a typo
 *     — the loudest possible way to lose a mandatory answer silently.
 *
 * React-free and antd-free: this is the main entry, and a card formatting a
 * value must not pull a rule engine's UI along.
 */
import type { Cond, FeatureDef, Rule } from "./types.js";
import { featureConfig, featureType } from "./types.js";

export const RULE_EFFECTS: readonly string[] = [
  "require",
  "show",
  "hide",
  "forbid_option",
  "limit",
];
export const RULE_OPERATORS: readonly string[] = ["in", "not_in", "filled", "empty"];
export const RULE_CONNECTIVES: readonly string[] = ["all", "any"];

const VALUE_OPS = new Set(["in", "not_in"]);
const RULE_KEYS = new Set(["effect", "when", "option", "min", "max"]);
const COND_KEYS = new Set(["feature", "op", "values"]);

/**
 * A rule set that breaks the closed grammar — the client twin of
 * `FeatureValidationError(code=ValidationErrorCode.INVALID_RULES)`.
 *
 * It carries the engine's own machine code and localizable key, so a caller
 * surfaces it through the same channel as any other refusal instead of
 * inventing a sentence for it.
 */
export class FeatureRulesError extends Error {
  readonly code = "invalid_rules" as const;
  readonly localizable_error = "error.400.feature_invalid_rules";
  /** The feature whose rules are broken, when the caller was iterating one. */
  readonly slug: string | undefined;

  constructor(message: string, slug?: string) {
    super(message);
    this.name = "FeatureRulesError";
    this.slug = slug;
  }
}

// ── grammar (§1.1) ───────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function unknownKeys(raw: Record<string, unknown>, allowed: ReadonlySet<string>): string[] {
  return Object.keys(raw)
    .filter((key) => !allowed.has(key))
    .sort();
}

function parseCond(raw: unknown, where: string): Cond {
  if (!isRecord(raw)) throw new FeatureRulesError(`${where}: condition must be an object`);
  const unknown = unknownKeys(raw, COND_KEYS);
  if (unknown.length > 0) {
    throw new FeatureRulesError(`${where}: unknown condition key(s): ${unknown.join(", ")}`);
  }
  const feature = raw["feature"];
  if (typeof feature !== "string" || feature.length === 0) {
    throw new FeatureRulesError(`${where}: condition needs a non-empty 'feature' slug`);
  }
  const op = raw["op"];
  if (typeof op !== "string" || !RULE_OPERATORS.includes(op)) {
    throw new FeatureRulesError(`${where}: 'op' must be one of ${RULE_OPERATORS.join(", ")}`);
  }
  if (VALUE_OPS.has(op)) {
    const values = raw["values"];
    if (!Array.isArray(values) || values.length === 0) {
      throw new FeatureRulesError(`${where}: '${op}' needs a non-empty 'values' list`);
    }
    if (!values.every((one) => typeof one === "string")) {
      throw new FeatureRulesError(`${where}: 'values' must be strings`);
    }
    return { feature, op: op as Cond["op"], values: values as readonly string[] };
  }
  if ("values" in raw) throw new FeatureRulesError(`${where}: '${op}' takes no 'values'`);
  return { feature, op: op as Cond["op"] };
}

function parseWhen(raw: unknown, where: string): Rule["when"] {
  if (!isRecord(raw)) throw new FeatureRulesError(`${where}: 'when' must be an object`);
  const unknown = unknownKeys(raw, new Set(RULE_CONNECTIVES));
  if (unknown.length > 0) {
    throw new FeatureRulesError(`${where}: unknown 'when' key(s): ${unknown.join(", ")}`);
  }
  const modes = RULE_CONNECTIVES.filter((mode) => mode in raw);
  if (modes.length !== 1) {
    throw new FeatureRulesError(`${where}: 'when' must have exactly one of 'all' / 'any'`);
  }
  const mode = modes[0] as "all" | "any";
  const conds = raw[mode];
  if (!Array.isArray(conds) || conds.length === 0) {
    throw new FeatureRulesError(
      `${where}: 'when.${mode}' must be a non-empty list of conditions`
    );
  }
  const parsed = conds.map((cond, index) => parseCond(cond, `${where}.${mode}[${index}]`));
  return mode === "all" ? { all: parsed } : { any: parsed };
}

/**
 * Raw `FeatureDef.rules` → validated rules. `undefined`/`null`/`[]` all parse
 * to `[]`; anything outside the grammar throws {@link FeatureRulesError} —
 * unknown keys, a missing or ambiguous connective, an empty condition list,
 * `values` on `filled`/`empty` (or missing on `in`/`not_in`), `option`
 * anywhere but on `forbid_option`, `min`/`max` anywhere but on `limit`.
 */
export function parseRules(raw: unknown, slug?: string): readonly Rule[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) throw new FeatureRulesError("'rules' must be a list", slug);
  const parsed: Rule[] = [];
  raw.forEach((item, index) => {
    const where = `rules[${index}]`;
    if (!isRecord(item)) throw new FeatureRulesError(`${where}: rule must be an object`, slug);
    const unknown = unknownKeys(item, RULE_KEYS);
    if (unknown.length > 0) {
      throw new FeatureRulesError(`${where}: unknown rule key(s): ${unknown.join(", ")}`, slug);
    }
    const effect = item["effect"];
    if (typeof effect !== "string" || !RULE_EFFECTS.includes(effect)) {
      throw new FeatureRulesError(
        `${where}: 'effect' must be one of ${RULE_EFFECTS.join(", ")}`,
        slug
      );
    }
    if (!("when" in item)) throw new FeatureRulesError(`${where}: 'when' is required`, slug);
    let when: Rule["when"];
    try {
      when = parseWhen(item["when"], where);
    } catch (thrown) {
      throw thrown instanceof FeatureRulesError
        ? new FeatureRulesError(thrown.message, slug)
        : thrown;
    }
    const option = item["option"];
    if (effect === "forbid_option") {
      if (typeof option !== "string" || option.length === 0) {
        throw new FeatureRulesError(
          `${where}: 'forbid_option' needs a non-empty 'option'`,
          slug
        );
      }
    } else if ("option" in item) {
      throw new FeatureRulesError(
        `${where}: 'option' is only allowed on 'forbid_option'`,
        slug
      );
    }
    const hasMin = "min" in item;
    const hasMax = "max" in item;
    if (effect === "limit") {
      if (!hasMin && !hasMax) {
        throw new FeatureRulesError(`${where}: 'limit' needs at least one of 'min' / 'max'`, slug);
      }
      for (const key of ["min", "max"] as const) {
        if (key in item && !isNumber(item[key])) {
          throw new FeatureRulesError(`${where}: '${key}' must be a number`, slug);
        }
      }
    } else if (hasMin || hasMax) {
      throw new FeatureRulesError(
        `${where}: 'min' / 'max' are only allowed on 'limit'`,
        slug
      );
    }
    parsed.push({
      effect: effect as Rule["effect"],
      when,
      ...(effect === "forbid_option" ? { option: option as string } : {}),
      ...(effect === "limit" && hasMin ? { min: item["min"] as number } : {}),
      ...(effect === "limit" && hasMax ? { max: item["max"] as number } : {}),
    });
  });
  return parsed;
}

/** Every feature whose `rules` break the grammar, slug → why. Empty when the
 * whole set parses — which is the common case, so this allocates nothing then.
 *
 * The list form exists because {@link evaluateRules} mirrors Python and
 * THROWS: a renderer has to keep drawing the other twelve fields while saying
 * that one of them is misconfigured, and it cannot do that from an exception
 * that took the whole pre-pass down. */
export function ruleErrors(
  features: readonly FeatureDef[]
): Readonly<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const feature of features) {
    if (featureType(feature) === "header") continue;
    try {
      parseRules(feature.rules, feature.slug);
    } catch (thrown) {
      out[feature.slug] =
        thrown instanceof FeatureRulesError ? thrown.message : String(thrown);
    }
  }
  return out;
}

// ── value canonicalization (§1.2) ────────────────────────────────────────────

/** `1e+21` / `1.5e-07` → the digits written out. Python's `repr` switches to
 * an exponent at a different magnitude than JavaScript's `String`, and
 * `stringify` compares STRINGS, so both sides expand. */
function expandExponent(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (match === null) return text;
  const [, sign = "", whole = "", fraction = "", exponent = "0"] = match;
  const digits = whole + fraction;
  const point = whole.length + Number.parseInt(exponent, 10);
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${"0".repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** `stapel_attributes.rules._number_to_str`. An integral value prints every
 * digit (`BigInt`, which is what Python's `int(float)` does — both round the
 * double to the same exact integer); a fractional one keeps the shortest
 * round-tripping decimal, expanded out of exponent notation. */
function numberToString(value: number): string {
  if (Number.isInteger(value)) return BigInt(value).toString();
  return expandExponent(String(value));
}

/**
 * Canonicalize a submitted value into the list of strings rules compare
 * (§1.2 — the table is fixed and shared with Python):
 *
 * ```
 * null / undefined / '' / []      -> []
 * boolean                         -> ['true'] / ['false']
 * number                          -> ['12'] (integral) / ['2.5'] (shortest)
 * string                          -> [value]        (never trimmed)
 * array                           -> concatenation of the elements
 * {value: …} (a DTO envelope)     -> stringify(value)
 * any other object                -> []
 * ```
 *
 * `false` is FILLED: it canonicalizes to `['false']`, not `[]`. So is `0`.
 */
export function stringify(value: unknown): readonly string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "boolean") return [value ? "true" : "false"];
  if (typeof value === "number") return Number.isFinite(value) ? [numberToString(value)] : [];
  if (typeof value === "string") return value === "" ? [] : [value];
  if (Array.isArray(value)) return value.flatMap((item) => stringify(item));
  if (isRecord(value)) return "value" in value ? stringify(value["value"]) : [];
  return [];
}

// ── semantics (§1.3) ─────────────────────────────────────────────────────────

/** The effect of every matching rule on one feature — `stapel_attributes
 * .rules.RuleState`. `min`/`max` are `null` (not `undefined`) so the shape
 * round-trips through the shared JSON corpus unchanged. */
export interface RuleState {
  readonly visible: boolean;
  readonly required: boolean;
  /** Option codes a matching `forbid_option` rule removed, sorted. */
  readonly forbiddenOptions: readonly string[];
  readonly min: number | null;
  readonly max: number | null;
}

/** The state of a feature no rule touches — visible, not required, unbounded.
 * Also the fallback for a slug the pre-pass produced no state for. */
export const VISIBLE_STATE: RuleState = {
  visible: true,
  required: false,
  forbiddenOptions: [],
  min: null,
  max: null,
};

/** `RuleState` in the shared corpus's own spelling (`RuleState.to_dict()`) —
 * snake_case, `forbidden_options` sorted. The one place the two namings meet,
 * so the golden test compares JSON rather than a hand-mapped object. */
export function ruleStateToJson(state: RuleState): {
  visible: boolean;
  required: boolean;
  forbidden_options: string[];
  min: number | null;
  max: number | null;
} {
  return {
    visible: state.visible,
    required: state.required,
    forbidden_options: [...state.forbiddenOptions],
    min: state.min,
    max: state.max,
  };
}

function condMatches(cond: Cond, strings: readonly string[]): boolean {
  if (cond.op === "filled") return strings.length > 0;
  if (cond.op === "empty") return strings.length === 0;
  // A VALUE predicate is false of a value that is not there. "The answer is
  // not X" is not something you can say truthfully about a field nobody has
  // answered, and saying it starred a field whose stated precondition had not
  // happened. `empty` / `filled` exist for the question about absence, and
  // `any: [empty, not_in]` spells "unanswered, or not X" explicitly.
  if (strings.length === 0) return false;
  const values = cond.values ?? [];
  const hit = strings.some((one) => values.includes(one));
  return cond.op === "in" ? hit : !hit;
}

function whenMatches(when: Rule["when"], read: (slug: string) => readonly string[]): boolean {
  const conds = when.all ?? when.any ?? [];
  const matched = conds.map((cond) => condMatches(cond, read(cond.feature)));
  return when.all !== undefined ? matched.every(Boolean) : matched.some(Boolean);
}

/** The state of ONE feature against a reading function. Shared by the corpus
 * evaluator and by {@link featureRuleState}, so the two cannot drift. */
function stateOf(feature: FeatureDef, read: (slug: string) => readonly string[]): RuleState {
  if (featureType(feature) === "header") return VISIBLE_STATE;
  const rules = parseRules(feature.rules, feature.slug);
  const matched = rules.filter((rule) => whenMatches(rule.when, read));
  const hasShow = rules.some((rule) => rule.effect === "show");
  const visible =
    !matched.some((rule) => rule.effect === "hide") &&
    (!hasShow || matched.some((rule) => rule.effect === "show"));
  const required =
    visible &&
    (feature.mandatory === true || matched.some((rule) => rule.effect === "require"));
  const forbidden = new Set<string>();
  for (const rule of matched) {
    if (rule.effect === "forbid_option" && rule.option) forbidden.add(rule.option);
  }
  // The LAST matching limit rule wins, and it REPLACES both bounds — limits do
  // not intersect. A later rule carrying only `max` therefore clears a `min`
  // an earlier one set, which is the corpus case `limit-last-matching-wins`.
  let min: number | null = null;
  let max: number | null = null;
  for (const rule of matched) {
    if (rule.effect !== "limit") continue;
    min = rule.min ?? null;
    max = rule.max ?? null;
  }
  return { visible, required, forbiddenOptions: [...forbidden].sort(), min, max };
}

/**
 * Does one rule's condition hold against a form's answers?
 *
 * Exported for {@link featureBounds}, which needs to know not only THAT a
 * `limit` matched but WHICH rule did — the state carries the numbers and
 * forgets where they came from, and "from 2018 to 2024" beside a year field
 * is a different sentence from "for this generation, from 2018 to 2024".
 * Reads answers straight off `values`, like {@link featureRuleState}.
 */
export function ruleWhenMatches(
  when: Rule["when"],
  values: Readonly<Record<string, unknown>> | undefined
): boolean {
  const raw = values ?? {};
  return whenMatches(when, (slug) => stringify(raw[slug]));
}

/** The controlling slugs one rule's condition names, in the order it states
 * them and without duplicates — the fields whose answers a hint has to name. */
export function conditionSlugs(when: Rule["when"]): readonly string[] {
  const conds = when.all ?? when.any ?? [];
  return [...new Set(conds.map((cond) => cond.feature))];
}

/**
 * Evaluate every feature's rules against `values` in one pass (§1.3).
 *
 * ```
 * visible  = no matching hide AND (no show rules OR some show matched)
 * required = visible AND (mandatory OR some require matched)
 * forbiddenOptions = every matched forbid_option's option
 * min/max  = the LAST matched limit rule, replacing (not intersecting)
 * ```
 *
 * `values` is `{slug: raw}` and also accepts the DTO envelope
 * `{slug: {type, value}}` ({@link stringify} unwraps it). A `header` is always
 * visible and never required. **Throws** {@link FeatureRulesError} when any
 * feature's rules break the grammar — see {@link ruleErrors} for the form a
 * renderer needs.
 */
export function evaluateRules(
  features: readonly FeatureDef[],
  values: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, RuleState>> {
  const raw = values ?? {};
  // Readings come from the DEFINITIONS, not from the payload: a controlling
  // slug the feature set does not declare reads as `empty` even when `values`
  // carries one under that key. That is the engine's own behaviour and the
  // corpus case `unknown-controlling-slug-in` pins it.
  const readings = new Map<string, readonly string[]>();
  for (const feature of features) readings.set(feature.slug, stringify(raw[feature.slug]));
  const read = (slug: string): readonly string[] => readings.get(slug) ?? [];

  const out: Record<string, RuleState> = {};
  for (const feature of features) out[feature.slug] = stateOf(feature, read);
  return out;
}

/**
 * One feature's state against a form's current answers — what a caller holding
 * a single row (a required marker, an editor) needs without the whole set.
 *
 * The one difference from {@link evaluateRules}, stated because it is a
 * difference: a controlling slug is read straight off `values` rather than off
 * a definition list this call does not have. In a form that is the same thing
 * — `values` is keyed by the slugs of the very features being drawn — and it
 * is the only reading available to a caller with one `FeatureDef` in hand.
 */
export function featureRuleState(
  feature: FeatureDef,
  values: Readonly<Record<string, unknown>> | undefined
): RuleState {
  const raw = values ?? {};
  return stateOf(feature, (slug) => stringify(raw[slug]));
}

// ── pipeline embedding (§1.4) ────────────────────────────────────────────────

/**
 * Apply a {@link RuleState} to a raw config, type-agnostically — the whole of
 * how rules reach a value type.
 *
 * Two shape-level edits and no type knowledge: options whose `value` is
 * forbidden are removed, and an EXISTING `min`/`max` is replaced by the
 * state's. The narrowed config then goes down the ordinary path, so `select`
 * refuses a forbidden option as `not_in_options` and `int` reports
 * `above_maximum` — the rule engine adds no error vocabulary of its own, and a
 * host-registered type gets rules for free.
 *
 * **`min`/`max` are replaced, never introduced.** A `limit` rule on a type
 * whose config declares no bound is a no-op: a rule may tighten what the
 * catalogue offered, and inventing a bound for a `string` (whose `min` means
 * nothing) would refuse a value the server accepts.
 *
 * The input is never mutated; an unchanged config is returned as-is, so the
 * common case keeps its object identity and the editor below it does not
 * re-render.
 */
export function narrowConfig<T>(config: T, state: RuleState): T {
  if (!isRecord(config)) return config;
  let changed = false;
  const out: Record<string, unknown> = { ...config };

  if (state.forbiddenOptions.length > 0 && Array.isArray(out["options"])) {
    const options = out["options"] as readonly unknown[];
    const kept = options.filter(
      (option) =>
        !(
          isRecord(option) &&
          typeof option["value"] === "string" &&
          state.forbiddenOptions.includes(option["value"])
        )
    );
    if (kept.length !== options.length) {
      out["options"] = kept;
      changed = true;
    }
  }

  for (const bound of ["min", "max"] as const) {
    const limit = state[bound];
    if (limit !== null && bound in out) {
      out[bound] = limit;
      changed = true;
    }
  }

  return changed ? (out as T) : config;
}

/** A feature with its config narrowed by its rule state — what
 * `<FeatureFields>` hands an editor so editors stay rule-unaware. Returns the
 * feature itself when nothing was narrowed. */
export function narrowFeature(feature: FeatureDef, state: RuleState): FeatureDef {
  const config = narrowConfig(featureConfig(feature), state);
  return config === feature.config ? feature : { ...feature, config };
}
