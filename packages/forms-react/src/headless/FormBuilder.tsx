import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  isStapelApiError,
  loadStateFromQuery,
  requireLoaded,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type {
  FormFieldDef,
  FormRow,
  FormSchema,
  FormSchemaMeta,
  FormState,
} from "../api/types.js";
import { useForm } from "../model/queries.js";
import {
  usePublishForm,
  useRotateLink,
  useSaveDraft,
  useSetFormState,
} from "../model/mutations.js";
import {
  configFormFor,
  defaultConfigFor,
  isBuilderSupportedKind,
} from "../widgets/configForms.js";
import type { KindConfigForm } from "../widgets/configForms.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** One row of the builder's field list, with everything the UI needs to draw
 * and judge it. */
export interface BuilderField {
  readonly field: FormFieldDef;
  /**
   * The kind's config declaration, or `undefined` when it ships builder-less
   * (`convertible_unit`, `hierarchical_select` — see `widgets/configForms.ts`).
   * A builder-less field is still LISTED and still reorderable/removable; only
   * its options are uneditable here, and it stays authorable through the draft
   * PUT.
   */
  readonly configForm: KindConfigForm | undefined;
  /** True when this kind has no config form the builder can render. */
  readonly builderLess: boolean;
  /** Config keys declared upstream that v1 has no widget for (e.g.
   * `date.options`). Named so the UI can say which options it is not showing
   * rather than presenting a partial form as a complete one. */
  readonly unsupportedConfigKeys: readonly string[];
}

/** The bag `<FormBuilder>` hands its render prop (spec §8). */
export interface FormBuilderBag {
  /** The form row. A failed read is never "no such form" — LoadState law. */
  readonly state: LoadState<FormRow>;
  /** The draft under edit: the row's `draft_schema` when there is one, else
   * the active version's schema as a starting point, else empty. */
  readonly fields: readonly BuilderField[];
  readonly meta: FormSchemaMeta;
  /** True when the local draft differs from what the server holds. */
  readonly isDirty: boolean;

  addField(kind: string): void;
  removeField(slug: string): void;
  /** Move a field to a new index (drag-reorder, or a pair of arrow buttons —
   * field ORDER is schema order). */
  moveField(slug: string, toIndex: number): void;
  /** Patch a field's own attributes (`slug`, `name`, `mandatory`, …). */
  updateField(slug: string, patch: Partial<FormFieldDef>): void;
  /** Set one config key of one field. `undefined` REMOVES the key, which is
   * not the same as writing `null`: the engine reads an absent key as "use my
   * own default". */
  setFieldConfig(slug: string, key: string, value: unknown): void;
  setMeta(patch: Partial<FormSchemaMeta>): void;

  /** The kinds the builder can add, in offer order. */
  readonly availableKinds: readonly string[];

  readonly save: ActionAvailability;
  doSave(): void;
  readonly publish: ActionAvailability;
  doPublish(): void;
  readonly isSaving: boolean;
  readonly isPublishing: boolean;

  setState(next: FormState): void;
  rotateLink(): void;

  /** The last refusal from save/publish/state/rotate — a `StapelApiError` so
   * the skin can branch with `hasErrorCode` (`forms_duplicate_slug` carries
   * `params.slug`, `forms_invalid_schema` carries `params.key`, …). */
  readonly error: StapelApiError | null;
  refetch(): void;
}

