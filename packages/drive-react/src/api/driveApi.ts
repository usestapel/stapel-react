import type { StapelClient, StapelRequestOptions } from "@stapel/core";
import { thumbnailUrl } from "./thumbnails.js";
import { putWithProgress } from "./upload.js";
import type { PutProgressOptions, PutProgressResult } from "./upload.js";
import { fetchArchiveEntry } from "./archive.js";
import type { ArchiveEntryBytes, FetchArchiveEntryOptions } from "./archive.js";
import type {
  ArchiveListing,
  DriveSearchHit,
  DriveSearchParams,
  StarTarget,
  StarredListing,
  ThumbnailTier,
} from "./types.js";
import type { DocDocument, DocFolder } from "@stapel/docs-react";

/**
 * CSRF rule for cookie-authenticated browser clients (mirrors docs-react and
 * every other pair): always send `X-Requested-With: XMLHttpRequest` on
 * mutating requests. Header-token clients ignore it; it is harmless there.
 */
const CSRF_HEADERS: Record<string, string> = {
  "X-Requested-With": "XMLHttpRequest",
};

function mutating(): Omit<StapelRequestOptions, "method" | "body"> {
  return { headers: { ...CSRF_HEADERS } };
}

/** Optional raw-transport knobs `createDriveRuntime` forwards. */
export interface DriveApiOptions {
  readonly fetch?: typeof globalThis.fetch;
  readonly credentials?: RequestCredentials;
  readonly defaultHeaders?: Record<string, string>;
}

/**
 * The FIVE operations stapel-docs 0.5.0 added, and nothing else.
 *
 * Everything the drive product does to a folder or a document that existed
 * before this wave — list, create, rename, move, trash, restore, upload
 * ticket, finalize, download URL, content — is reached through
 * `@stapel/docs-react`'s `DocsApi` (a peer), which owns those paths. Copying
 * them here would make this package the second client for one backend, which
 * is the integration-seam defect the whole spec exists to avoid. So this
 * surface is deliberately small: the star verbs, the three new listings, the
 * thumbnail URL, and the one transport docs-react cannot supply (a PUT that
 * reports progress — see `api/upload.ts`).
 *
 * Paths are relative to the runtime's `baseUrl` (e.g. `/docs/api/v1/`) — the
 * SAME base the docs runtime uses, because these endpoints are that module's.
 * Hand-authored here, the one legal home of path strings
 * (`stapel/no-string-paths` §2.3 carve-out); every SHAPE is an alias of the
 * generated schema.
 */
export interface DriveApi {
  readonly client: StapelClient;

  // ── folder children, one rung (spec §4 — categories-cascade discipline) ────
  /**
   * `GET /folders?workspace_id=&parent_id=` — the DIRECT children of one
   * folder (`parent_id=""` for the workspace roots).
   *
   * The one pre-existing path this pair re-spells, and only because the
   * parameter that makes it a rung read is unreachable from docs-react:
   * `DocsApi.listFolders(workspaceId)` omits `parent_id`, so it answers the
   * WHOLE tree in one response — correct for a tree pane that draws all of it,
   * wrong for a phone that opens one folder at a time. Per-rung is the
   * categories cascade canon the spec names (§1.6/§4): one request per folder
   * opened, one cache entry per folder id, never a whole-tree sync.
   */
  listFolderChildren(
    workspaceId: string,
    parentId: string | null
  ): Promise<DocFolder[]>;

  // ── starred (spec §3.1) ────────────────────────────────────────────────────
  /** `POST`/`DELETE /documents|folders/:id/star` — idempotent, answers 204. */
  setStar(target: StarTarget, starred: boolean): Promise<void>;
  /** `GET /starred?workspace_id=` — mixed listing, live rows only. */
  listStarred(workspaceId: string): Promise<StarredListing>;

  // ── recents (spec §3.2) ────────────────────────────────────────────────────
  /** `GET /recents?workspace_id=` — documents, newest access first. */
  listRecents(workspaceId: string): Promise<DocDocument[]>;

  // ── search (spec §3.3) ─────────────────────────────────────────────────────
  /** `GET /search?q=` — tree-wide name search, each hit with a breadcrumb. */
  search(params: DriveSearchParams): Promise<DriveSearchHit[]>;

