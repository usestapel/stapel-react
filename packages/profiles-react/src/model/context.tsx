import { createContext, useContext } from "react";
import type { Context } from "react";
import type { Analytics } from "@stapel/core";
import type { ProfilesApi } from "../api/profilesApi.js";
import type { ProfilesRuntime } from "./runtime.js";

/**
 * The wired ProfilesRuntime shared through React context by
 * `<ProfilesProvider>`. Hooks in `model/` and `headless/` read the singletons
 * from here.
 */
export const ProfilesRuntimeContext: Context<ProfilesRuntime | null> =
  createContext<ProfilesRuntime | null>(null);

export function useProfilesRuntime(): ProfilesRuntime {
  const runtime = useContext(ProfilesRuntimeContext);
  if (runtime === null) {
    throw new Error("Profiles hooks must be used within a <ProfilesProvider>");
  }
  return runtime;
}

export function useProfilesApi(): ProfilesApi {
  return useProfilesRuntime().api;
}

export function useProfilesAnalytics(): Analytics | null {
  return useProfilesRuntime().analytics;
}
