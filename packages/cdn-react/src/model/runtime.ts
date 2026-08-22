import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createCdnApi } from "../api/cdnApi.js";
import type { CdnApi } from "../api/cdnApi.js";
import { resolveCdnLimits } from "./limits.js";
import type { CdnLimits, CdnLimitsOverride } from "./limits.js";
import type { CdnVariantWaitOptions } from "./upload.js";

/**
 * The wired CDN runtime — core's `ModuleRuntime` bound to this pair's API,
 * plus the two things an upload pair has and a plain read pair does not: the
 * DEPLOYMENT's intake ceilings, and how long to wait for a variant ladder.
 *
 * Both are runtime configuration rather than module state, so they ride here
 * instead of through a second provider — the same argument chat-react makes
 * for its socket URL.
 */
export type CdnRuntime = ModuleRuntime<CdnApi> & {
  readonly limits: CdnLimits;
  readonly variants: CdnVariantWaitOptions | undefined;
};

export interface CreateCdnRuntimeOptions extends CreateModuleRuntimeOptions {
  /**
   * Override the client-side mirror of `STAPEL_CDN`'s ceilings. Defaults to
   * the library's own defaults — see `model/limits.ts` for why this is a knob
   * and not a constant.
   */
  readonly limits?: CdnLimitsOverride;
  /** How long the flow waits for the variant ladder after a store. */
  readonly variants?: CdnVariantWaitOptions;
}

/**
 * ```tsx
 * const runtime = createCdnRuntime({ baseUrl: "/cdn/api/v1/" });
 * <CdnProvider runtime={runtime}>{app}</CdnProvider>
 * ```
 *
 * NOT ANONYMOUS. Every endpoint this pair calls needs at least a guest
 * identity (`IsNotAnonymousUser`), and the avatar intake and the dedup
 * pre-check need a real session (`IsAuthenticated`). A storefront mounts this
 * behind its member routes; the public catalogue never touches it.
 */
export function createCdnRuntime(options: CreateCdnRuntimeOptions): CdnRuntime {
  const base = createModuleRuntime((client) => createCdnApi(client), options);
  return {
    ...base,
    limits: resolveCdnLimits(options.limits),
    variants: options.variants,
  };
}
