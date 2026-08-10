import type { ReactNode } from "react";
import type { StapelApiError } from "@stapel/core";
import { useUpload } from "../model/mutations.js";
import type { UploadResult } from "../model/mutations.js";

/** Render-prop bag for {@link DocUploader}. */
export interface UploadBag {
  /**
   * Upload a file as a new document. Delivery follows the component's `via`
   * prop: presigned `put_url` by default; `"content"` for the local-storage
   * backend profile (see `useUpload`).
   */
  upload(file: File, options?: { readonly title?: string }): void;
  readonly isUploading: boolean;
  /** The finished upload (created document id), else null. */
  readonly result: UploadResult | null;
  readonly isError: boolean;
  readonly error: StapelApiError | null;
  /** Clear the mutation state (e.g. to upload another file). */
  reset(): void;
}

/**
 * Headless uploader — renderless wrapper over the full upload flow
 * (`POST /uploads` → bytes → finalize). Bring your own dropzone/file input
 * and progress UI. Zero visual opinion (frontend-standard §2).
 *
 * ```tsx
 * <DocUploader workspaceId="ws-1" folderId={folder?.id}>
 *   {({ upload }) => <input type="file" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />}
 * </DocUploader>
 * ```
 */
export function DocUploader(props: {
  workspaceId: string;
  folderId?: string;
  /** Delivery path — see `UploadVariables.via`. Default `"put_url"`. */
  via?: "put_url" | "content";
  children: (bag: UploadBag) => ReactNode;
}): ReactNode {
  const mutation = useUpload();
  return props.children({
    upload: (file, options) => {
      mutation.mutate({
        file,
        workspaceId: props.workspaceId,
        title: options?.title ?? file.name,
        ...(props.folderId !== undefined ? { folderId: props.folderId } : {}),
        ...(props.via !== undefined ? { via: props.via } : {}),
      });
    },
    isUploading: mutation.isPending,
    result: mutation.data ?? null,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: () => {
      mutation.reset();
    },
  });
}
