import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createCategoriesApi } from "../api/categoriesApi.js";
import type { CategoriesApi } from "../api/categoriesApi.js";

/**
 * The wired categories runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2). The returned `client` is what the host injects into
 * core's `StapelConfigProvider` (as the default or the `"categories"` module
 * client), preserving the client-injection fork seam (frontend-standard §7.2).
 *
 * ANONYMOUS BY DESIGN. Every endpoint this pair calls is a SAFE method under
 * `ReadOnlyOrStaff`, i.e. open to a caller with no session at all:
 *
 * ```tsx
 * const runtime = createCategoriesRuntime({ baseUrl: "/categories/api/v1/" });
 * <CategoriesProvider runtime={runtime}>…</CategoriesProvider>
 * ```
 *
 * No session, no workspace id, no auth client — which is what lets a
 * catalogue render for a visitor who will never sign in, and why the read
 * hooks here are deliberately not gated on `useActiveSessionReady`.
 *
 * The catalogue snapshot is stored in an **app-scoped** repository
 * (`createRepository(..., { scope: "app" })`, `model/catalogStore.ts`): a
 * category tree is a deployment's public content, identical for every visitor,
 * so it is neither encrypted with the per-session key nor wiped at logout.
 * Wiping it would mean re-downloading the whole catalogue every time somebody
 * signs out.
 */
export type CategoriesRuntime = ModuleRuntime<CategoriesApi>;

export type CreateCategoriesRuntimeOptions = CreateModuleRuntimeOptions;

export function createCategoriesRuntime(
  options: CreateCategoriesRuntimeOptions
): CategoriesRuntime {
  return createModuleRuntime((client) => createCategoriesApi(client), options);
}
