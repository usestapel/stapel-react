import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { VideoApi } from "../api/videoApi.js";
import type { VideoRuntime } from "./runtime.js";

/**
 * The wired VideoRuntime shared through React context by
 * `<VideoProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<VideoRuntime> =
  createModuleContext<VideoRuntime>("Video");

export const VideoRuntimeContext: Context<VideoRuntime | null> =
  kit.RuntimeContext;

export const useVideoRuntime: () => VideoRuntime = kit.useRuntime;

export const useVideoApi: () => VideoApi = kit.useApi;

export const useVideoAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<VideoProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<VideoRuntime>["Provider"] =
  kit.Provider;
