import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { ModerationApi } from "../api/moderationApi.js";
import type { ModerationRuntime } from "./runtime.js";

/**
 * The wired ModerationRuntime shared through React context by
 * `<ModerationProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<ModerationRuntime> =
  createModuleContext<ModerationRuntime>("Moderation");

export const ModerationRuntimeContext: Context<ModerationRuntime | null> =
  kit.RuntimeContext;

export const useModerationRuntime: () => ModerationRuntime = kit.useRuntime;

export const useModerationApi: () => ModerationApi = kit.useApi;

export const useModerationAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<ModerationProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<ModerationRuntime>["Provider"] =
  kit.Provider;
