import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createVocabulariesApi } from "../api/vocabulariesApi.js";
import type { VocabulariesApi } from "../api/vocabulariesApi.js";

/**
 * The wired vocabularies runtime — core's `ModuleRuntime` bound to this pair's
 * API (slim wave §21/S2: the plumbing lives once in `@stapel/core`'s
 * `createModuleRuntime`/`createModuleContext`; this module only binds the
 * module-prefixed names). The returned `client` is what the host injects
 * into core's `StapelConfigProvider` (as the default or the `"vocabularies"`
 * module client), preserving the client-injection fork seam
 * (frontend-standard §7.2). Auth token/refresh and the verification-403 seam
 * are supplied by the host's auth runtime on the shared client — this pair
 * does not re-implement them.
 */
export type VocabulariesRuntime = ModuleRuntime<VocabulariesApi>;

export type CreateVocabulariesRuntimeOptions = CreateModuleRuntimeOptions;

export function createVocabulariesRuntime(
  options: CreateVocabulariesRuntimeOptions
): VocabulariesRuntime {
  return createModuleRuntime(createVocabulariesApi, options);
}
