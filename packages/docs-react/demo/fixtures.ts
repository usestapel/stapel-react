/**
 * Wire fixtures for the docs-react demos — plain objects in the SHAPES the
 * generated schema declares (`DocumentPresenterDTO`, `FolderPresenterDTO`,
 * `RevisionPresenterDTO`), so a demo cannot quietly document a field the
 * server does not send. `collab` is the discipline string, never a boolean.
 */
import type {
  DocDocument,
  DocFolder,
  DocRevision,
  DocumentAccessGrant,
  DocumentShareLink,
  SharedDocument,
} from "../src/index.js";

export const WORKSPACE_ID = "ws-demo";

export const FOLDER_SPECS: DocFolder = {
  id: "f-specs",
  workspace_id: WORKSPACE_ID,
  parent_id: null,
  name: "Specifications",
  created_at: "2026-06-01T09:00:00Z",
  updated_at: "2026-08-14T09:00:00Z",
};

export const FOLDER_DRAFTS: DocFolder = {
  ...FOLDER_SPECS,
  id: "f-drafts",
  parent_id: "f-specs",
  name: "Drafts",
};

export const DOC_NOTES: DocDocument = {
  id: "d-notes",
  workspace_id: WORKSPACE_ID,
  folder_id: null,
  type: "md",
  title: "Release notes",
  head_seq: 7,
  snapshot_seq: 7,
  size_bytes: 4210,
  mime_type: "text/markdown",
  metadata: {},
  editor_hint: "markdown",
  collab: "snapshot",
  diffable: true,
  created_at: "2026-07-02T09:00:00Z",
  updated_at: "2026-08-21T16:20:00Z",
};

export const DOC_BUDGET: DocDocument = {
  ...DOC_NOTES,
  id: "d-budget",
  title: "Q3 budget",
  type: "csv",
  editor_hint: "csv",
  mime_type: "text/csv",
  size_bytes: 118,
  updated_at: "2026-08-19T11:05:00Z",
};

export const DOC_CONTRACT: DocDocument = {
  ...DOC_NOTES,
  id: "d-contract",
  title: "Supplier contract.pdf",
  type: "file",
  editor_hint: "",
  mime_type: "application/pdf",
  size_bytes: 2_412_800,
  diffable: false,
  updated_at: "2026-08-11T08:40:00Z",
};

/** A crdt-discipline type a host registered — the extension seam the default
 * skin has no editor for, and says so instead of offering a broken save. */
export const DOC_COLLAB: DocDocument = {
  ...DOC_NOTES,
  id: "d-collab",
  title: "Roadmap (live)",
  type: "board",
  editor_hint: "board",
  collab: "crdt",
  updated_at: "2026-08-23T14:00:00Z",
};

export const REVISION_HEAD: DocRevision = {
  id: "rev-head",
  document_id: "d-notes",
  kind: "auto",
  name: "",
  seq: 7,
  size_bytes: 4210,
  created_by: "u-1",
  created_at: "2026-08-21T16:20:00Z",
};

export const REVISION_NAMED: DocRevision = {
  ...REVISION_HEAD,
  id: "rev-named",
  kind: "named",
  name: "Before the rewrite",
  seq: 5,
  created_at: "2026-08-18T10:02:00Z",
};

export const MARKDOWN_BODY = "# Release notes\n\n- Faster uploads\n- Trash retention\n";
export const CSV_BODY = "region,revenue\nEU,120400\nUS,98150\n";

// ── sharing (stapel-docs 0.6) ────────────────────────────────────────────────

export const GRANT_USER: DocumentAccessGrant = {
  id: "acc-1",
  document_id: DOC_NOTES.id,
  subject_kind: "user",
  subject: "u-mira",
  level: "view",
  granted_by: "u-owner",
  suspended: false,
  created_at: "2026-08-30T10:00:00Z",
};

export const GRANT_REF: DocumentAccessGrant = {
  ...GRANT_USER,
  id: "acc-2",
  subject_kind: "ref",
  subject: "chat:conversation:c-77",
  level: "edit",
};

/** The kill-switch row: listed, marked inert, NOT hidden. */
export const GRANT_SUSPENDED: DocumentAccessGrant = {
  ...GRANT_USER,
  id: "acc-3",
  subject: "u-boris",
  suspended: true,
};

export const LINK_ACTIVE: DocumentShareLink = {
  id: "lnk-1",
  document_id: DOC_NOTES.id,
  token: "0xk3nEXAMPLEtoken",
  level: "view",
  status: "active",
  expires_at: "2026-10-02T10:00:00Z",
  revoked_at: null,
  first_redeemed_at: null,
  created_by: "u-owner",
  suspended: false,
  created_at: "2026-09-02T10:00:00Z",
};

/** Somebody actually opened this one — the stamp is evidence, not a counter. */
export const LINK_REDEEMED: DocumentShareLink = {
  ...LINK_ACTIVE,
  id: "lnk-2",
  token: "9pQ2EXAMPLEtoken",
  first_redeemed_at: "2026-09-02T14:31:00Z",
};

export const LINK_SUSPENDED: DocumentShareLink = {
  ...LINK_ACTIVE,
  id: "lnk-3",
  token: "z7mHEXAMPLEtoken",
  suspended: true,
};

/** The bearer's stripped envelope — no workspace, no folder, no owner. */
export const SHARED_NOTES: SharedDocument = {
  id: DOC_NOTES.id,
  type: DOC_NOTES.type,
  title: DOC_NOTES.title,
  head_seq: DOC_NOTES.head_seq,
  size_bytes: DOC_NOTES.size_bytes,
  mime_type: DOC_NOTES.mime_type,
  editor_hint: DOC_NOTES.editor_hint,
  collab: "snapshot",
  diffable: true,
  level: "view",
  updated_at: DOC_NOTES.updated_at,
};
