/** Wire bodies in the shapes the generated schema declares. */
import type {
  DocDocument,
  DocFolder,
  DocumentAccessGrant,
  DocumentShareLink,
} from "@stapel/docs-react";
import { WORKSPACE_ID } from "./helpers.js";

export const FOLDER_A: DocFolder = {
  id: "f-a",
  workspace_id: WORKSPACE_ID,
  parent_id: null,
  name: "Finance",
  created_at: "2026-06-01T09:00:00Z",
  updated_at: "2026-08-14T09:00:00Z",
  is_starred: false,
};

export const FOLDER_B: DocFolder = { ...FOLDER_A, id: "f-b", name: "Photos" };

export const DOC_A: DocDocument = {
  id: "d-a",
  workspace_id: WORKSPACE_ID,
  folder_id: null,
  type: "file",
  title: "Warehouse.jpg",
  head_seq: 3,
  snapshot_seq: 3,
  size_bytes: 2_400_000,
  mime_type: "image/jpeg",
  metadata: {},
  editor_hint: "",
  collab: "snapshot",
  diffable: false,
  created_at: "2026-07-02T09:00:00Z",
  updated_at: "2026-08-19T11:05:00Z",
  is_starred: false,
};

export const DOC_B: DocDocument = {
  ...DOC_A,
  id: "d-b",
  title: "Supplier contract.pdf",
  mime_type: "application/pdf",
  size_bytes: 840_000,
};

/** A document that lives inside FOLDER_A — the root filter must drop it. */
export const DOC_IN_FOLDER: DocDocument = {
  ...DOC_A,
  id: "d-nested",
  title: "Nested.txt",
  mime_type: "text/plain",
  folder_id: FOLDER_A.id,
};

// ── sharing (stapel-docs 0.6) ────────────────────────────────────────────────

export const GRANT_A: DocumentAccessGrant = {
  id: "acc-a",
  document_id: DOC_A.id,
  subject_kind: "user",
  subject: "u-mira",
  level: "view",
  granted_by: "u-owner",
  suspended: false,
  created_at: "2026-09-02T10:00:00Z",
};

export const LINK_A: DocumentShareLink = {
  id: "lnk-a",
  document_id: DOC_A.id,
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
