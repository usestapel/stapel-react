/**
 * Canned stapel-forms payloads for the demos — the shapes the real backend
 * serves (`docs/schema.json` presenters), trimmed to what a demo shows.
 */

export const DEMO_PUBLIC_ID = "k3JhQ2Zt8uY1sVb7cD9xLg";
export const DEMO_WORKSPACE_ID = "5cc26b64-0717-4562-b3fc-2c963f66a001";
export const DEMO_FORM_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const DEMO_VERSION_ID = "9aa1a3f4-1111-4562-b3fc-2c963f66a777";

/** A schema exercising several kinds at once, including one the app cannot
 * draw — so the unsupported-field notice is visible in the gallery. */
export const DEMO_PUBLIC_FORM = {
  public_id: DEMO_PUBLIC_ID,
  version_id: DEMO_VERSION_ID,
  version: 3,
  meta: {
    title: "Contact us",
    description: "We usually reply within one working day.",
    submit_label: "Send",
    confirmation_text: "Thanks — we have your message.",
  },
  fields: [
    { slug: "intro", kind: "header", name: "About you", config: { style: "m" } },
    { slug: "name", kind: "string", name: "Your name", mandatory: true, config: { maxLength: 80 } },
    {
      slug: "message",
      kind: "string",
      name: "Message",
      mandatory: true,
      config: { multiline: true, maxLength: 2000 },
    },
    {
      slug: "topic",
      kind: "select",
      name: "Topic",
      config: { options: ["Sales", "Support", "Other"], maxSelected: 1 },
    },
    { slug: "budget", kind: "int", name: "Budget", config: { min: 0, max: 100000 } },
    { slug: "callback", kind: "bool", name: "Call me back" },
    { slug: "when", kind: "date", name: "Preferred date", config: { precision: "date" } },
    // No widget anywhere for this one — the notice, not a silent omission.
    { slug: "sketch", kind: "signature", name: "Signature" },
  ],
};

export const DEMO_FORM_ROW = {
  id: DEMO_FORM_ID,
  workspace_id: DEMO_WORKSPACE_ID,
  title: "Contact us",
  public_id: DEMO_PUBLIC_ID,
  state: "open",
  active_version: 3,
  active_version_id: DEMO_VERSION_ID,
  draft_schema: {
    fields: [
      { slug: "name", kind: "string", name: "Your name", mandatory: true, config: {} },
      {
        slug: "topic",
        kind: "select",
        name: "Topic",
        config: { options: ["Sales", "Support"], uiStyle: "dropdown", minSelected: 0 },
      },
    ],
    meta: { title: "Contact us" },
  },
  settings: { notify_emails: ["sales@example.com"] },
  submission_count: 240,
  created_at: "2026-08-21T10:00:00+00:00",
  updated_at: "2026-08-21T10:00:00+00:00",
  deleted_at: null,
};

export const DEMO_VERSIONS = [
  {
    id: DEMO_VERSION_ID,
    form_id: DEMO_FORM_ID,
    version: 3,
    published_at: "2026-08-21T10:00:00+00:00",
    created_by: null,
    submission_count: 240,
    schema: {
      fields: [
        { slug: "name", kind: "string", name: "Your name" },
        { slug: "topic", kind: "select", name: "Topic" },
      ],
      meta: {},
    },
  },
];

export const DEMO_SUBMISSIONS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    form_id: DEMO_FORM_ID,
    version: 3,
    version_id: DEMO_VERSION_ID,
    answers: { name: "Ada Lovelace", topic: ["Sales"] },
    submitted_at: "2026-08-21T11:00:00+00:00",
    submitted_by: null,
    client_meta: null,
    erased_at: null,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    form_id: DEMO_FORM_ID,
    version: 3,
    version_id: DEMO_VERSION_ID,
    answers: { name: "Grace Hopper", topic: ["Support"] },
    submitted_at: "2026-08-21T10:30:00+00:00",
    submitted_by: null,
    client_meta: null,
    erased_at: null,
  },
];

/** `GET /field-kinds` — the builder's dictionary (stapel-forms 0.2.0). */
export const DEMO_FIELD_KINDS = {
  kinds: [
    {
      kind: "string",
      label_key: "admin.attributes.type.string",
      allowed: true,
      registered: true,
      fields: [
        { name: "maxLength", kind: "number", label_key: "admin.attributes.form.string.maxLength", params: { step: 1 } },
        { name: "multiline", kind: "checkbox", label_key: "admin.attributes.form.string.multiline", default: false },
      ],
    },
    {
      kind: "select",
      label_key: "admin.attributes.type.select",
      allowed: true,
      registered: true,
      fields: [
        { name: "options", kind: "select_options_with_default", label_key: "admin.attributes.form.select.options" },
        { name: "minSelected", kind: "number", label_key: "admin.attributes.form.select.minSelected", default: 0, params: { step: 1 } },
      ],
    },
    // Declares no config form — one of the two builder-less signals.
    {
      kind: "convertible_unit",
      label_key: "admin.attributes.type.convertible_unit",
      allowed: true,
      registered: true,
      fields: [],
    },
  ],
  config_widgets: { number: ["step"], checkbox: [], select_options_with_default: [] },
};
