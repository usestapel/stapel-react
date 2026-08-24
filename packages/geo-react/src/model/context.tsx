import type { Context } from "react";
import { createModuleContext } from "@stapel/core";
import type { Analytics, ModuleContextKit } from "@stapel/core";
import type { GeoApi } from "../api/geoApi.js";
import type { GeoRuntime } from "./runtime.js";

/**
 * The wired GeoRuntime shared through React context by `<GeoProvider>`.
 * One reviewed copy of this plumbing lives in `@stapel/core`
 * (`createModuleContext`); this module binds it under the pair's names.
 */
const kit: ModuleContextKit<GeoRuntime> = createModuleContext<GeoRuntime>("Geo");

export const GeoRuntimeContext: Context<GeoRuntime | null> = kit.RuntimeContext;

export const useGeoRuntime: () => GeoRuntime = kit.useRuntime;

export const useGeoApi: () => GeoApi = kit.useApi;

export const useGeoAnalytics: () => Analytics | null = kit.useAnalytics;

/** @internal Re-exported as `<GeoProvider>` from `headless/`. */
export const ModuleProvider: ModuleContextKit<GeoRuntime>["Provider"] = kit.Provider;
