/**
 * `useFeatureFields` — the HEADLESS half of the feature form (§54: every
 * primitive this package ships has a headless level and a default-skin level,
 * and the skin is a renderer over the headless one, never a second copy of it).
 *
 * `<FeatureFields/>` in `/default` is deliberately stateless: values and errors
 * come in, changes go out, so the composer that owns the submit
 * (listings-react) keeps ONE source of truth for a draft. That is right for a
 * composer — and it left every other host (a filter panel, an admin preview, a
 * "quick edit" sheet) to re-derive the same four things by hand: the answer
 * map, the DTO envelope, the mirrored verdict, and whether the form may be
 * submitted at all.
 *
 * This hook is those four things and nothing else. It holds no query, opens no
 * socket, imports no antd:
 *
 *   values     the answers, keyed by slug, seeded from the features' own
 *              config defaults (`date.default`, a `select` option marked
 *              `default: true`) so a form opens the way the admin configured it
 *   setValue   what an editor's `onChange(slug, value)` calls
 *   dto        `toFeaturesDto(features, values)` — the wire envelope
 *   result     `mirrorValidate(features, dto)` — the client-side verdict
 *   errors     `featureErrorsBySlug(result)` — refusals routed to controls
 *   submit     an `ActionAvailability`: blocked while a feature cannot be
 *              drawn at all, blocked while the mirror refuses something, and
 *              the reason NAMED either way (§83: never a dead disabled button)
 *
 * Two behaviours worth stating because they are decisions, not defaults:
 *
 *  - **`touched` exists and the errors do not wait for it.** `errors` carries
 *    every refusal; `visibleErrors` carries only the ones for fields a person
 *    has already touched, plus everything once `showAllErrors()` is called
 *    (what a submit button does). Shouting "required" at an empty form nobody
 *    has typed in yet is the mirror being right and useless at the same time.
 *  - **A server verdict replaces a mirrored one through the SAME shape.** Pass
 *    the server's `ValidationBatchResult` as `serverResult` and its rows win
 *    per slug — no translation step, because the mirror was built to return
 *    the server's own shape.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { ActionAvailability } from "@stapel/core";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { FlowError } from "@stapel/core";
import type {
  FeatureDef,
  FeaturesDto,
  ValidationBatchResult,
} from "./types.js";
import { featureConfig, featureType } from "./types.js";
import { toFeaturesDto } from "./dto.js";
import { mirrorValidate } from "./validate.js";
import { featureErrorsBySlug } from "./errors.js";
import { unsupportedTypeGate, unsupportedTypes } from "./registry.js";
import { ATTRIBUTES_I18N_KEYS } from "./i18n/keys.js";

/**
 * The answer a feature's own config says a blank form should open with.
 *
 * `date.default` is a Unix timestamp the admin picked; a `select` option
 * carrying `default: true` is pre-selected (the engine's
 * `SelectOption.default`, validated against `maxSelected` at config time). No
 * other builtin declares a default, and a type this build does not know gets
 * none — inventing one would submit a value nobody chose.
 */
export function defaultFeatureValue(feature: FeatureDef): unknown {
  const config = featureConfig(feature);
  switch (featureType(feature)) {
    case "date": {
      const value = config["default"];
      return typeof value === "number" && Number.isFinite(value) ? value : undefined;
    }
    case "select": {
      const raw = config["options"];
      if (!Array.isArray(raw)) return undefined;
      const chosen = raw
        .filter(
          (option): option is { value?: unknown; default?: unknown } =>
            option !== null && typeof option === "object"
        )
        .filter((option) => option.default === true)
        .map((option) => String(option.value ?? ""))
        .filter((value) => value.length > 0);
      return chosen.length > 0 ? chosen : undefined;
    }
    default:
      return undefined;
  }
}

/** Every feature's configured default, keyed by slug — the map a blank form
 * starts from. Features with no default contribute no key. */
export function initialFeatureValues(
  features: readonly FeatureDef[]
): Readonly<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const feature of features) {
    const value = defaultFeatureValue(feature);
    if (value !== undefined) out[feature.slug] = value;
  }
  return out;
}

/** The "this caller draws nothing of its own" default — a module constant, so
 * it is referentially stable across renders. */
const NO_EDITOR_TYPES: readonly string[] = [];

export interface UseFeatureFieldsOptions {
  /** The category's features, in the order they are drawn. */
  readonly features: readonly FeatureDef[];
  /** Answers to start from — a saved draft, usually via `fromFeaturesDto`.
   * Merged OVER the features' configured defaults. */
  readonly initialValues?: Readonly<Record<string, unknown>>;
  /**
   * The value types the caller can actually DRAW — `BUILTIN_VALUE_EDITOR_TYPES`
   * from `/default`, or a host's own set. Passed in rather than imported so the
   * headless half never pulls a skin into a bundle.
   */
  readonly editorTypes?: readonly string[];
  /** The server's last verdict. Its rows replace the mirror's, per slug. */
  readonly serverResult?: ValidationBatchResult | undefined;
}

