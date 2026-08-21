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
