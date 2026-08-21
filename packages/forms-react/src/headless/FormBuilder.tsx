import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  actionAvailable,
  actionBlocked,
  isStapelApiError,
  loadStateFromQuery,
  mapLoad,
  requireLoaded,
} from "@stapel/core";
import type {
  ActionAvailability,
  LoadState,
  StapelApiError,
} from "@stapel/core";
import type {
  ConfigFieldSpec,
  FieldKind,
  FormFieldDef,
  FormRow,
  FormSchema,
  FormSchemaMeta,
  FormState,
} from "../api/types.js";
import { useFieldKinds, useForm } from "../model/queries.js";
import {
  usePublishForm,
  useRotateLink,
  useSaveDraft,
  useSetFormState,
} from "../model/mutations.js";
import { FORMS_I18N_KEYS } from "../i18n/keys.js";

/** One row of the builder's field list, with everything the UI needs to draw
 * and judge it. */
export interface BuilderField {
  readonly field: FormFieldDef;
  /**
   * The kind's entry in the server's catalogue, or `undefined` when the
   * catalogue has not loaded yet or does not list this kind at all (a stored
   * schema can outlive a host's `FIELD_KINDS` allowlist).
   */
  readonly kindInfo: FieldKind | undefined;
  /** The kind's config declaration, straight from
   * `stapel_attributes.config_form()` via `GET /field-kinds`. Empty for a
   * builder-less kind. */
  readonly configFields: readonly ConfigFieldSpec[];
  /**
   * True when this field's options cannot be edited here. TWO server signals
   * feed it, and they are different facts:
   *
   *  - `registered: false` — the host allowlisted a kind the attributes
   *    registry does not carry. The field is still listed, because a stored
   *    schema may already use it and a builder that dropped the kind would
   *    silently drop the field.
   *  - `fields: []` — the kind is registered but declares no config form at
   *    all (this is how `convertible_unit` arrives).
   *
   * Either way the field stays LISTED, reorderable and removable, and stays
   * authorable through the draft PUT.
   */
  readonly builderLess: boolean;
  /** Config-widget kinds in this field's declaration that the SKIN has no
   * editor for. Named so the UI can say which options it is not showing rather
   * than presenting a partial form as a complete one. */
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

  /**
   * The kinds the builder may offer, from the server's catalogue: allowed by
   * this deployment, carried by the attributes registry, and declaring a
   * config form. `LoadState` rather than a bare array — a catalogue that
   * failed to load must not read as "this deployment has no field kinds".
   */
  readonly availableKinds: LoadState<readonly FieldKind[]>;
  /** The config-WIDGET vocabulary (`config_form.FIELD_KINDS`) and the params
   * each widget understands, for a skin rendering the config rows. */
  readonly configWidgets: Readonly<Record<string, readonly string[]>>;

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

/**
 * The config-WIDGET kinds the `/default` skin can draw (`ConfigField`).
 *
 * Upstream's widget vocabulary is 13 entries; the skin implements 11. The two
 * it does not — `hierarchical_options` (a tree editor) and `timestamp_array` —
 * make the individual config ROW unrenderable, not the whole kind, so a field
 * declaring one still gets its other options and the UI names what it is not
 * showing. Kept here rather than imported from `/default` so the headless bag
 * can report it without pulling antd into the main bundle.
 */
const SKIN_CONFIG_WIDGETS: ReadonlySet<string> = new Set([
  "number",
  "text",
  "checkbox",
  "translatable_text",
  "number_options",
  "string_options",
  "color_options",
  "select",
  "select_options_with_default",
  "max_selected_dropdown",
  "timestamp",
]);

/**
 * The config a freshly-added field starts with: every default the SERVER's
 * declaration carries, and nothing else.
 *
 * Keys with no declared default stay ABSENT rather than written as `null` —
 * the engine reads an absent key as "use my own default", and writing one
 * changes stored behaviour.
 */
function defaultConfigFor(kind: FieldKind | undefined): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  for (const spec of kind?.fields ?? []) {
    if (spec.default !== undefined) config[spec.name] = spec.default;
  }
  return config;
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
 * skin that renders it: a field's options come from `GET /field-kinds`, which
 * serves `stapel_attributes.config_form()` verbatim. Until stapel-forms 0.2.0
 * there was no such route and the pair had to mirror those declarations in
 * TypeScript — a table that drifts silently. Reading the registry makes the
 * declaration the single source of truth again: a type registered through
 * `EXTRA_TYPES` shows up here with no client release at all (spec §8).
 */
export function FormBuilder(props: {
  workspaceId: string;
  formId: string;
  children: (bag: FormBuilderBag) => ReactNode;
}): ReactNode {
  const query = useForm(props.workspaceId, props.formId);
  const state = loadStateFromQuery(query);
  const row = state.status === "ready" ? state.data : undefined;

  const kindsQuery = useFieldKinds(props.workspaceId);
  const kindsState = loadStateFromQuery(kindsQuery);
  const catalogue = kindsState.status === "ready" ? kindsState.data : undefined;
  const kindsBySlug = useMemo(() => {
    const map = new Map<string, FieldKind>();
    for (const kind of catalogue?.kinds ?? []) map.set(kind.kind, kind);
    return map;
  }, [catalogue]);

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
        const kindInfo = kindsBySlug.get(field.kind);
        const configFields = kindInfo?.fields ?? [];
        return {
          field,
          kindInfo,
          configFields,
          // Both server signals collapse to one rendering decision here, but
          // they are reported separately on `kindInfo` so a skin can word them
          // differently: "this deployment does not know this kind" is not the
          // same news as "this kind has no options".
          builderLess:
            kindInfo === undefined ||
            kindInfo.registered === false ||
            configFields.length === 0,
          unsupportedConfigKeys: configFields
            .filter((spec) => !SKIN_CONFIG_WIDGETS.has(spec.kind))
            .map((spec) => spec.name),
        };
      }),
    [schema, kindsBySlug]
  );

  const addField = useCallback(
    (kind: string): void => {
      setSchema((current) => {
        const taken = new Set(current.fields.map((f) => f.slug));
        const config = defaultConfigFor(kindsBySlug.get(kind));
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
    [kindsBySlug]
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

  // Offer only what this deployment can actually build with: allowed by its
  // FIELD_KINDS setting, carried by the attributes registry, and declaring a
  // config form. A kind failing any of those is still RENDERABLE and still
  // authorable through the draft PUT — it is just not something the builder
  // can hand somebody a button for.
  const availableKinds: LoadState<readonly FieldKind[]> = useMemo(
    () =>
      mapLoad(kindsState, (cat) =>
        cat.kinds.filter(
          (kind) =>
            kind.allowed &&
            kind.registered &&
            (kind.fields?.length ?? 0) > 0
        )
      ),
    [kindsState]
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
    configWidgets: catalogue?.configWidgets ?? {},
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
