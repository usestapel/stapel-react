/**
 * The client-side validation MIRROR — instant feedback, never a verdict.
 *
 * "Client-side validation mirrors, server decides" (spec §7.2). Every rule
 * here is derived from the schema's own `config` so the person sees a problem
 * as they type instead of after a round trip; none of it is trusted. The
 * server re-runs `stapel_attributes.validate_dto_structured` on every submit
 * and its answer is the one that counts.
 *
 * ── Why the mirror emits the SERVER's error keys ───────────────────────────
 *
 * Each rule below reports the exact `error.400.feature_*` key
 * (`stapel_attributes.errors.ERROR_CODE_TO_KEY`) the backend would have
 * returned for the same input, with the same `{feature}`/`{field}` params. So
 * a "too long" caught locally and a "too long" caught by the server render
 * the SAME sentence in the SAME language. The alternative — pair-invented
 * copy for the local half — gives the person two different wordings for one
 * problem and makes the local one a lie the moment the backend's rule moves.
 *
 * ── camelCase, and the cap that does not exist ─────────────────────────────
 *
 * Config keys are camelCase (`maxLength`, not `max_length`) — backend delta
 * note 1. A type's dataclass parser drops keys it does not know, so a
 * snake_case typo is a constraint that silently does not exist. `publish`
 * refuses those server-side; this mirror simply reads the camelCase names and
 * therefore agrees with the engine by construction.
 */
import type { FlowError } from "@stapel/core";
import type { FormFieldDef } from "../api/types.js";

/** The `error.400.feature_*` keys this mirror can raise — a subset of
 * `stapel_attributes.errors.ATTRIBUTES_ERRORS`, listed so the i18n bundle can
 * be checked against it. */
export const FEATURE_ERROR_CODES: readonly string[] = [
  "error.400.feature_below_minimum",
  "error.400.feature_above_maximum",
  "error.400.feature_not_in_options",
  "error.400.feature_invalid_type",
  "error.400.feature_invalid_format",
  "error.400.feature_mandatory_missing",
];

function featureError(
  field: FormFieldDef,
  code: string,
  extra: Readonly<Record<string, unknown>> = {}
): FlowError {
  return {
    code,
    // `field` is what the fleet's `useFieldError` routes on; `slug` and
    // `feature` are what the attributes catalogue's message templates
    // interpolate. The adapter keeps all three server-side (delta note 1), so
    // the mirror does too.
    params: {
      field: field.slug,
      slug: field.slug,
      feature: field.name ?? field.slug,
      ...extra,
    },
    status: 400,
    message: undefined,
    language: undefined,
  };
}

function num(config: Readonly<Record<string, unknown>>, key: string): number | undefined {
  const raw = config[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

/** The declared choice values of an options-bearing config, or `undefined`
 * when the kind has none. Accepts both the bare-scalar and the
 * `{value, label}` option shapes the attributes types allow. */
export function optionValues(
  field: FormFieldDef
): readonly unknown[] | undefined {
  const raw = (field.config ?? {})["options"];
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((option) =>
    option !== null && typeof option === "object" && "value" in option
      ? (option as { value: unknown }).value
      : option
  );
}

/** True when the answer is "nothing was entered" — the one shape the
 * mandatory rule fires on. An explicit `false` is an ANSWER for a `bool`, not
 * an absence, which is why this is not a falsiness check. */
export function isBlank(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * Validate one answer against its field's config. Returns the mirrored
 * refusal, or `undefined` when this side of the wire is satisfied.
 *
 * `header` fields are skipped outright: the engine regenerates a header's DAO
 * from its config and REJECTS an answer to one (backend delta note 1), so a
 * header has nothing to validate and must never be given a value.
 */
export function validateFieldValue(
  field: FormFieldDef,
  value: unknown
): FlowError | undefined {
  if (field.kind === "header") return undefined;

  const config = field.config ?? {};

  if (isBlank(value)) {
    return field.mandatory === true
      ? featureError(field, "error.400.feature_mandatory_missing")
      : // An optional field left blank is complete, and no later rule may
        // fire on an absent value — a `minLength` must not turn "did not
        // answer" into "answered too short".
        undefined;
  }

  // ── choices ────────────────────────────────────────────────────────────
  const options = optionValues(field);
  if (options !== undefined && config["allowCustom"] !== true) {
    const answers = Array.isArray(value) ? value : [value];
    const stray = answers.find(
      (answer) => !options.some((option) => option === answer)
    );
    if (stray !== undefined) {
      return featureError(field, "error.400.feature_not_in_options", {
        ref_value: stray,
      });
    }
  }

  // ── multi-select cardinality ───────────────────────────────────────────
  if (field.kind === "select") {
    const count = Array.isArray(value) ? value.length : 1;
    const minSelected = num(config, "minSelected");
    const maxSelected = num(config, "maxSelected");
    if (minSelected !== undefined && count < minSelected) {
      return featureError(field, "error.400.feature_below_minimum", {
        min: minSelected,
      });
    }
    if (maxSelected !== undefined && count > maxSelected) {
      return featureError(field, "error.400.feature_above_maximum", {
        max: maxSelected,
      });
    }
    return undefined;
  }

  // ── numeric range ──────────────────────────────────────────────────────
  if (field.kind === "int" || field.kind === "float") {
    const asNumber = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(asNumber)) {
      return featureError(field, "error.400.feature_invalid_type");
    }
    if (field.kind === "int" && !Number.isInteger(asNumber)) {
      return featureError(field, "error.400.feature_invalid_type");
    }
    const min = num(config, "min");
    const max = num(config, "max");
    if (min !== undefined && asNumber < min) {
      return featureError(field, "error.400.feature_below_minimum", { min });
    }
    if (max !== undefined && asNumber > max) {
      return featureError(field, "error.400.feature_above_maximum", { max });
    }
    return undefined;
  }

  // ── string length + pattern ────────────────────────────────────────────
  if (field.kind === "string") {
    const text = String(value);
    const minLength = num(config, "minLength");
    const maxLength = num(config, "maxLength");
    if (minLength !== undefined && text.length < minLength) {
      return featureError(field, "error.400.feature_below_minimum", {
        min_length: minLength,
      });
    }
    if (maxLength !== undefined && text.length > maxLength) {
      return featureError(field, "error.400.feature_above_maximum", {
        max_length: maxLength,
      });
    }
    const pattern = config["pattern"];
    if (typeof pattern === "string" && pattern.length > 0) {
      let re: RegExp | undefined;
      try {
        re = new RegExp(pattern);
      } catch {
        // An admin-authored pattern that JS cannot compile (a Python-only
        // construct) is NOT the respondent's problem: skip the mirror and
        // let the server, which compiled it, be the one to refuse.
        re = undefined;
      }
      if (re !== undefined && !re.test(text)) {
        return featureError(field, "error.400.feature_invalid_format");
      }
    }
    return undefined;
  }

  return undefined;
}

/**
 * Validate a whole answer set. Returns `{slug: FlowError}` for the fields that
 * failed — the exact shape `FormFillBag.fieldErrors` carries, so a server
 * response can be merged into it without a translation step.
 */
export function validateAnswers(
  fields: readonly FormFieldDef[],
  values: Readonly<Record<string, unknown>>
): Readonly<Record<string, FlowError>> {
  const errors: Record<string, FlowError> = {};
  for (const field of fields) {
    const error = validateFieldValue(field, values[field.slug]);
    if (error !== undefined) errors[field.slug] = error;
  }
  return errors;
}
