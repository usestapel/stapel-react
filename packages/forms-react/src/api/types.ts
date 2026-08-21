/**
 * Wire types for the stapel-forms HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained. The
 * single source of truth is `components["schemas"]` from this pair's own
 * package-LOCAL generated schema (`./generated/schema.js`, produced by
 * `pnpm gen:api` from stapel-forms's OWN `docs/schema.json` — the §17-native
 * per-module contract). Alias the schemas this pair uses under local names
 * here; do NOT write parallel response bodies. Where drf-spectacular +
 * openapi-typescript under-describe the runtime, apply a small documented
 * correction — each one below states WHAT the generator lost and WHY the
 * correction is safe.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── the field vocabulary ─────────────────────────────────────────────────────

/**
 * The ten attribute kinds a stapel-forms schema may use
 * (`STAPEL_FORMS["FIELD_KINDS"]`, `conf.py::DEFAULT_FIELD_KINDS`). A host that
 * registers an extra `stapel_attributes` type server-side can put a kind here
 * that this union does not name — which is exactly why {@link FormFieldDef}
 * types `kind` as a plain `string` and the widget registry answers "unsupported
 * field" instead of crashing. This union is the CLOSED set the pair ships
 * builtin widgets for, not a claim about what the server may send.
 */
export type BuiltinFieldKind =
  | "string"
  | "int"
  | "float"
  | "bool"
  | "select"
  | "date"
  | "header"
  | "hex_color"
  | "hierarchical_select"
  | "convertible_unit";

/** Every {@link BuiltinFieldKind}, in the order the builder offers them. */
export const BUILTIN_FIELD_KINDS: readonly BuiltinFieldKind[] = [
  "string",
  "int",
  "float",
  "bool",
  "select",
  "date",
  "header",
  "hex_color",
  "hierarchical_select",
  "convertible_unit",
];

/**
 * One field of a form schema — a `stapel_attributes` `FeatureDef` dict.
 *
 * GENERATOR CORRECTION. `PublicFormDTO.fields` is declared
 * `{[key: string]: unknown}[]`: the backend serializes whatever
 * `coerce_feature_defs` accepts and drf-spectacular cannot see inside it. The
 * shape IS pinned by `stapel_attributes.FeatureDef` (slug/config/name/mandatory
 * /show_at_title/show_as_badge/translate) and by `stapel_forms.schema`'s
 * validator, so naming the fields here is a correction, not an invention. The
 * `& Record<string, unknown>` tail keeps an EXTRA_TYPES field's own keys
 * reachable without a cast.
 *
 * `config` keys are **camelCase** (`maxLength`, not `max_length`) — backend
 * delta note 1: the type dataclasses drop unknown keys silently, so a
 * snake_case typo is a constraint that does not exist. `publish` refuses those
 * with `error.400.forms_invalid_schema` carrying `params.key`.
 */
export type FormFieldDef = {
  /** Answer key. Unique per schema (`error.400.forms_duplicate_slug`). */
  readonly slug: string;
  /** The attribute type. A kind outside {@link BuiltinFieldKind} is legal
   * server-side and renders through the unsupported-field notice. */
  readonly kind: string;
  /** Admin-authored label. NOT an i18n key — see the i18n note in README. */
  readonly name?: string;
  /** Kind-specific configuration, camelCase keys. */
  readonly config?: Readonly<Record<string, unknown>>;
  /** Required — the client mirrors it, the server decides it. */
  readonly mandatory?: boolean;
  readonly show_at_title?: boolean;
  readonly show_as_badge?: boolean;
  readonly translate?: boolean;
} & Record<string, unknown>;

/**
 * A form schema's non-field metadata (`stapel_forms.schema.META_KEYS`). Every
 * key is optional and admin-authored; `logic` is deliberately absent (v1 has no
 * conditional branching, and reserving the key keeps adding it additive).
 */
export interface FormSchemaMeta {
  readonly title?: string;
  readonly description?: string;
  readonly confirmation_text?: string;
  readonly submit_label?: string;
}

/** The stored/authored schema envelope: `{fields, meta}`. */
export interface FormSchema {
  readonly fields: readonly FormFieldDef[];
  readonly meta?: FormSchemaMeta;
}

// ── the public (anonymous) surface ───────────────────────────────────────────

/**
 * `GET /public/<public_id>/` 200 — what an anonymous respondent may know.
 *
 * GENERATOR CORRECTION, twice over: `fields` is narrowed to
 * {@link FormFieldDef}[] (see above) and made REQUIRED. drf-spectacular marks
 * only `public_id`/`version`/`version_id` required because the presenter's
 * dataclass gives `fields`/`meta` defaults — but the view never omits them, and
 * a renderer that must branch on `fields === undefined` would be branching on a
 * case the server cannot produce.
 */
export type PublicForm = Omit<Schemas["PublicFormDTO"], "fields" | "meta"> & {
  readonly fields: readonly FormFieldDef[];
  readonly meta: FormSchemaMeta;
};

/** `POST /public/<public_id>/submissions/` body. `answers` are BARE SCALARS
 * keyed by slug — a `select` answer may be a single value and the server
 * normalizes it to a list. `version_id` is echoed back from the rendered
 * schema; omitting it forfeits the clean 409 and risks mis-validation. */
export interface SubmitRequest {
  readonly answers: Readonly<Record<string, unknown>>;
  readonly version_id?: string | null;
  /** The captcha seam (spec §12 risk 3): the netintel tier decides whether a
   * token is required at all, so it stays optional and the captcha layer
   * refuses on its own terms. */
  readonly captcha_token?: string;
}

