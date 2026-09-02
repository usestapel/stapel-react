import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { StapelApiError, toStapelApiError } from "@stapel/core";
import { useDocsApi, docsQueryKeys } from "@stapel/docs-react";
import { useDriveApi } from "./context.js";
import { driveQueryKeys } from "./queryKeys.js";

/**
 * The multi-file upload queue — the drive product's one genuinely stateful
 * client-side machine.
 *
 * ── What it is, and what it deliberately is not ───────────────────────────
 *
 * It is NOT a second upload implementation. Every JSON step is
 * `@stapel/docs-react`'s: `POST /uploads` mints the ticket, `POST
 * /uploads/:id/finalize` closes it. Only the middle step — the presigned PUT —
 * runs through this pair's `putWithProgress`, because `fetch` cannot report
 * request-body progress and a bar is the point (see `api/upload.ts`).
 *
 * Three properties the tray needed and a `useMutation` per file cannot give:
 *
 *   · CONCURRENCY 2. Twenty files picked at once are twenty parallel PUTs to
 *     one object store on a phone radio: every bar crawls, the browser's own
 *     six-connection cap queues them invisibly, and the first file finishes
 *     last. Two at a time is the ladder the spec fixes, and the third file's
 *     "queued" is an honest state rather than a stalled 0%.
 *   · PER-FILE FAILURE. One refused file must not fail nineteen good ones, so
 *     each item carries its own error and its own retry.
 *   · A QUOTA STATE OF ITS OWN. `error.507.docs_workspace_quota` is not "the
 *     upload failed" — it is "this workspace is full", which no retry fixes
 *     and which the tray says once, at the top, with the action that helps
 *     (empty the trash / ask for more room). Folding it into the generic
 *     error line is the failure this flag exists to prevent.
 */

/** Where one queued file is in its life. */
export type UploadItemStatus =
  | "queued"
  | "uploading"
  | "done"
  | "failed"
  | "canceled";

/** One file in the tray. */
export interface UploadItem {
  /** Stable within this queue instance — the React key of the tray row. */
  readonly id: string;
  readonly name: string;
  readonly size: number;
  readonly status: UploadItemStatus;
  /** Bytes acknowledged by the object store. */
  readonly loaded: number;
  /** `0`–`1`, or `null` while the length is not computable. */
  readonly progress: number | null;
  /** Folded into core's one dialect; `null` unless `status === "failed"`. */
  readonly error: StapelApiError | null;
  /** The workspace ran out of room — a distinct, unretryable refusal. */
  readonly quotaExceeded: boolean;
  /** The created document, once finalize has answered. */
  readonly documentId: string | null;
}

/** Options for {@link useUploadQueue}. */
export interface UploadQueueOptions {
  readonly workspaceId: string;
  /** Destination folder; omitted uploads to the workspace root. */
  readonly folderId?: string | undefined;
  /** Files in flight at once. Default 2 (see the header). */
  readonly concurrency?: number;
}

/** What {@link useUploadQueue} returns. */
export interface UploadQueueBag {
  readonly items: readonly UploadItem[];
  /** Add files (a picker selection, a drop). Uploading starts immediately. */
  add(files: readonly File[]): void;
  /** Re-run one failed item from its first step (a fresh ticket). */
  retry(itemId: string): void;
  /** Abort an in-flight item, or drop a queued one. */
  cancel(itemId: string): void;
  /** Drop every finished row (done / failed / canceled) from the tray. */
  clearFinished(): void;
  readonly isUploading: boolean;
  /** True while any item failed on the workspace quota (spec §4). */
  readonly quotaExceeded: boolean;
}

/** The workspace-full refusal, by code and by status. */
const QUOTA_CODE = "error.507.docs_workspace_quota";

function isQuota(error: StapelApiError): boolean {
  return error.code === QUOTA_CODE || error.status === 507;
}

/** An abort is a user's decision, never a failure to report. */
function isAbort(thrown: unknown): boolean {
  return thrown instanceof DOMException && thrown.name === "AbortError";
}

export const DEFAULT_UPLOAD_CONCURRENCY = 2;

