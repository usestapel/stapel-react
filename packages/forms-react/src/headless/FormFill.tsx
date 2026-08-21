import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  hasErrorCode,
  isStapelApiError,
  loadStateFromQuery,
  requireLoaded,
} from "@stapel/core";
import type {
  ActionAvailability,
  FlowError,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type { FormFieldDef, PublicForm } from "../api/types.js";
import { usePublicForm } from "../model/queries.js";
import { useSubmitForm } from "../model/mutations.js";
import { resolveFormFieldWidget } from "../widgets/registry.js";
import { isBlank, validateAnswers } from "../widgets/validate.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** `error.409.forms_version_superseded` — the schema moved while the person
 * was filling it in. */
const CODE_SUPERSEDED = "error.409.forms_version_superseded";

/** The bag `<FormFill>` hands its render prop (spec §7.2). */
export interface FormFillBag {
  /**
   * The schema read as a state a skin cannot flatten. A failed fetch renders
   * the `failed` arm — NEVER an empty or missing form. Distinguish the
   * verdicts from the outage with
   * `hasErrorCode(error, "error.404.forms_not_found")` /
   * `"error.410.forms_closed"`; anything else (network, 5xx) is "we could not
   * ask", which is a different sentence from "there is no form here".
   */
  readonly state: LoadState<PublicForm>;
  /** Current answers, keyed by slug. */
  readonly values: Readonly<Record<string, unknown>>;
  setValue(slug: string, value: unknown): void;
  /**
   * Per-field refusals, keyed by slug — the client mirror and the server's
   * verdicts in one map. A server `error.400.feature_*` is routed here by its
   * `params.field`; a multi-field refusal arrives in `params.fields[]` and
   * every entry lands.
   */
  readonly fieldErrors: Readonly<Record<string, FlowError>>;
  /** Why the submit button is off, when it is. */
  readonly submit: ActionAvailability;
  doSubmit(): void;
  readonly isSubmitting: boolean;
  /** Set once the server accepted the answers. */
  readonly submitted: { readonly confirmation: string } | null;
  /** Whole-form failures (410 closed, 429 throttled, 413 too large, the
   * submission cap). A `StapelApiError` rather than a `FlowError` so a skin
   * can branch with `hasErrorCode` (which reads the API dialects, not the
   * render dialect). */
  readonly formError: StapelApiError | null;
  /**
   * True after a `409 forms_version_superseded`: the schema was refetched and
   * compatible answers were preserved. The skin must say so — "the form
   * changed, please review and resubmit" — because silently swapping the
   * fields under a person and asking them to press submit again is how a
   * wrong answer gets recorded.
   */
  readonly superseded: boolean;
  /**
   * Field kinds in this schema that nothing can render (no host registration,
   * no builtin widget). Non-empty means {@link submit} is blocked: silently
   * skipping a possibly-REQUIRED field would fabricate an invalid submission
   * and let the server refuse a field the person never saw.
   */
  readonly unsupportedKinds: readonly string[];
  /**
   * The captcha seam (spec §12 risk 3). The netintel tier decides whether a
   * token is required at all, so this stays optional and the captcha layer
   * refuses on its own terms; the pair only transports it. Wire it the way
   * auth-react's OTP flow does — the widget hands a token, the bag puts it in
   * the submit body.
   */
  setCaptchaToken(token: string | null): void;
  readonly captchaToken: string | null;
  refetch(): void;
}

/** The map without one key, or the SAME object when the key was not there —
 * identity matters: returning a fresh object on every keystroke would
 * re-render every field that reads `fieldErrors`. */
function withoutKey(
  map: Readonly<Record<string, FlowError>>,
  slug: string
): Record<string, FlowError> {
  if (map[slug] === undefined) return map as Record<string, FlowError>;
  return Object.fromEntries(
    Object.entries(map).filter(([key]) => key !== slug)
  );
}

/** True when the widget layer can draw this field at all. */
function isRenderable(field: FormFieldDef, builtinKinds: ReadonlySet<string>): boolean {
  return (
    resolveFormFieldWidget(field.kind) !== null || builtinKinds.has(field.kind)
  );
}

/**
 * Read the per-field entries out of a server refusal.
 *
 * The wire shape (stapel-forms `views._maps_forms_errors`) puts the FIRST
 * field error's code at the top level and the whole set under
 * `params.fields[]` as `{field, code, params}`. Both are read: the array when
 * present, otherwise the top-level `params.field`, so a single-field refusal
 * still lands on its control.
 */
function serverFieldErrors(error: StapelApiError): Record<string, FlowError> {
  const out: Record<string, FlowError> = {};
  const rows = error.params["fields"];
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row === null || typeof row !== "object") continue;
      const entry: Record<string, unknown> = { ...row };
      const field = entry["field"];
      const code = entry["code"];
      if (typeof field !== "string" || typeof code !== "string") continue;
      const params = entry["params"];
      out[field] = {
        code,
        params:
          params !== null && typeof params === "object"
            ? { ...(params as object) }
            : {},
        status: error.status,
        message: undefined,
        language: undefined,
      };
    }
  }
  const single = error.params["field"];
  if (Object.keys(out).length === 0 && typeof single === "string") {
    out[single] = {
      code: error.code,
      params: error.params,
      status: error.status,
      message: error.message,
      language: error.language,
    };
  }
  return out;
}