/** `POST .../submissions/` 201 — deliberately NOT the submission id (there is
 * no public read of submissions). */
export type SubmitResult = Schemas["SubmitResultDTO"];

// ── the admin surface ────────────────────────────────────────────────────────

/** `open | closed | draft`. */
export type FormState = Schemas["StateEnum"];

/**
 * A `Form` row as its workspace's admins see it.
 *
 * GENERATOR CORRECTION: `draft_schema` is narrowed from `{[k: string]: unknown}`
 * to {@link FormSchema} — the builder reads `.fields` off it, and the backend
 * stores exactly the normalized envelope. `settings` keeps its open shape (a
 * host may add keys) but names the destinations the pair drives.
 */
export type FormRow = Omit<
  Schemas["FormPresenterDTO"],
  "draft_schema" | "settings"
> & {
  readonly draft_schema: FormSchema | null;
  readonly settings: FormSettings;
};

/**
 * `Form.settings` — an open bag whose notification keys the pair drives.
 * Backend delta note 4: the spec's `notify_channels` was NOT built. Channels
 * are a property of the routing entry; what a form needs is DESTINATIONS, so
 * these keys name destinations and map to `request_notification` keywords
 * through `notifications.TARGET_KINDS`.
 */
export type FormSettings = {
  readonly notify_emails?: readonly string[];
  readonly notify_telegram_chat_ids?: readonly string[];
} & Record<string, unknown>;

/** `POST /forms` body. */
export interface FormCreateRequest {
  readonly workspace_id: string;
  readonly title: string;
  readonly settings?: FormSettings;
  readonly draft_schema?: FormSchema;
}

/** `PATCH /forms/<id>` body — title and settings only; the schema moves
 * through `draft` + `publish`, never through a partial update. */
export interface FormPatchRequest {
  readonly title?: string;
  readonly settings?: FormSettings;
}

/** `POST /forms/<id>/publish` 200 — the new immutable version. */
export type PublishResult = Schemas["PublishResultDTO"];

/** One published, immutable schema version. */
export type FormVersion = Omit<Schemas["FormVersionPresenterDTO"], "schema"> & {
  readonly schema: FormSchema;
};

/** One response, as a reviewer sees it. `answers` is `{slug: value}` (the raw
 * DAO's display metadata is dropped — the reviewer has it from the version). */
export type Submission = Schemas["SubmissionPresenterDTO"];

/** `POST /submissions/<id>/resend` body. Backend delta note 7: given either
 * list, the form's configured targets are REPLACED, not supplemented — "send
 * this one to legal" must not also re-send it to everyone who already has it. */
export interface ResendRequest {
  readonly recipients?: readonly string[];
  readonly telegram_chat_ids?: readonly string[];
}

/** `POST /submissions/<id>/resend` 200. */
export type ResendResult = Schemas["ResendResultDTO"];

/** Query for the keyset-paginated submission list. */
export interface SubmissionListParams {
  readonly workspaceId: string;
  readonly formId: string;
  /** Keyset cursor — the previous page's last `submitted_at`. */
  readonly before?: string;
  readonly limit?: number;
  /** Restrict to answers of one schema version. */
  readonly version?: number;
}

// ── the field-kind catalogue (the builder's dictionary) ──────────────────────

/**
 * One declared config-form field, passed through from stapel-attributes'
 * `config_form.FormField.to_dict()` VERBATIM by the backend — so a kind gains
 * config fields upstream with no release on either side of the wire.
 *
 * GENERATOR CORRECTION: `FieldKindDTO.fields` is declared
 * `{[key: string]: unknown}[]` because drf-spectacular cannot see inside a
 * pass-through. The shape is pinned by `FormField.to_dict()`, so naming it here
 * is a correction rather than an invention; the `& Record<string, unknown>`
 * tail keeps a host widget's own params reachable without a cast.
 */
export type ConfigFieldSpec = {
  /** The config key this field edits. Order within a kind is significant. */
  readonly name: string;
  /** A key of {@link FieldKindCatalogue.configWidgets} — the WIDGET
   * vocabulary, not the feature-type vocabulary. */
  readonly kind: string;
  /** Upstream i18n key, `admin.attributes.form.<type>.<field>`. */
  readonly label_key: string;
  /** Cosmetic `*` marker only — real validation is server-side. */
  readonly required?: boolean;
  /** Applied when the config key is absent. */
  readonly default?: unknown;
  /** Widget-specific params (`step`, `itemType`, inline `options`,
   * `placeholder`, …). Only keys the widget understands are meaningful. */
  readonly params?: Readonly<Record<string, unknown>>;
} & Record<string, unknown>;

/** One field kind the builder may offer. */
export type FieldKind = Omit<Schemas["FieldKindDTO"], "fields"> & {
  /**
   * The kind's config-form declaration. **Empty means the kind declares no
   * config form** (upstream `BUILTIN_FORMS` simply has no entry — this is how
   * `convertible_unit` arrives), which is one of the two builder-less signals.
   */
  readonly fields: readonly ConfigFieldSpec[];
};

/**
 * `GET /field-kinds` 200 — the whole catalogue behind the builder.
 *
 * `config_widgets` is upstream's `config_form.FIELD_KINDS`: the widget
 * vocabulary a declaration's `kind` draws from, mapped to the params each
 * widget understands. Named apart from `kinds` on purpose — forms' own
 * `FIELD_KINDS` setting is the feature-TYPE allowlist, and two different things
 * under one name is how a builder ends up drawing a `number` where a `string`
 * belongs.
 */
export interface FieldKindCatalogue {
  readonly kinds: readonly FieldKind[];
  readonly configWidgets: Readonly<Record<string, readonly string[]>>;
}
