/** Canned stapel-forms payloads, in the shapes `docs/schema.json` declares. */
import type { FormFieldDef, PublicForm } from "../src/index.js";

export const PUBLIC_ID = "k3JhQ2Zt8uY1sVb7cD9xLg";
export const WORKSPACE_ID = "5cc26b64-0717-4562-b3fc-2c963f66a001";
export const FORM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
export const VERSION_ID = "9aa1a3f4-1111-4562-b3fc-2c963f66a777";
export const VERSION_ID_2 = "9aa1a3f4-2222-4562-b3fc-2c963f66a888";

export const NAME_FIELD: FormFieldDef = {
  slug: "name",
  kind: "string",
  name: "Your name",
  mandatory: true,
  config: { maxLength: 10 },
};

export const TOPIC_FIELD: FormFieldDef = {
  slug: "topic",
  kind: "select",
  name: "Topic",
  config: { options: ["Sales", "Support"], maxSelected: 1 },
};

export const BUDGET_FIELD: FormFieldDef = {
  slug: "budget",
  kind: "int",
  name: "Budget",
  config: { min: 10, max: 100 },
};

export function publicForm(
  overrides: Partial<PublicForm> = {}
): PublicForm {
  return {
    public_id: PUBLIC_ID,
    version_id: VERSION_ID,
    version: 3,
    meta: { title: "Contact us", submit_label: "Send" },
    fields: [NAME_FIELD, TOPIC_FIELD, BUDGET_FIELD],
    ...overrides,
  } as PublicForm;
}

export function formRow(overrides: Record<string, unknown> = {}): unknown {
  return {
    id: FORM_ID,
    workspace_id: WORKSPACE_ID,
    title: "Contact us",
    public_id: PUBLIC_ID,
    state: "open",
    active_version: 3,
    active_version_id: VERSION_ID,
    draft_schema: { fields: [NAME_FIELD], meta: { title: "Contact us" } },
    settings: { notify_emails: ["sales@example.com"] },
    submission_count: 2,
    created_at: "2026-08-21T10:00:00+00:00",
    updated_at: "2026-08-21T10:00:00+00:00",
    deleted_at: null,
    ...overrides,
  };
}

export const VERSIONS: unknown[] = [
  {
    id: VERSION_ID,
    form_id: FORM_ID,
    version: 3,
    published_at: "2026-08-21T10:00:00+00:00",
    created_by: null,
    submission_count: 2,
    schema: { fields: [NAME_FIELD, TOPIC_FIELD], meta: {} },
  },
  {
    id: VERSION_ID_2,
    form_id: FORM_ID,
    version: 2,
    published_at: "2026-08-01T10:00:00+00:00",
    created_by: null,
    submission_count: 1,
    schema: { fields: [NAME_FIELD], meta: {} },
  },
];

export const SUBMISSIONS: unknown[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    form_id: FORM_ID,
    version: 3,
    version_id: VERSION_ID,
    answers: { name: "Ada", topic: ["Sales"] },
    submitted_at: "2026-08-21T11:00:00+00:00",
    submitted_by: null,
    client_meta: null,
    erased_at: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    form_id: FORM_ID,
    version: 2,
    version_id: VERSION_ID_2,
    answers: { name: "Grace" },
    submitted_at: "2026-08-21T10:30:00+00:00",
    submitted_by: null,
    client_meta: null,
    erased_at: null,
  },
];

/** A stapel error envelope, as the client parses it. */
export function envelope(
  code: string,
  params: Record<string, unknown> = {}
): { localizable_error: string; error: string; params: Record<string, unknown> } {
  return { localizable_error: code, error: code, params };
}

/**
 * `GET /field-kinds` — the shape stapel-forms 0.2.0 serves. `fields` is
 * `stapel_attributes.config_form.FormField.to_dict()` verbatim, params and
 * all, which is why `step`/`options`/`placeholder` sit UNDER `params`.
 */
export const FIELD_KINDS: unknown = {
  kinds: [
    {
      kind: "string",
      label_key: "admin.attributes.type.string",
      allowed: true,
      registered: true,
      fields: [
        { name: "minLength", kind: "number", label_key: "admin.attributes.form.string.minLength", params: { step: 1 } },
        { name: "maxLength", kind: "number", label_key: "admin.attributes.form.string.maxLength", params: { step: 1 } },
        { name: "multiline", kind: "checkbox", label_key: "admin.attributes.form.string.multiline", default: false },
        { name: "pattern", kind: "text", label_key: "admin.attributes.form.string.pattern" },
      ],
    },
    {
      kind: "select",
      label_key: "admin.attributes.type.select",
      allowed: true,
      registered: true,
      fields: [
        { name: "options", kind: "select_options_with_default", label_key: "admin.attributes.form.select.options" },
        {
          name: "uiStyle",
          kind: "select",
          label_key: "admin.attributes.form.select.uiStyle",
          required: true,
          default: "dropdown",
          params: { options: [{ value: "dropdown", label: "Dropdown" }, { value: "chips", label: "Chips/Tags" }] },
        },
        { name: "minSelected", kind: "number", label_key: "admin.attributes.form.select.minSelected", default: 0, params: { step: 1 } },
        { name: "maxSelected", kind: "max_selected_dropdown", label_key: "admin.attributes.form.select.maxSelected" },
      ],
    },
    {
      kind: "date",
      label_key: "admin.attributes.type.date",
      allowed: true,
      registered: true,
      fields: [
        { name: "precision", kind: "select", label_key: "admin.attributes.form.date.precision", required: true, default: "date", params: { options: [{ value: "date", label: "Date" }] } },
        // The one config widget this skin does not implement.
        { name: "options", kind: "timestamp_array", label_key: "admin.attributes.form.date.options" },
      ],
    },
    // Registered, allowed, but declares NO config form — builder-less signal 1.
    {
      kind: "convertible_unit",
      label_key: "admin.attributes.type.convertible_unit",
      allowed: true,
      registered: true,
      fields: [],
    },
    // Allowlisted by the host but absent from the attributes registry —
    // builder-less signal 2. Still listed so a stored schema keeps its field.
    {
      kind: "signature",
      label_key: "admin.attributes.type.signature",
      allowed: true,
      registered: false,
      fields: [],
    },
  ],
  config_widgets: {
    number: ["step"],
    text: ["placeholder"],
    checkbox: [],
    select: ["options"],
    select_options_with_default: [],
    max_selected_dropdown: [],
    timestamp_array: ["placeholder"],
  },
};