/** Answers worth sending: blanks are omitted (an unanswered optional field is
 * not an empty answer), and `header` fields are never sent — the engine
 * regenerates their DAO from config and stapel-forms rejects an answer to one
 * outright (backend delta note 1). */
function answersToSend(
  fields: readonly FormFieldDef[],
  values: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.kind === "header") continue;
    const value = values[field.slug];
    if (isBlank(value)) continue;
    out[field.slug] = value;
  }
  return out;
}

/** Seed the answers a schema declares a value default for. Only `date`
 * declares one upstream (`config.default`); seeding it matches what the
 * engine would have applied, so the person sees the same value the server
 * would have stored. */
function seedValues(fields: readonly FormFieldDef[]): Record<string, unknown> {
  const seeded: Record<string, unknown> = {};
  for (const field of fields) {
    const declared = (field.config ?? {})["default"];
    if (field.kind === "date" && declared !== undefined && declared !== null) {
      seeded[field.slug] = declared;
    }
  }
  return seeded;
}

/**
 * Headless form fill — the anonymous respondent's whole surface, renderless.
 *
 * ```tsx
 * <FormFill publicId="k3J…x9">
 *   {(bag) => matchLoad(bag.state, { loading, failed, ready })}
 * </FormFill>
 * ```
 *
 * The `/default` skin's `<StapelForm>` is one renderer over this bag; a host
 * that wants its own visuals writes another and loses nothing.
 */
