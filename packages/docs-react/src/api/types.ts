/**
 * Wire types for the stapel-docs HTTP contract — **derived from the generated
 * OpenAPI surface** (frontend-standard §2/§3), never hand-maintained.
 *
 * §17-native per-module contract: stapel-docs is not part of any unified
 * schema — it emits its OWN `docs/schema.json`, so this pair generates a
 * package-LOCAL schema module (`pnpm gen:api` with
 * `API_SCHEMA=../stapel-docs/docs/schema.json`) and aliases the schemas it
 * uses from `./generated/schema.js`, exactly like recordings-react. Do NOT
 * write parallel response bodies here.
 *
 * The hand-authored shapes this file used to carry had measurably drifted:
 * `collab` was typed `boolean` where the wire sends `"crdt"`/`"snapshot"`,
 * and `DocRevision.author_id` was a field name the server has never sent
 * (it is `created_by`). Both are now impossible: the aliases below are the
 * generated schema.
 */
import type { components } from "./generated/schema.js";

/** The generated schema table — the one source of truth for wire shapes. */
export type Schemas = components["schemas"];

// ── aliases (the stapel-docs schemas this pair uses) ─────────────────────────

/** A folder in a workspace's document tree (`deleted_at` set while trashed). */
export type DocFolder = Schemas["FolderPresenterDTO"];

/**
 * The write discipline of a document's TYPE, fixed by the backend registry
 * (`doc_types.py`: `COLLAB_CHOICES = ("crdt", "snapshot")`, and a
 * `DocTypeSpec` with any other value refuses to construct).
 *
 * Narrowing a bare-`string` schema field is a documented correction, not an
 * invention (the calendar-react precedent): the contract enumerates the two
 * values in `DocumentPresenterDTO.collab`'s own description, the module
 * docstring states that "exactly two disciplines exist; a third must pass the
 * I1–I4 contract before it may be born", and the refusal
 * `error.400.docs_updates_not_crdt` names the axis. A widened `string` here
 * is what let `if (doc.collab)` read `true` for a snapshot document.
 */
export type DocCollab = "crdt" | "snapshot";

/**
 * A document head as read from `GET /documents/:id` — including the three
 * registry-derived fields (`editor_hint` / `collab` / `diffable`) that
 * degrade to file presentation for an unknown type rather than erroring.
 */
export type DocDocument = Omit<Schemas["DocumentPresenterDTO"], "collab"> & {
  /** Write discipline of the document's type — see {@link DocCollab}. */
  readonly collab: DocCollab;
};

/** A revision pointer: a self-contained full snapshot at `seq`. */
export type DocRevision = Schemas["RevisionPresenterDTO"];

/** One journal row of the `?since=` replay feed (crdt types only). */
export type DocUpdate = Schemas["JournalUpdateDTO"];

/** The replay-feed answer for `GET …/updates?since=`. */
export type DocUpdatesFeed = Schemas["UpdatesFeedDTO"];

/**
 * The OTHER answer `GET …/updates?since=` can give: the requested sequence
 * fell out of the retained journal, so the client must re-read the whole
 * content instead of replaying (`services.read_updates` → `present_resync`).
 *
 * DOCUMENTED CORRECTION: the view's `@extend_schema(responses={200:
 * UpdatesFeedSerializer})` declares only the feed branch, so `ResyncDTO` is
 * absent from `docs/schema.json` and cannot be aliased. Typed here from the
 * backend's `dto.ResyncDTO`; recorded as a backend schema gap in the wave's
 * REQUESTS file. Discriminate on `resync`, never on the absence of `updates`.
 */
export interface DocUpdatesResync {
  readonly resync: true;
  readonly head_seq: number;
  readonly snapshot_seq: number;
}

/** `GET /documents/:id/updates` — a replay feed, or an order to resync. */
export type DocUpdatesResponse = DocUpdatesFeed | DocUpdatesResync;

/** True when the journal read answered "re-read the content" (see above). */
export function isUpdatesResync(
  response: DocUpdatesResponse
): response is DocUpdatesResync {
  return (response as DocUpdatesResync).resync === true;
}

/** The outcome of an accepted journal append: the document's new head. */
export type AppendResult = Schemas["AppendResultDTO"];