  // ── thumbnails (spec §3.6) ─────────────────────────────────────────────────
  /**
   * The authorized `GET /documents/:id/thumbnail?tier=` URL for an `<img>`.
   * A URL, not a fetch: the browser's own image loader carries the session
   * cookie exactly as it does for the content endpoint, and a blob round trip
   * would buy nothing but memory.
   */
  thumbnailUrl(documentId: string, tier: ThumbnailTier): string;

  // ── archives (zip as a compressed folder, stapel-docs 0.8.0) ──────────────
  /**
   * `GET /documents/:id/archive` — the zip's central directory as a listing.
   * The server reads it by ranged storage reads and refuses (413) past its
   * ceilings rather than truncating; encryption arrives as STATE
   * (`archive_encrypted` + per-entry flags), never as an error.
   */
  getArchiveListing(documentId: string): Promise<ArchiveListing>;
  /**
   * `GET /documents/:id/archive/entry?path=` — one member, extracted
   * server-side, as a Blob. A blob fetch and not a URL because the ZipCrypto
   * password travels in a header a media element's `src` cannot carry; the
   * object URL the caller mints from the blob is what feeds the viewer.
   */
  fetchArchiveEntry(
    documentId: string,
    path: string,
    options?: FetchArchiveEntryOptions
  ): Promise<ArchiveEntryBytes>;

  // ── upload transport ───────────────────────────────────────────────────────
  /**
   * Step 2 of the docs upload flow with REAL progress: a raw `PUT` at the
   * ticket's `put_url` over `XMLHttpRequest`. Same ticket contract as
   * docs-react's `uploadToPutUrl`; the transport differs because `fetch`
   * cannot observe request-body progress (see `api/upload.ts`).
   */
  putWithProgress(
    putUrl: string,
    blob: Blob,
    options?: PutProgressOptions
  ): Promise<PutProgressResult>;
}

export function createDriveApi(
  client: StapelClient,
  options?: DriveApiOptions
): DriveApi {
  const starPath = (target: StarTarget): string =>
    `/${target.kind === "folder" ? "folders" : "documents"}/${encodeURIComponent(target.id)}/star`;

  return {
    client,

    listFolderChildren: (workspaceId, parentId) =>
      client.get("/folders", {
        // The empty string is the wire's "workspace roots" and is NOT the
        // same as omitting the parameter (which asks for the whole tree), so
        // it is sent verbatim — core's `buildUrl` drops only `undefined`.
        query: { workspace_id: workspaceId, parent_id: parentId ?? "" },
      }),

    setStar: (target, starred) =>
      starred
        ? client.post(starPath(target), {}, mutating())
        : client.delete(starPath(target), mutating()),

    listStarred: (workspaceId) =>
      client.get("/starred", { query: { workspace_id: workspaceId } }),

    listRecents: (workspaceId) =>
      client.get("/recents", { query: { workspace_id: workspaceId } }),

    search: (params) =>
      client.get("/search", {
        query: {
          workspace_id: params.workspaceId,
          q: params.q,
          limit: params.limit,
        },
      }),

    thumbnailUrl: (documentId, tier) =>
      thumbnailUrl(client.baseUrl, documentId, tier),

    getArchiveListing: (documentId) =>
      client.get(`/documents/${encodeURIComponent(documentId)}/archive`),

    fetchArchiveEntry: (documentId, path, entryOptions) =>
      fetchArchiveEntry(
        {
          baseUrl: client.baseUrl,
          ...(options?.fetch !== undefined ? { fetch: options.fetch } : {}),
          ...(options?.credentials !== undefined
            ? { credentials: options.credentials }
            : {}),
          ...(options?.defaultHeaders !== undefined
            ? { headers: options.defaultHeaders }
            : {}),
        },
        documentId,
        path,
        entryOptions
      ),

    putWithProgress: (putUrl, blob, putOptions) =>
      putWithProgress(putUrl, blob, {
        ...putOptions,
        ...(options?.credentials !== undefined
          ? { credentials: options.credentials }
          : {}),
      }),
  };
}
