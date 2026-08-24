/**
 * Wire fixtures for the docs-react demos — plain objects in the SHAPES the
 * generated schema declares (`DocumentPresenterDTO`, `FolderPresenterDTO`,
 * `RevisionPresenterDTO`), so a demo cannot quietly document a field the
 * server does not send. `collab` is the discipline string, never a boolean.
 */
import type { DocDocument, DocFolder, DocRevision } from "../src/index.js";

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
