import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import type { StapelImage } from "@stapel/image";
import { createListingsApi } from "../api/listingsApi.js";
import type { ListingsApi } from "../api/listingsApi.js";
import { DEFAULT_LISTING_CURRENCY } from "../api/types.js";
import { DEFAULT_DRAFT_LIMITS } from "./validation.js";
import type { ListingDraftLimits } from "./validation.js";

/**
 * Turn a stored image reference into something renderable.
 *
 * ── Why this is a seam and not a URL builder ───────────────────────────────
 *
 * `Listing.images` is a list of OPAQUE CDN references (`<type>/<hash>`), and
 * the listings contract offers no way to resolve one: there is no
 * `GET /listings/{pk}/images/`, and stapel-cdn's `file/exists/` is
 * owner-scoped (`uploaded_by=request.user`), so `@stapel/cdn-react`'s
 * `useCdnRef` can resolve a person's OWN draft and can never render a
 * stranger's gallery — it says so itself. There is therefore no public
 * read-by-reference anywhere in this fleet's contracts today.
 *
 * The honest answer is a seam, not an invented URL convention: a deployment
 * knows where its CDN serves from, and hands that knowledge in once. A pair
 * that guessed `${cdnBase}/${ref}` would be writing a contract nobody agreed
 * to, and it would break the first host that puts a signature on the path.
 *
 * Returning a full `StapelImage` rather than a string is what buys the
 * variant ladder: with `variants` populated, `@stapel/image`'s `<Image>`
 * measures the slot and picks a tier; with only `url`, it shows that one.
 * Both are supported, and a resolver that has nothing for a reference returns
 * `undefined` — the skin then says "photo unavailable" instead of drawing a
 * broken `<img>`. Recorded as an upstream gap in MODULE.md.
 */
export type ListingImageResolver = (ref: string) => StapelImage | undefined;

export interface CreateListingsRuntimeOptions
  extends CreateModuleRuntimeOptions {
  /** See {@link ListingImageResolver}. Absent = no gallery is drawn, and the
   * skin names the reason. */
  readonly resolveImage?: ListingImageResolver;
  /**
   * The deployment's own ceilings, mirrored client-side. Partial: only the
   * ones that differ from `stapel_listings/conf.py`'s library defaults.
   */
  readonly limits?: Partial<ListingDraftLimits>;
  /** Currency a new draft starts in. Owner verdict F6: RUB. */
  readonly currency?: string;
}

/**
 * The wired listings runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2), plus the three pieces of deployment knowledge the
 * pair cannot derive: how to render a reference, where the ceilings are, and
 * what currency the shop trades in.
 *
 * ```tsx
 * const runtime = createListingsRuntime({
 *   baseUrl: "/listings/api/v1/",
 *   resolveImage: (ref) => myCdn.describe(ref),
 * });
 * <ListingsProvider runtime={runtime}>…</ListingsProvider>
 * ```
 *
 * NOT session-gated as a whole. The public reads (`retrieve`, `status`,
 * `list`) are `IsAuthenticatedOrReadOnly` and answer a visitor who will never
 * sign in; the owner reads and every write are `IsAuthenticated` and the
 * hooks that call them gate on `useActiveSessionReady` individually. Gating
 * the module would make a shop window wait for a login bootstrap.
 */
export interface ListingsRuntime extends ModuleRuntime<ListingsApi> {
  readonly resolveImage: ListingImageResolver | undefined;
  readonly limits: ListingDraftLimits;
  readonly currency: string;
}

export function createListingsRuntime(
  options: CreateListingsRuntimeOptions
): ListingsRuntime {
  const base = createModuleRuntime((client) => createListingsApi(client), options);
  return {
    ...base,
    resolveImage: options.resolveImage,
    limits: { ...DEFAULT_DRAFT_LIMITS, ...options.limits },
    currency: options.currency ?? DEFAULT_LISTING_CURRENCY,
  };
}
