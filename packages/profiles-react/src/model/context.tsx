import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { ProfilesApi } from "../api/profilesApi.js";
import type { ProfilesRuntime } from "./runtime.js";

/**
 * The wired ProfilesRuntime shared through React context by
 * `<ProfilesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here. One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`, slim wave §21/S2); this module binds it under the
 * pair's public names.
 */
const kit: ModuleContextKit<ProfilesRuntime> =
  createModuleContext<ProfilesRuntime>("Profiles");

export const ProfilesRuntimeContext: Context<ProfilesRuntime | null> =
  kit.RuntimeContext;

export const useProfilesRuntime: () => ProfilesRuntime = kit.useRuntime;

export const useProfilesApi: () => ProfilesApi = kit.useApi;

export const useProfilesAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<ProfilesProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<ProfilesRuntime>["Provider"] =
  kit.Provider;
