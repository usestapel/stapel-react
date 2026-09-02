import type { DocDocument, DocFolder } from "@stapel/docs-react";

/**
 * One row of a drive listing: a folder or a document, in the shape both the
 * list and the grid render.
 *
 * The union is discriminated on `kind` and carries the ORIGINAL envelope, not
 * a lossy projection — a row action needs the document's `head_seq`, its mime
 * and its size, and re-fetching what the list already had is how a file
 * manager ends up making one request per tap.
 */
export type DriveRow =
  | {
      readonly kind: "folder";
      readonly id: string;
      readonly name: string;
      /** `null` when the request carries no user — not applicable ≠ not starred. */
      readonly isStarred: boolean | null;
      readonly folder: DocFolder;
    }
  | {
      readonly kind: "document";
      readonly id: string;
      readonly name: string;
      readonly isStarred: boolean | null;
      readonly document: DocDocument;
    };

/** A folder envelope as a row. */
export function folderRow(folder: DocFolder): DriveRow {
  return {
    kind: "folder",
    id: folder.id,
    name: folder.name,
    isStarred: folder.is_starred ?? null,
    folder,
  };
}

/** A document envelope as a row. */
export function documentRow(document: DocDocument): DriveRow {
  return {
    kind: "document",
    id: document.id,
    name: document.title,
    isStarred: document.is_starred ?? null,
    document,
  };
}

/**
 * Folders first, then documents, each group in the order the server listed
 * it.
 *
 * Folders-first is the file-manager convention every desktop and phone drive
 * follows, and it is done HERE rather than in each skin so the list and the
 * grid cannot disagree about the same folder's position. Within a group the
 * server's order is kept verbatim: re-sorting client-side would silently
 * override a backend ordering the endpoint may later make meaningful.
 */
export function driveRows(
  folders: readonly DocFolder[],
  documents: readonly DocDocument[]
): DriveRow[] {
  return [...folders.map(folderRow), ...documents.map(documentRow)];
}
