/**
 * Real-shaped bodies — the field names, the snake_case and the ISO instants
 * stapel-gdpr 0.5.x actually answers with (`docs/schema.json`:
 * `ClosureStatusDTO`, `ErasureStatusDTO`, `ExportStatusDTO`, `DsarStatusDTO`,
 * `DataOwnerHealthDTO`).
 *
 * The dates are the SERVER's and they are written the way the server writes
 * them, including the two that must differ: `due_at` (our own purge SLA) and
 * `fully_erased_by` (that, stretched to the last subprocessor window). A
 * fixture where those two were equal would let a component that renders one
 * column for both pass.
 */

/** A closure in its cancellable grace. */
export const IN_GRACE = {
  status: "grace",
  grace_ends_at: "2026-09-23T09:00:00Z",
  can_cancel: true,
} as const;

/** Grace is over: the erasure is running and cannot be recalled. */
export const DELETING = {
  status: "deleting",
  grace_ends_at: "2026-08-24T09:00:00Z",
  can_cancel: false,
} as const;

/** One entity erasure, still waiting on an owner. */
export const ERASURE_ERASING = {
  request_id: 17,
  subject_type: "recording",
  subject_key: "9f1c2d3e",
  workspace_id: "ws-42",
  state: "erasing",
  origin: "user",
  requested_at: "2026-08-24T09:00:00Z",
  due_at: "2026-09-23T09:00:00Z",
  // Later than `due_at` on purpose — this is the second clock.
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
    { owner: "workspaces", state: "timeout", receipt_at: null, receipt_id: "", counts: {} },
  ],
  obligations: [],
  unreceipted_owners: ["workspaces"],
} as const;

/** A finished one. */
export const ERASURE_DONE = {
  request_id: 19,
  subject_type: "document",
  subject_key: "doc-7",
  workspace_id: null,
  state: "deleted",
  origin: "user",
  requested_at: "2026-06-01T09:00:00Z",
  due_at: "2026-07-01T09:00:00Z",
  fully_erased_by: "2026-07-01T09:00:00Z",
  completed_at: "2026-06-01T09:11:00Z",
  grace_ends_at: null,
  parts: [],
  obligations: [],
  unreceipted_owners: [],
} as const;

/** An archive being built, with one section that could not be included. */
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

/** An archive still being prepared — nothing to download yet. */
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

/** An archive that has not been picked up by a worker yet — the first of the
 * two in-flight statuses a second request must not be issued over. */
export const EXPORT_PENDING = {
  request_id: 45,
  status: "pending",
  parts_done: 0,
  parts_total: 5,
  download_available: false,
  expires_at: null,
  is_partial: false,
  missing_services: [],
} as const;

/** The accepted export job (`POST /user/data-export/request`). */
export const EXPORT_ACCEPTED = {
  request_id: 44,
  status: "pending",
  message: "Your archive will be ready within 48 hours.",
} as const;

/** A DSAR that was acknowledged by the automation, as they all should be. */
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
 * A DSAR past its acknowledgement deadline with nothing sent — which means the
 * AUTOMATION failed, not that an operator was slow. Dates are in the past
 * relative to any plausible test clock.
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

/** A resolved one — past every deadline and correctly NOT overdue. */
export const DSAR_RESOLVED = {
  request_id: 7,
  kind: "rectification",
  channel: "app",
  subject_email: "member@example.com",
  state: "resolved",
  received_at: "2026-01-02T09:00:00Z",
  ack_due_at: "2026-01-05T09:00:00Z",
  ack_sent_at: "2026-01-02T09:00:02Z",
  resolve_due_at: "2026-02-01T09:00:00Z",
  erasure_request_id: null,
  export_request_id: null,
  note: "handled",
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
