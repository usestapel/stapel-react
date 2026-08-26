/**
 * The subscription filter, validated in the browser before it is sent.
 *
 * ── Why the client owns a copy of the grammar ─────────────────────────────
 *
 * The backend's refusal is ONE code — `error.400.webhooks_invalid_filter`,
 * "The filter is not a valid payload predicate" — with no position, no key and
 * no operator name (`filters.py` raises `InvalidFilter` with a readable
 * message, `errors.py` flattens it). A person authoring a predicate in a text
 * area gets that sentence back and has to bisect their own JSON. So the
 * grammar in `filters.py:validate_filter` is ported here, refusal for refusal,
 * and each refusal NAMES what it saw.
 *
 * This is not a second source of truth: the server still validates, still has
 * the final word, and `isInvalidFilter` (model/refusals.ts) renders its answer
 * when the two ever disagree. What the port buys is the sentence "unknown
 * operator `$regex` at `city`" instead of "the filter is invalid".
 *
 * ── The refusals that are deliberate ──────────────────────────────────────
 *
 * No regular expressions (a predicate is evaluated once per matching event in
 * the dispatcher — a regex there is a backtracking lever pointed at every
 * other subscriber), no expressions, and bounded nesting. `{"city": null}`
 * matches a payload whose `city` IS null; `{"city": {"$exists": false}}` is
 * how "lacks the key" is spelled. Conflating them is how a filter silently
 * widens, so neither the grammar nor this port has a shorthand for it.
 */

/** Group operators — the only `$` keys allowed at predicate level. */
export const FILTER_GROUP_OPS = ["$or", "$and", "$not"] as const;

/** Value operators, per field. */
export const FILTER_FIELD_OPS = [
  "$eq",
  "$ne",
  "$in",
  "$nin",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$exists",
  "$contains",
  "$prefix",
] as const;

/**
 * `STAPEL_WEBHOOKS["MAX_FILTER_DEPTH"]`, whose default is 4 (`conf.py`). Not
 * served (the same gap class as the retention window), so a deployment that
 * raised it will see this client refuse a predicate the server would accept —
 * which is the safe direction to be wrong in, and the refusal says which limit
 * it is enforcing.
 */
export const MAX_FILTER_DEPTH = 4;

/** i18n keys the validator reports through — supplied by the caller so this
 * layer holds no copy of its own. */
export interface FilterMessageKeys {
  readonly notJson: string;
  readonly notObject: string;
  readonly tooDeep: string;
  readonly badKey: string;
  readonly badPath: string;
  readonly unknownGroupOp: string;
  readonly groupNeedsList: string;
  readonly emptyMatcher: string;
  readonly unknownFieldOp: string;
  readonly opNeedsList: string;
  readonly opNeedsBoolean: string;
  readonly opNeedsString: string;
  readonly opNeedsNumber: string;
}

/** What is wrong, as an i18n key plus the values that name the place. */
export interface FilterProblem {
  readonly code: string;
  readonly params: Readonly<Record<string, unknown>>;
}

/** A predicate this module will evaluate, or the first thing wrong with it. */
export type FilterValidation =
  | { readonly ok: true; readonly value: Record<string, unknown> | undefined }
  | { readonly ok: false; readonly problem: FilterProblem };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function validatePredicate(
  predicate: unknown,
  keys: FilterMessageKeys,
  depth: number
): FilterProblem | undefined {
  if (predicate === null || predicate === undefined) return undefined;
  if (!isPlainObject(predicate)) {
    return { code: keys.notObject, params: {} };
  }
  if (Object.keys(predicate).length === 0) return undefined;
  if (depth > MAX_FILTER_DEPTH) {
    return { code: keys.tooDeep, params: { limit: MAX_FILTER_DEPTH } };
  }

  for (const [key, matcher] of Object.entries(predicate)) {
    if (key.length === 0) {
      return { code: keys.badKey, params: {} };
    }
    if (key === "$or" || key === "$and") {
      if (!Array.isArray(matcher) || matcher.length === 0) {
        return { code: keys.groupNeedsList, params: { op: key } };
      }
      for (const sub of matcher) {
        const problem = validatePredicate(sub, keys, depth + 1);
        if (problem) return problem;
      }
      continue;
    }
    if (key === "$not") {
      const problem = validatePredicate(matcher, keys, depth + 1);
      if (problem) return problem;
      continue;
    }
    if (key.startsWith("$")) {
      return { code: keys.unknownGroupOp, params: { op: key } };
    }
    if (key.split(".").some((part) => part.length === 0)) {
      return { code: keys.badPath, params: { path: key } };
    }
    const problem = validateMatcher(key, matcher, keys);
    if (problem) return problem;
  }
  return undefined;
}

function validateMatcher(
  path: string,
  matcher: unknown,
  keys: FilterMessageKeys
): FilterProblem | undefined {
  // A scalar (or null) is the equality shorthand — nothing to check.
  if (!isPlainObject(matcher)) return undefined;
  const entries = Object.entries(matcher);
  if (entries.length === 0) {
    return { code: keys.emptyMatcher, params: { path } };
  }
  for (const [op, operand] of entries) {
    if (!(FILTER_FIELD_OPS as readonly string[]).includes(op)) {
      return { code: keys.unknownFieldOp, params: { path, op } };
    }
    if ((op === "$in" || op === "$nin") && !Array.isArray(operand)) {
      return { code: keys.opNeedsList, params: { path, op } };
    }
    if (op === "$exists" && typeof operand !== "boolean") {
      return { code: keys.opNeedsBoolean, params: { path, op } };
    }
    if (op === "$prefix" && typeof operand !== "string") {
      return { code: keys.opNeedsString, params: { path, op } };
    }
    if (
      (op === "$gt" || op === "$gte" || op === "$lt" || op === "$lte") &&
      !isNumber(operand)
    ) {
      return { code: keys.opNeedsNumber, params: { path, op } };
    }
  }
  return undefined;
}

/**
 * Validate an already-parsed predicate. `undefined` / `{}` is "match every
 * event", which is what an unfiltered subscription is.
 */
export function validateFilterValue(
  predicate: unknown,
  keys: FilterMessageKeys
): FilterValidation {
  const problem = validatePredicate(predicate, keys, 1);
  if (problem) return { ok: false, problem };
  if (!isPlainObject(predicate) || Object.keys(predicate).length === 0) {
    return { ok: true, value: undefined };
  }
  return { ok: true, value: predicate };
}

/**
 * Validate what a person typed. Blank text is an empty filter, not an error —
 * "I want every event of this type" is the common case and must not be
 * spelled `{}` by hand.
 */
export function validateFilterText(
  text: string,
  keys: FilterMessageKeys
): FilterValidation {
  const trimmed = text.trim();
  if (trimmed.length === 0) return { ok: true, value: undefined };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    return {
      ok: false,
      problem: {
        code: keys.notJson,
        params: { detail: error instanceof Error ? error.message : trimmed },
      },
    };
  }
  return validateFilterValue(parsed, keys);
}
