/**
 * The wire bodies the skin demos are seeded from — the field names, the
 * snake_case and the ISO instants stapel-gdpr 0.5.x actually answers with
 * (`docs/schema.json`: `ClosureStatusDTO`, `ErasureStatusDTO`,
 * `ExportStatusDTO`, `DsarStatusDTO`, `DataOwnerHealthDTO`).
 *
 * A demo is a photograph of the product, so what it is seeded with has to be
 * something the server could have sent. Two rules these fixtures keep, and the
 * screens they feed depend on:
 *
 *  - `due_at` and `fully_erased_by` DIFFER. They are two clocks — ours, and
 *    the last subprocessor's contractual window — and a fixture where they
 *    were equal would let a screen that drew one column for both look right.
 *  - a state a variant is named for is IN the fixture. A variant seeded at the
 *    idle body and named "grace" photographs the wrong screen, which is the
 *    defect the whole demo gate exists to catch.
 */

/** The 404 that means "your account is not being deleted" — a state, not a fault. */
export const NO_ACTIVE_CLOSURE = [
  404,
  { localizable_error: "error.404.gdpr.no_active_closure", params: {} },
] as const;

/** The other 404 that is a state: no archive was ever asked for. */
export const EXPORT_NOT_FOUND = [
  404,
  { localizable_error: "error.404.gdpr.export_not_found", params: {} },
] as const;

/** The staff reads, refused for an ordinary member (`GET /dsar` is AllowAny). */
export const STAFF_ONLY = [
  403,
  { localizable_error: "error.403.forbidden", params: {} },
] as const;

/** A closure inside its cancellable grace period. */
export const CLOSURE_IN_GRACE = {
  status: "grace",
  grace_ends_at: "2026-09-23T09:00:00Z",
  can_cancel: true,
} as const;

/** Grace is over: the erasure is running and cannot be recalled. */
export const CLOSURE_DELETING = {
  status: "deleting",
  grace_ends_at: "2026-08-24T09:00:00Z",
  can_cancel: false,
} as const;

/** One entity erasure, still waiting on an owner, with both clocks. */
export const ERASURE_ERASING = {
  request_id: 17,
  subject_type: "recording",
  subject_key: "9f1c2d3e",
  workspace_id: "ws-42",
  state: "erasing",
  origin: "user",
  requested_at: "2026-08-24T09:00:00Z",
  due_at: "2026-09-23T09:00:00Z",
  fully_erased_by: "2026-10-18T09:00:00Z",
  completed_at: null,
  grace_ends_at: null,
  parts: [
    {
      owner: "recordings",
      state: "done",
      receipt_at: "2026-08-24T09:12:00Z",
      receipt_id: "recordings:job-8812",
      counts: { recordings: 3 },
    },
    { owner: "media", state: "pending", receipt_at: null, receipt_id: "", counts: {} },
  ],
  obligations: [
    {
      provider: "openai",
      window_days: 30,
      due_at: "2026-10-18T09:00:00Z",
      state: "pending",
    },
  ],
  unreceipted_owners: ["media"],
} as const;

/** An erasure an owner never receipted — the module marks it `timeout`. */
export const ERASURE_TIMEOUT = {
  request_id: 18,
  subject_type: "workspace",
  subject_key: "ws-42",
  workspace_id: "ws-42",
  state: "timeout",
  origin: "admin",
  requested_at: "2026-07-01T09:00:00Z",
  due_at: "2026-07-31T09:00:00Z",
  fully_erased_by: "2026-08-25T09:00:00Z",
  completed_at: null,
  grace_ends_at: null,
  parts: [
    {
      owner: "workspaces",
      state: "timeout",
      receipt_at: null,
      receipt_id: "",
      counts: {},
    },
  ],
  obligations: [],
  unreceipted_owners: ["workspaces"],
} as const;

/** An archive being built — nothing to download yet, and the poll is running. */
export const EXPORT_PROCESSING = {
  request_id: 43,
  status: "processing",
  parts_done: 1,
  parts_total: 5,
  download_available: false,
  expires_at: null,
  is_partial: false,
  missing_services: [],
} as const;

/** A finished archive with one section that could not be included. */
export const EXPORT_PARTIAL = {
  request_id: 42,
  status: "ready",
  parts_done: 4,
  parts_total: 5,
  download_available: true,
  expires_at: "2026-08-31T12:00:00Z",
  is_partial: true,
  missing_services: ["recordings"],
} as const;

/** A DSAR acknowledged by the automation, as they all should be. */
export const DSAR_ACKNOWLEDGED = {
  request_id: 5,
  kind: "access",
  channel: "form",
  subject_email: "person@example.com",
  state: "acknowledged",
  received_at: "2026-08-24T09:00:00Z",
  ack_due_at: "2026-08-27T09:00:00Z",
  ack_sent_at: "2026-08-24T09:00:03Z",
  resolve_due_at: "2026-09-23T09:00:00Z",
  erasure_request_id: null,
  export_request_id: 42,
  note: "",
} as const;

/**
 * Past its acknowledgement deadline with nothing sent — which means the
 * AUTOMATION is broken, not that an operator was slow. That distinction is the
 * whole reason the queue draws this row in red.
 */
export const DSAR_ACK_OVERDUE = {
  request_id: 6,
  kind: "erasure",
  channel: "form",
  subject_email: "someone@example.com",
  state: "received",
  received_at: "2026-01-02T09:00:00Z",
  ack_due_at: "2026-01-05T09:00:00Z",
  ack_sent_at: null,
  resolve_due_at: "2026-02-01T09:00:00Z",
  erasure_request_id: null,
  export_request_id: null,
  note: "",
} as const;

/** A data owner that is answering, for the subjects it declares. */
export const OWNER_ALIVE = {
  owner: "recordings",
  alive: true,
  last_alive_at: "2026-08-24T05:00:00Z",
  last_probe_at: "2026-08-24T05:00:00Z",
  declared_subject_types: ["account", "workspace", "meeting", "recording"],
  answered_subject_types: ["account", "workspace", "meeting", "recording"],
} as const;

/** The finding: declared, deployed, and never once answered. */
export const OWNER_SILENT = {
  owner: "workspaces",
  alive: false,
  last_alive_at: null,
  last_probe_at: "2026-08-24T05:00:00Z",
  declared_subject_types: ["account", "workspace"],
  answered_subject_types: [],
} as const;

/** Alive, but claiming a different set of subjects than the inventory says. */
export const OWNER_MISMATCHED = {
  owner: "agent",
  alive: true,
  last_alive_at: "2026-08-24T05:00:00Z",
  last_probe_at: "2026-08-24T05:00:00Z",
  declared_subject_types: ["account", "workspace", "meeting"],
  answered_subject_types: ["account", "workspace"],
} as const;