export function FormFill(props: {
  publicId: string;
  /** Kinds the CALLER can draw, beyond anything in the widget registry. The
   * `/default` skin passes its antd builtins here, which is what lets this
   * headless component judge `unsupportedKinds` without importing the skin. */
  builtinKinds?: readonly string[];
  /** Called once the server accepts the answers. */
  onSubmitted?: (result: { readonly confirmation: string }) => void;
  children: (bag: FormFillBag) => ReactNode;
}): ReactNode {
  const query = usePublicForm(props.publicId);
  const submitMutation = useSubmitForm();
  const state = loadStateFromQuery(query);

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, FlowError>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, FlowError>>({});
  const [formError, setFormError] = useState<StapelApiError | null>(null);
  const [submitted, setSubmitted] = useState<{ confirmation: string } | null>(
    null
  );
  const [superseded, setSuperseded] = useState(false);
  const [captchaToken, setCaptchaTokenState] = useState<string | null>(null);

  const form = state.status === "ready" ? state.data : undefined;
  const fields = useMemo(() => form?.fields ?? [], [form]);

  const builtinKinds = useMemo(
    () => new Set(props.builtinKinds ?? []),
    [props.builtinKinds]
  );

  // Seed declared defaults once per version. Keyed on `version_id` so a
  // supersede re-seeds against the NEW schema rather than leaving a default
  // the new version no longer declares.
  const seededVersion = useRef<string | null>(null);
  useEffect(() => {
    if (form === undefined) return;
    if (seededVersion.current === form.version_id) return;
    const previous = seededVersion.current;
    seededVersion.current = form.version_id;
    if (previous === null) {
      const seeded = seedValues(form.fields);
      if (Object.keys(seeded).length > 0) {
        setValues((current) => ({ ...seeded, ...current }));
      }
      return;
    }
    // A NEW version arrived under a filled-in form — the 409 refetch path.
    // Keep an answer only where the slug still exists AND still has the same
    // kind: a slug reused for a different kind is a different question, and
    // carrying the old answer over would submit an answer to a question
    // nobody was asked. Everything else is dropped, visibly, and `superseded`
    // makes the skin say so.
    const compatible = new Map(form.fields.map((f) => [f.slug, f.kind]));
    setValues((current) => {
      const kept: Record<string, unknown> = {};
      for (const [slug, value] of Object.entries(current)) {
        if (compatible.get(slug) !== undefined) kept[slug] = value;
      }
      return kept;
    });
    setClientErrors({});
    setServerErrors({});
  }, [form]);

  const setValue = useCallback((slug: string, value: unknown): void => {
    setValues((current) => ({ ...current, [slug]: value }));
    // Clearing on edit is the point of a mirror: the person changed the
    // thing that was wrong, so the old refusal is stale on both sides.
    setClientErrors((current) => withoutKey(current, slug));
    setServerErrors((current) => withoutKey(current, slug));
  }, []);

  const setCaptchaToken = useCallback((token: string | null): void => {
    setCaptchaTokenState(token);
  }, []);

  const unsupportedKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const field of fields) {
      if (!isRenderable(field, builtinKinds)) kinds.add(field.kind);
    }
    return [...kinds].sort();
  }, [fields, builtinKinds]);

  const fieldErrors = useMemo(
    () => ({ ...clientErrors, ...serverErrors }),
    [clientErrors, serverErrors]
  );

  const isSubmitting = submitMutation.isPending;

  const submit: ActionAvailability = useMemo(() => {
    if (submitted !== null) {
      return actionBlocked(FORMS_I18N_KEYS.submitBlockedDone);
    }
    return requireLoaded(state, () => {
      if (unsupportedKinds.length > 0) {
        return actionBlocked(FORMS_I18N_KEYS.submitBlockedUnsupported, {
          kinds: unsupportedKinds.join(", "),
        });
      }
      if (isSubmitting) {
        return actionBlocked(FORMS_I18N_KEYS.submitBlockedInFlight);
      }
      return actionAvailable();
    });
  }, [state, submitted, unsupportedKinds, isSubmitting]);

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query]);

  const doSubmit = useCallback((): void => {
    if (form === undefined || submitted !== null || isSubmitting) return;

    const mirrored = validateAnswers(fields, values);
    setServerErrors({});
    setFormError(null);
    if (Object.keys(mirrored).length > 0) {
      setClientErrors(mirrored);
      return;
    }
    setClientErrors({});

    submitMutation.mutate(
      {
        publicId: props.publicId,
        body: {
          answers: answersToSend(fields, values),
          // Echoing the rendered version is what turns a racing publish into
          // a clean 409 instead of a silent mis-validation against a schema
          // the person never saw.
          version_id: form.version_id,
          ...(captchaToken !== null ? { captcha_token: captchaToken } : {}),
        },
      },
      {
        onSuccess: (result) => {
          const confirmation =
            result.confirmation ??
            form.meta.confirmation_text ??
            "";
          setSubmitted({ confirmation });
          setSuperseded(false);
          props.onSubmitted?.({ confirmation });
        },
        onError: (caught: unknown) => {
          if (!isStapelApiError(caught)) {
            setFormError(null);
            return;
          }
          if (hasErrorCode(caught, CODE_SUPERSEDED)) {
            // Refetch and let the seeding effect preserve what still fits.
            // The token is dropped: a captcha is spent, and replaying it
            // against the next attempt would fail on the server's terms.
            setSuperseded(true);
            setCaptchaTokenState(null);
            refetch();
            return;
          }
          const perField = serverFieldErrors(caught);
          if (Object.keys(perField).length > 0) {
            setServerErrors(perField);
            return;
          }
          setFormError(caught);
        },
      }
    );
  }, [
    form,
    fields,
    values,
    captchaToken,
    isSubmitting,
    submitted,
    submitMutation,
    props,
    refetch,
  ]);

  return props.children({
    state,
    values,
    setValue,
    fieldErrors,
    submit,
    doSubmit,
    isSubmitting,
    submitted,
    formError,
    superseded,
    unsupportedKinds,
    setCaptchaToken,
    captchaToken,
    refetch,
  });
}
