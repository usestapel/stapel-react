/**
 * Wire fixtures for the drive-react demos — plain objects in the SHAPES the
 * generated schema declares (`FolderPresenterDTO`, `DocumentPresenterDTO`,
 * `SearchHitDTO`), so a demo cannot quietly document a field the server does
 * not send. `collab` is the discipline string, never a boolean; `is_starred`
 * is `true`/`false`/absent, never a stand-in for "unknown".
 */
import type { DocDocument, DocFolder } from "@stapel/docs-react";
import type { DriveSearchHit } from "../src/index.js";

export const WORKSPACE_ID = "ws-demo";

export const FOLDER_FINANCE: DocFolder = {
  id: "f-finance",
  workspace_id: WORKSPACE_ID,
  parent_id: null,
  name: "Finance",
  created_at: "2026-06-01T09:00:00Z",
  updated_at: "2026-08-14T09:00:00Z",
  is_starred: false,
};

export const FOLDER_PHOTOS: DocFolder = {
  ...FOLDER_FINANCE,
  id: "f-photos",
  name: "Photos",
  is_starred: true,
};

export const DOC_BUDGET: DocDocument = {
  id: "d-budget",
  workspace_id: WORKSPACE_ID,
  folder_id: null,
  type: "csv",
  title: "Q3 budget.csv",
  head_seq: 4,
  snapshot_seq: 4,
  size_bytes: 118_000,
  mime_type: "text/csv",
  metadata: {},
  editor_hint: "csv",
  collab: "snapshot",
  diffable: true,
  created_at: "2026-07-02T09:00:00Z",
  updated_at: "2026-08-19T11:05:00Z",
  is_starred: false,
};

export const DOC_PHOTO: DocDocument = {
  ...DOC_BUDGET,
  id: "d-photo",
  title: "Warehouse.jpg",
  type: "file",
  editor_hint: "",
  mime_type: "image/jpeg",
  size_bytes: 2_400_000,
  updated_at: "2026-08-28T16:20:00Z",
  is_starred: true,
};

export const DOC_CONTRACT: DocDocument = {
  ...DOC_BUDGET,
  id: "d-contract",
  title: "Supplier contract.pdf",
  type: "file",
  editor_hint: "",
  mime_type: "application/pdf",
  size_bytes: 840_000,
  updated_at: "2026-08-25T08:10:00Z",
  is_starred: false,
};

export const ROOT_FOLDERS: readonly DocFolder[] = [FOLDER_FINANCE, FOLDER_PHOTOS];
export const ROOT_DOCUMENTS: readonly DocDocument[] = [
  DOC_PHOTO,
  DOC_CONTRACT,
  DOC_BUDGET,
];

export const SEARCH_HITS: readonly DriveSearchHit[] = [
  {
    kind: "document",
    id: DOC_BUDGET.id,
    workspace_id: WORKSPACE_ID,
    name: DOC_BUDGET.title,
    parent_id: FOLDER_FINANCE.id,
    type: "csv",
    is_starred: false,
    breadcrumb: [{ id: FOLDER_FINANCE.id, name: FOLDER_FINANCE.name }],
  },
  {
    kind: "folder",
    id: FOLDER_PHOTOS.id,
    workspace_id: WORKSPACE_ID,
    name: FOLDER_PHOTOS.name,
    parent_id: null,
    type: null,
    is_starred: true,
    breadcrumb: [],
  },
];