export interface FeatureFieldsState {
  /** Current answers, keyed by slug. */
  readonly values: Readonly<Record<string, unknown>>;
  /** Record an answer — the shape `<FeatureFields onChange>` emits. */
  setValue(slug: string, value: unknown): void;
  /** Back to the configured defaults plus `initialValues`. */
  reset(): void;
  /** The `{slug: {type, value}}` envelope, blank answers omitted. */
  readonly dto: FeaturesDto;
  /** The client-side verdict — the server's shape, so the two are swappable. */
  readonly result: ValidationBatchResult;
  /** Every refusal, routed by slug. */
  readonly errors: Readonly<Record<string, FlowError>>;
  /** The refusals a person has earned the right to see: touched fields, plus
   * everything after {@link showAllErrors}. */
  readonly visibleErrors: Readonly<Record<string, FlowError>>;
  /** Slugs the person has answered at least once. */
  readonly touched: ReadonlySet<string>;
  /** Reveal every refusal — what a submit attempt calls. */
  showAllErrors(): void;
  /** Value types present that nothing can draw. */
  readonly unsupported: readonly string[];
  /** May this form be submitted, and if not, WHY — with the reason as a
   * translation key a host renders beside the button. */
  readonly submit: ActionAvailability;
}

/**
 * The feature form as state — see this module's header.
 *
 * ```tsx
 * const fields = useFeatureFields({ features, editorTypes: BUILTIN_VALUE_EDITOR_TYPES });
 * <FeatureFields
 *   features={features}
 *   values={fields.values}
 *   onChange={fields.setValue}
 *   errors={fields.visibleErrors}
 * />
 * <GatedButton gate={fields.submit} type="primary" onClick={() => {
 *   fields.showAllErrors();
 *   if (fields.submit.available) save(fields.dto);
 * }}>{t(K.publish)}</GatedButton>
 * ```
 */
export function useFeatureFields(options: UseFeatureFieldsOptions): FeatureFieldsState {
  const { features, initialValues, editorTypes, serverResult } = options;

  // The seed is computed once per feature set: re-deriving it on every render
  // would reset a form the moment its parent re-rendered.
  const seed = useMemo(
    () => ({ ...initialFeatureValues(features), ...(initialValues ?? {}) }),
    // Keyed on the FEATURE SET alone, deliberately: `initialValues` is an
    // object literal at most call sites, so including it would rebuild the seed
    // on every parent render and reset a half-filled form. The reset a caller
    // actually wants is "the category changed", which IS a new feature set.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above: including initialValues resets a half-filled form on every parent render
    [features]
  );
  const seedRef = useRef(seed);
  seedRef.current = seed;

  const [values, setValues] = useState<Readonly<Record<string, unknown>>>(seed);
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [allRevealed, setAllRevealed] = useState(false);

  const setValue = useCallback((slug: string, value: unknown): void => {
    setValues((previous) => ({ ...previous, [slug]: value }));
    setTouched((previous) => {
      if (previous.has(slug)) return previous;
      const next = new Set(previous);
      next.add(slug);
      return next;
    });
  }, []);

  const reset = useCallback((): void => {
    setValues(seedRef.current);
    setTouched(new Set<string>());
    setAllRevealed(false);
  }, []);

  const showAllErrors = useCallback((): void => setAllRevealed(true), []);

  const dto = useMemo(() => toFeaturesDto(features, values), [features, values]);
  const mirrored = useMemo(() => mirrorValidate(features, dto), [features, dto]);

  // A server row REPLACES the mirrored row for the same slug: it is the verdict
  // that counts, and showing both would put two sentences under one control.
  const result = useMemo((): ValidationBatchResult => {
    if (serverResult === undefined) return mirrored;
    const fromServer = new Map(serverResult.results.map((row) => [row.slug, row]));
    const merged = mirrored.results.map((row) => fromServer.get(row.slug) ?? row);
    const seen = new Set(merged.map((row) => row.slug));
    for (const row of serverResult.results) if (!seen.has(row.slug)) merged.push(row);
    return { valid: merged.every((row) => row.status === "ok"), results: merged };
  }, [mirrored, serverResult]);

  const errors = useMemo(() => featureErrorsBySlug(result), [result]);

  const visibleErrors = useMemo((): Readonly<Record<string, FlowError>> => {
    if (allRevealed) return errors;
    const out: Record<string, FlowError> = {};
    for (const [slug, error] of Object.entries(errors)) {
      if (touched.has(slug)) out[slug] = error;
    }
    return out;
  }, [errors, touched, allRevealed]);

  // Memoised so the default `[]` is not a new array on every render, which
  // would re-run both gates below forever.
  const drawable = useMemo(() => editorTypes ?? NO_EDITOR_TYPES, [editorTypes]);
  const typeGate = useMemo(
    () => unsupportedTypeGate(features, drawable),
    [features, drawable]
  );

  const submit = useMemo((): ActionAvailability => {
    // An undrawable feature outranks a refusal: it is the reason a person
    // CANNOT fix the form, and offering "3 problems" for a field that is not
    // on screen would send them looking for a control that does not exist.
    if (!typeGate.available) return typeGate;
    if (result.valid) return actionAvailable();
    return actionBlocked(ATTRIBUTES_I18N_KEYS.submitBlockedInvalid, {
      count: result.results.filter((row) => row.status !== "ok").length,
    });
  }, [typeGate, result]);

  const unsupported = useMemo(
    () => unsupportedTypes(features, drawable),
    [features, drawable]
  );

  return {
    values,
    setValue,
    reset,
    dto,
    result,
    errors,
    visibleErrors,
    touched,
    showAllErrors,
    unsupported,
    submit,
  };
}
