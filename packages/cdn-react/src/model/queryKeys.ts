/**
 * Namespaced TanStack Query keys (frontend-standard §2). Everything under the
 * `"cdn"` root so a host can invalidate the whole module or match a single
 * read.
 *
 * There is exactly one cached read in this pair, and it is keyed on the CONTENT
 * HASH rather than on the reference string. Two references that differ only in
 * asset type (`avatar/<h>` and `product/<h>`) resolve through the same
 * `file/exists/` call and must not fetch twice; and because the hash IS the
 * identity of the bytes, a key built from it can never go stale in the way a
 * mutable row's key can. Uploads are mutations and cache nothing.
 */

const ROOT = "cdn" as const;

export const cdnQueryKeys: {
  readonly all: readonly ["cdn"];
  /** The owner-scoped `file/exists/` read for one content hash. */
  exists(fileHash: string): readonly ["cdn", "exists", string];
} = {
  all: [ROOT],
  exists: (fileHash) => [ROOT, "exists", fileHash],
};