// ── request bodies ───────────────────────────────────────────────────────────

export type CreateFolderRequest = Schemas["FolderCreate"];
export type PatchFolderRequest = Schemas["PatchedFolderPatch"];
export type CreateDocumentRequest = Schemas["DocumentCreate"];
export type PatchDocumentRequest = Schemas["PatchedDocumentPatch"];
export type CreateRevisionRequest = Schemas["NamedRevision"];
export type EmptyTrashRequest = Schemas["TrashEmpty"];
/** `POST /documents/:id/updates` — a BATCH of opaque encoded updates plus the
 * client's own dedup handle (the wire never took a single `payload`). */
export type PostUpdateRequest = Schemas["UpdatesAppend"];
export type CreateUploadRequest = Schemas["UploadCreate"];

/**
 * `POST /uploads` 2xx body: the created document + where to PUT the bytes,
 * and `expires_at` — the instant the ticket stops being spendable (`null`
 * only where the host disabled the TTL). On the local-storage backend profile
 * `put_url` is NOT writable; callers fall back to `PUT /documents/:id/content`
 * (see `useUpload`).
 */
export type CreateUploadResponse = Schemas["UploadTicketDTO"];

/** `GET /documents/:id/download` body — an opaque (possibly expiring) URL. */
export type DownloadUrl = Schemas["DownloadUrlDTO"];

/** `PUT /documents/:id/content` 200 body. */
export type SaveContentOk = Schemas["SaveResultDTO"];

/** Counts of irreversibly purged trash items (`POST /trash/empty`). */
export type TrashPurgeResult = Schemas["TrashPurgeResultDTO"];

/**
 * `GET /trash` body — everything soft-deleted in the workspace, folders and
 * documents in their own arrays.
 *
 * DOCUMENTED CORRECTION: `TrashView.get` is decorated
 * `@extend_schema(responses={200: None})`, so the generated operation carries
 * "No response body" and there is no schema to alias. The shape below is the
 * view's literal response (`{"folders": FolderSerializer(...), "documents":
 * DocumentSerializer(...)}`), composed from the two aliases above so the ROW
 * types cannot drift even while the envelope is unschema'd. Recorded as a
 * backend schema gap in the wave's REQUESTS file.
 */
export interface TrashListing {
  readonly folders: readonly DocFolder[];
  readonly documents: readonly DocDocument[];
}

// ── query params (camelCase JS-facing shapes, not wire bodies) ───────────────

/** Query for `GET /documents` (list routes need `?workspace_id=`). */
export interface DocumentListParams {
  readonly workspaceId: string;
  readonly folderId?: string;
  readonly type?: string;
  /** Full-text query. */
  readonly q?: string;
}

// ── content (raw-bytes surface — no JSON schema to alias) ────────────────────

/**
 * A refused save, folded from the wire (camelCase JS-facing shape):
 * - 409 — someone else saved past our `If-Match` seq; fields from the body
 *   (`{head_seq, saved_by, saved_at}`).
 * - 412 — bare precondition failure with no body; every field is `null` and
 *   the caller re-reads the head before retrying.
 */
export interface SaveConflict {
  readonly headSeq: number | null;
  readonly savedBy: string | null;
  readonly savedAt: string | null;
}

/**
 * The typed outcome of a content save: a 409/412 is a STATE the editor
 * renders (conflict banner + override), not an exception — so the api layer
 * folds it into this discriminated union instead of throwing.
 */
export type SaveContentResult =
  | {
      readonly status: "saved";
      readonly headSeq: number;
      /** The revision the save landed as. `null` where the backend answered
       * without one (`SaveResultDTO.revision_id` is nullable — a save that
       * changed nothing writes no revision). */
      readonly revisionId: string | null;
    }
  | { readonly status: "conflict"; readonly conflict: SaveConflict };

/** `GET /documents/:id/content` — the raw bytes plus the head sequence the
 * response headers carry (`X-Docs-Head-Seq`, mirrored in `ETag`). */
export interface DocumentContent {
  readonly blob: Blob;
  /** `null` only if the backend omitted the header (pre-contract tolerance). */
  readonly headSeq: number | null;
  readonly etag: string | null;
  readonly mimeType: string | null;
}
