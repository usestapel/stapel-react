import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import type { StapelImage } from "@stapel/image";
import { createSearchApi } from "../api/searchApi.js";
import type { SearchApi } from "../api/searchApi.js";

/**
 * Turn a stored CDN reference into something renderable.
 *
 * ── Why this is a seam and not a URL builder ───────────────────────────────
 *
 * A search card's photo fields (`image`, `images`) hold what the indexed doc
 * type stores, and in this fleet that is an OPAQUE `<type>/<hash>` reference —
 * the same unit `Listing.images` holds. No contract here resolves a stranger's
 * reference: stapel-cdn's `file/exists/` is owner-scoped, so
 * `@stapel/cdn-react`'s `useCdnRef` answers for a person's OWN draft and can
 * never render somebody else's gallery. A pair that guessed `${base}/${ref}`
 * would be writing a contract nobody agreed to, and it would break the first
 * deployment that signs its media paths.
 *
 * So the deployment hands its own knowledge in once, exactly as
 * `@stapel/listings-react`'s `ListingImageResolver` does — one seam, one
 * spelling, and a container that already has a resolver passes the SAME
 * function to both runtimes.
 *
 * A `StapelImage` rather than a string is what buys the variant ladder: with
 * `variants` populated, `@stapel/image`'s `<Image>` measures the slot and
 * picks a tier. A resolver with nothing for a reference returns `undefined`,
 * and the skin then says "photo unavailable" instead of drawing a broken
 * `<img>`.
 */
export type SearchImageResolver = (ref: string) => StapelImage | undefined;

/**
 * The wired search runtime — core's `ModuleRuntime` bound to this pair's API
 * (slim wave §21/S2). The returned `client` is what the host injects into
 * core's `StapelConfigProvider` (as the default or the `"search"` module
 * client), preserving the client-injection fork seam (frontend-standard §7.2).
 *
 * ANONYMOUS BY DESIGN. Every endpoint this pair calls is `AllowAny`, so a
 * storefront's catalogue, category and search pages need nothing but:
 *
 * ```tsx
 * const runtime = createSearchRuntime({
 *   baseUrl: "/search/api/v1/",
 *   resolveImage: (ref) => myCdn.describe(ref),
 * });
 * <SearchProvider runtime={runtime}>…</SearchProvider>
 * ```
 *
 * No session, no workspace id, no auth client. When a session DOES exist the
 * host's auth runtime supplies the token on the shared client and the same
 * calls carry it — this pair neither requires nor waits for one, which is why
 * its read hooks are deliberately not gated on `useActiveSessionReady`.
 */
export interface SearchRuntime extends ModuleRuntime<SearchApi> {
  /** See {@link SearchImageResolver}. Absent = a card that stores references
   * draws the placeholder and names the reason. */
  readonly resolveImage: SearchImageResolver | undefined;
}

export interface CreateSearchRuntimeOptions extends CreateModuleRuntimeOptions {
  /** See {@link SearchImageResolver}. */
  readonly resolveImage?: SearchImageResolver;
}

export function createSearchRuntime(
  options: CreateSearchRuntimeOptions
): SearchRuntime {
  const base = createModuleRuntime((client) => createSearchApi(client), options);
  return { ...base, resolveImage: options.resolveImage };
}
