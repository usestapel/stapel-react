import { useQuery } from "@tanstack/react-query";
import { loadStateFromQuery, useActiveSessionReady } from "@stapel/core";
import type { LoadState } from "@stapel/core";
import type { CdnFileExistsResponse, CdnImage, CdnRef } from "../api/types.js";
import { useCdnApi } from "./context.js";
import { cdnQueryKeys } from "./queryKeys.js";
import { parseCdnRef } from "./refs.js";

/**
 * Resolve a stored `<type>/<hash>` reference back to the CDN row — the read
 * that lets a composer REOPEN a draft and show what is already attached to it.
 *
 * ── The scope this read has, stated rather than discovered ─────────────────
 *
 * `file/exists/` filters on `uploaded_by=request.user`, always. So this
 * resolves the CALLER'S OWN references and nothing else: it is the right
 * instrument for "my draft's photos" and the wrong one for "this seller's
 * photos". A buyer's storefront renders a listing's images from what the
 * listings API gives it, not from here — stapel-cdn exposes no public
 * read-by-reference endpoint at all (recorded as an upstream gap in the
 * package README).
 *
 * A reference that resolves to nothing answers `ready(null)`, not `failed`:
 * `{exists: false}` is a 200 and a true answer. "This reference is not mine /
 * no longer stored" and "we could not ask" are different sentences and a skin
 * must be able to tell them apart — which is why the value behind `ready` is
 * nullable and the failure lives in the discriminant.
 */
export interface CdnRefBag {
  readonly state: LoadState<CdnImage | null>;
  readonly isFetching: boolean;
  refetch(): void;
}

export function useCdnRef(ref: CdnRef | null | undefined): CdnRefBag {
  const api = useCdnApi();
  // Gated on the session for the reason core's own doc comment gives: the
  // endpoint is `IsAuthenticated`, so firing it during the login bootstrap
  // buys one guaranteed 401 per mounted thumbnail.
  const sessionReady = useActiveSessionReady();
  const parsed = ref === null || ref === undefined ? null : parseCdnRef(ref);

  const query = useQuery({
    queryKey: cdnQueryKeys.exists(parsed?.fileHash ?? ""),
    queryFn: ({ signal }): Promise<CdnFileExistsResponse> =>
      api.fileExists(parsed?.fileHash ?? "", { signal }),
    enabled: sessionReady && parsed !== null,
    // A content-addressed row does not change. Its VARIANTS do, once, when the
    // background task finishes — the upload flow waits for that itself, so a
    // refetch here would only re-ask a settled question.
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    select: (data): CdnImage | null =>
      data.exists && data.type === "image" && data.file !== null
        ? (data.file as CdnImage)
        : null,
  });

  return {
    state: loadStateFromQuery(query),
    isFetching: query.isFetching,
    refetch: () => void query.refetch(),
  };
}