/** A slug that does not collide with anything already in the draft. */
function freeSlug(kind: string, taken: ReadonlySet<string>): string {
  const base = kind === "header" ? "heading" : kind;
  for (let n = 1; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The draft a form starts from: its own scratchpad if it has one, otherwise
 * nothing. The ACTIVE version is deliberately not copied in — editing a live
 * form starts from the draft the admin last saved, and a form with no draft is
 * a form nobody has started editing. */
function initialSchema(row: FormRow | undefined): FormSchema {
  return row?.draft_schema ?? { fields: [], meta: {} };
}

/**
 * Headless form builder — the authoring surface, renderless and DATA-DRIVEN.
 *
 * There is no per-kind hand-written form anywhere in this component or in the
 * skin that renders it: a field's options come from
 * `widgets/configForms.ts`, which mirrors `stapel_attributes.config_form`.
 * Adding a feature type upstream therefore adds a configurable kind here
 * without new UI, which is the whole point of the upstream declaring its
 * config form as data (spec §8).
 */
export function FormBuilder(props: {
  workspaceId: string;
  formId: string;
  children: (bag: FormBuilderBag) => ReactNode;
}): ReactNode {
  const query = useForm(props.workspaceId, props.formId);
  const state = loadStateFromQuery(query);
  const row = state.status === "ready" ? state.data : undefined;

  const saveMutation = useSaveDraft();
  const publishMutation = usePublishForm();
  const stateMutation = useSetFormState();
  const rotateMutation = useRotateLink();

  const [schema, setSchema] = useState<FormSchema>(() => initialSchema(row));
  const [error, setError] = useState<StapelApiError | null>(null);

  // Adopt the server's draft when the form first loads, and after any save —
  // but never mid-edit, which would throw away what the admin is typing. The
  // ref tracks WHICH server draft has been adopted, so a background refetch
  // that returns the same draft is not an adoption event.
  const adopted = useRef<string | null>(null);
  useEffect(() => {
    if (row === undefined) return;
    const fingerprint = JSON.stringify(row.draft_schema ?? null);
    if (adopted.current === fingerprint) return;
    adopted.current = fingerprint;
    setSchema(initialSchema(row));
  }, [row]);

  const isDirty = useMemo(
    () => JSON.stringify(schema) !== JSON.stringify(initialSchema(row)),
    [schema, row]
  );

  const fields = useMemo<readonly BuilderField[]>(
    () =>
      schema.fields.map((field) => {
        const configForm = configFormFor(field.kind);
        return {
          field,
          configForm,
          builderLess: configForm === undefined,
          unsupportedConfigKeys: (configForm?.fields ?? [])
            .filter((spec) => spec.unsupported === true)
            .map((spec) => spec.name),
        };
      }),
    [schema]
  );

  const addField = useCallback(
    (kind: string): void => {
      setSchema((current) => {
        const taken = new Set(current.fields.map((f) => f.slug));
        const config = defaultConfigFor(kind);
        const field: FormFieldDef = {
          slug: freeSlug(kind, taken),
          kind,
          name: "",
          mandatory: false,
          ...(Object.keys(config).length > 0 ? { config } : {}),
        };
        return { ...current, fields: [...current.fields, field] };
      });
      setError(null);
    },
    []
  );

  const removeField = useCallback((slug: string): void => {
    setSchema((current) => ({
      ...current,
      fields: current.fields.filter((f) => f.slug !== slug),
    }));
    setError(null);
  }, []);

  const moveField = useCallback((slug: string, toIndex: number): void => {
    setSchema((current) => {
      const from = current.fields.findIndex((f) => f.slug === slug);
      if (from === -1) return current;
      const moving = current.fields[from];
      if (moving === undefined) return current;
      const rest = current.fields.filter((_, index) => index !== from);
      const clamped = Math.max(0, Math.min(toIndex, rest.length));
      return {
        ...current,
        fields: [...rest.slice(0, clamped), moving, ...rest.slice(clamped)],
      };
    });
    setError(null);
  }, []);

  const updateField = useCallback(
    (slug: string, patch: Partial<FormFieldDef>): void => {
      setSchema((current) => ({
        ...current,
        fields: current.fields.map((f) =>
          f.slug === slug ? { ...f, ...patch } : f
        ),
      }));
      setError(null);
    },
    []
  );

  const setFieldConfig = useCallback(
    (slug: string, key: string, value: unknown): void => {
      setSchema((current) => ({
        ...current,
        fields: current.fields.map((f) => {
          if (f.slug !== slug) return f;
          // `undefined` REMOVES the key. An absent config key means "the
          // engine's own default"; writing null means "this value", and the
          // two are different stored schemas. Rebuilt by filtering rather
          // than `delete` (a dynamic delete deoptimizes the object shape).
          const current = f.config ?? {};
          const config: Record<string, unknown> = Object.fromEntries(
            Object.entries(current).filter(([existing]) => existing !== key)
          );
          if (value !== undefined) config[key] = value;
          return { ...f, config };
        }),
      }));
      setError(null);
    },
    []
  );

  const setMeta = useCallback((patch: Partial<FormSchemaMeta>): void => {
    setSchema((current) => ({ ...current, meta: { ...current.meta, ...patch } }));
    setError(null);
  }, []);

  const isSaving = saveMutation.isPending;
  const isPublishing = publishMutation.isPending;

  const save: ActionAvailability = useMemo(
    () =>
      requireLoaded(state, () => {
        if (isSaving) return actionBlocked(FORMS_I18N_KEYS.builderSaving);
        if (!isDirty) return actionBlocked(FORMS_I18N_KEYS.builderNoChanges);
        return actionAvailable();
      }),
    [state, isSaving, isDirty]
  );

  const publish: ActionAvailability = useMemo(
    () =>
      requireLoaded(state, () => {
        if (isPublishing) return actionBlocked(FORMS_I18N_KEYS.builderPublishing);
        if (schema.fields.length === 0) {
          return actionBlocked(FORMS_I18N_KEYS.builderEmptySchema);
        }
        // Publishing what the server holds, not what is on screen: an unsaved
        // draft would publish the PREVIOUS text while the admin looks at the
        // new one. Save first, then publish — two acts, in that order.
        if (isDirty) return actionBlocked(FORMS_I18N_KEYS.builderUnsavedDraft);
        return actionAvailable();
      }),
    [state, isPublishing, isDirty, schema.fields.length]
  );

  const onError = useCallback((caught: unknown): void => {
    // See mutations.ts: a fault that is not a StapelApiError has no code to
    // show, and pretending it does renders `undefined` at the person.
    setError(isStapelApiError(caught) ? caught : null);
  }, []);

  const ref = useMemo(
    () => ({ workspaceId: props.workspaceId, formId: props.formId }),
    [props.workspaceId, props.formId]
  );

  const doSave = useCallback((): void => {
    if (!save.available) return;
    setError(null);
    saveMutation.mutate({ ...ref, schema }, { onError });
  }, [save, saveMutation, ref, schema, onError]);

  const doPublish = useCallback((): void => {
    if (!publish.available) return;
    setError(null);
    publishMutation.mutate(ref, { onError });
  }, [publish, publishMutation, ref, onError]);

  const setFormState = useCallback(
    (next: FormState): void => {
      setError(null);
      stateMutation.mutate({ ...ref, state: next }, { onError });
    },
    [stateMutation, ref, onError]
  );

  const rotateLink = useCallback((): void => {
    setError(null);
    rotateMutation.mutate(ref, { onError });
  }, [rotateMutation, ref, onError]);

  const refetch = useCallback((): void => {
    void query.refetch();
  }, [query]);

  const availableKinds = useMemo(
    () =>
      (
        [
          "string",
          "int",
          "float",
          "bool",
          "select",
          "date",
          "header",
          "hex_color",
        ] as const
      ).filter(isBuilderSupportedKind),
    []
  );

  return props.children({
    state,
    fields,
    meta: schema.meta ?? {},
    isDirty,
    addField,
    removeField,
    moveField,
    updateField,
    setFieldConfig,
    setMeta,
    availableKinds,
    save,
    doSave,
    publish,
    doPublish,
    isSaving,
    isPublishing,
    setState: setFormState,
    rotateLink,
    error,
    refetch,
  });
}
