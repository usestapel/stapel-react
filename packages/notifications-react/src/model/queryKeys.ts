import type { NotificationFeedParams } from "../api/types.js";

/**
 * Namespaced TanStack Query keys (frontend-standard §2 — "ключи неймспейснуты").
 * Everything under the `"notifications"` root so a host can invalidate the whole
 * module or match a single resource. Persist scope is per-user via core's query
 * runtime (`setPersistUser`). Explicit tuple return types satisfy
 * `--isolatedDeclarations`. One entry per read-operation.
 */
const ROOT = "notifications" as const;

export const notificationsQueryKeys: {
  readonly all: readonly ["notifications"];
  feed(): readonly ["notifications", "feed"];
  feedPage(
    params: NotificationFeedParams
  ): readonly ["notifications", "feed", NotificationFeedParams];
} = {
  all: [ROOT],
  // The infinite-scroll feed shares one root key across pages (its pages live
  // under a single cache entry); a single page is keyed by its params.
  feed: () => [ROOT, "feed"],
  feedPage: (params) => [ROOT, "feed", params],
};