export function useUploadQueue(options: UploadQueueOptions): UploadQueueBag {
  const docsApi = useDocsApi();
  const driveApi = useDriveApi();
  const queryClient = useQueryClient();
  const concurrency = options.concurrency ?? DEFAULT_UPLOAD_CONCURRENCY;

  const [items, setItems] = useState<readonly UploadItem[]>([]);
  // The File objects live outside React state: they are not serializable, they
  // never change, and putting a 40 MB blob through every render's identity
  // comparison is a cost for nothing.
  const filesRef = useRef(new Map<string, File>());
  const abortsRef = useRef(new Map<string, AbortController>());
  const runningRef = useRef(new Set<string>());
  const seqRef = useRef(0);

  const patch = useCallback(
    (itemId: string, next: Partial<UploadItem>): void => {
      setItems((current) =>
        current.map((item) => (item.id === itemId ? { ...item, ...next } : item))
      );
    },
    []
  );

  // The workspace/folder the running transfers were started for. Read through
  // a ref inside `run` so a re-render with a new folder cannot retarget a
  // transfer that is already in flight.
  const scopeRef = useRef({
    workspaceId: options.workspaceId,
    folderId: options.folderId,
  });
  scopeRef.current = {
    workspaceId: options.workspaceId,
    folderId: options.folderId,
  };

  const run = useCallback(
    async (itemId: string): Promise<void> => {
      const file = filesRef.current.get(itemId);
      if (file === undefined) return;
      const controller = new AbortController();
      abortsRef.current.set(itemId, controller);
      const scope = scopeRef.current;
      const contentType = file.type.length > 0 ? file.type : undefined;

      patch(itemId, { status: "uploading", loaded: 0, progress: 0, error: null });
      try {
        const ticket = await docsApi.createUpload({
          workspace_id: scope.workspaceId,
          title: file.name,
          size_bytes: file.size,
          ...(scope.folderId !== undefined ? { folder_id: scope.folderId } : {}),
          ...(contentType !== undefined ? { mime_type: contentType } : {}),
        });
        const put = await driveApi.putWithProgress(ticket.put_url, file, {
          ...(contentType !== undefined ? { contentType } : {}),
          signal: controller.signal,
          onProgress: ({ loaded, total }) => {
            patch(itemId, {
              loaded,
              progress: total > 0 ? loaded / total : null,
            });
          },
        });
        if (!put.ok) {
          // The object store's body is not a Stapel envelope — fold the status
          // honestly instead of inventing a code (docs-react's own choice).
          throw new StapelApiError({
            code: `stapel.http.${String(put.status)}`,
            message: "upload PUT to put_url failed",
            status: put.status,
          });
        }
        const document = await docsApi.finalizeUpload(ticket.upload_id);
        patch(itemId, {
          status: "done",
          progress: 1,
          loaded: file.size,
          documentId: document.id,
        });
        // A landed file changes both namespaces: the docs list the rows come
        // from, and this pair's rungs/recents.
        void queryClient.invalidateQueries({ queryKey: docsQueryKeys.all });
        void queryClient.invalidateQueries({ queryKey: driveQueryKeys.all });
      } catch (thrown) {
        if (isAbort(thrown)) {
          patch(itemId, { status: "canceled", error: null });
          return;
        }
        // One dialect: whatever the step threw becomes a `StapelApiError`
        // here, at this queue's single rethrow point (core's errors.ts).
        const error = toStapelApiError(thrown);
        patch(itemId, {
          status: "failed",
          error,
          quotaExceeded: isQuota(error),
        });
      } finally {
        abortsRef.current.delete(itemId);
        runningRef.current.delete(itemId);
        // Re-render so the scheduler effect below sees a free slot even when
        // nothing else about the item changed.
        setItems((current) => [...current]);
      }
    },
    [docsApi, driveApi, patch, queryClient]
  );

  // The scheduler: after every state change, top the running set back up to
  // `concurrency` from the head of the queue. Deliberately an effect over a
  // derived list rather than a promise chain — a chain would have to be torn
  // down and rebuilt on every add, retry and cancel.
  useEffect(() => {
    const free = concurrency - runningRef.current.size;
    if (free <= 0) return;
    const next = items
      .filter((item) => item.status === "queued" && !runningRef.current.has(item.id))
      .slice(0, free);
    for (const item of next) {
      runningRef.current.add(item.id);
      void run(item.id);
    }
  }, [items, concurrency, run]);

  // Abort everything still in flight when the tray goes away: an unmounted
  // queue that keeps PUTting is a phone radio nobody can switch off.
  const abortsAtUnmount = abortsRef;
  useEffect(
    () => () => {
      for (const controller of abortsAtUnmount.current.values()) {
        controller.abort();
      }
    },
    [abortsAtUnmount]
  );

  const add = useCallback((files: readonly File[]): void => {
    const fresh: UploadItem[] = [];
    for (const file of files) {
      seqRef.current += 1;
      const id = `upload-${String(seqRef.current)}`;
      filesRef.current.set(id, file);
      fresh.push({
        id,
        name: file.name,
        size: file.size,
        status: "queued",
        loaded: 0,
        progress: 0,
        error: null,
        quotaExceeded: false,
        documentId: null,
      });
    }
    setItems((current) => [...current, ...fresh]);
  }, []);

  const retry = useCallback(
    (itemId: string): void => {
      patch(itemId, {
        status: "queued",
        loaded: 0,
        progress: 0,
        error: null,
        quotaExceeded: false,
      });
    },
    [patch]
  );

  const cancel = useCallback(
    (itemId: string): void => {
      const controller = abortsRef.current.get(itemId);
      if (controller) {
        controller.abort();
        return;
      }
      patch(itemId, { status: "canceled" });
    },
    [patch]
  );

  const clearFinished = useCallback((): void => {
    setItems((current) => {
      const kept = current.filter(
        (item) => item.status === "queued" || item.status === "uploading"
      );
      const keptIds = new Set(kept.map((item) => item.id));
      for (const id of [...filesRef.current.keys()]) {
        if (!keptIds.has(id)) filesRef.current.delete(id);
      }
      return kept;
    });
  }, []);

  return useMemo(
    (): UploadQueueBag => ({
      items,
      add,
      retry,
      cancel,
      clearFinished,
      isUploading: items.some(
        (item) => item.status === "uploading" || item.status === "queued"
      ),
      quotaExceeded: items.some((item) => item.quotaExceeded),
    }),
    [items, add, retry, cancel, clearFinished]
  );
}
