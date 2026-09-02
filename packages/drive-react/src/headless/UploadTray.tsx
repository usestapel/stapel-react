import type { ReactNode } from "react";
import { useUploadQueue } from "../model/uploadQueue.js";
import type { UploadQueueBag } from "../model/uploadQueue.js";

/** Render-prop bag for {@link UploadTray} — the queue itself. */
export type UploadTrayBag = UploadQueueBag;

/**
 * Headless upload tray — a renderless binding of {@link useUploadQueue}.
 *
 * Bring your own file input, rows and bars; this owns the machine (concurrency
 * 2, per-file retry, cancel, real progress from the XHR PUT, and the
 * workspace-quota refusal as a state of its own — see `model/uploadQueue.ts`).
 *
 * ```tsx
 * <UploadTray workspaceId="ws-1" folderId={folderId}>
 *   {({ items, add, quotaExceeded }) => …}
 * </UploadTray>
 * ```
 */
export function UploadTray(props: {
  workspaceId: string;
  /** Destination folder; omitted uploads to the workspace root. */
  folderId?: string | undefined;
  /** Files in flight at once. Default 2. */
  concurrency?: number;
  children: (bag: UploadTrayBag) => ReactNode;
}): ReactNode {
  const bag = useUploadQueue({
    workspaceId: props.workspaceId,
    folderId: props.folderId,
    ...(props.concurrency !== undefined ? { concurrency: props.concurrency } : {}),
  });
  return props.children(bag);
}
