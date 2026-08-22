import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createSearchApi } from "../api/searchApi.js";
import type { SearchApi } from "../api/searchApi.js";

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
 * const runtime = createSearchRuntime({ baseUrl: "/search/api/v1/" });
 * <SearchProvider runtime={runtime}>…</SearchProvider>
 * ```
 *
 * No session, no workspace id, no auth client. When a session DOES exist the
 * host's auth runtime supplies the token on the shared client and the same
 * calls carry it — this pair neither requires nor waits for one, which is why
 * its read hooks are deliberately not gated on `useActiveSessionReady`.
 */
export type SearchRuntime = ModuleRuntime<SearchApi>;

export type CreateSearchRuntimeOptions = CreateModuleRuntimeOptions;

export function createSearchRuntime(
  options: CreateSearchRuntimeOptions
): SearchRuntime {
  return createModuleRuntime((client) => createSearchApi(client), options);
}
