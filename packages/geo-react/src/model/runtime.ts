import { createModuleRuntime } from "@stapel/core";
import type { CreateModuleRuntimeOptions, ModuleRuntime } from "@stapel/core";
import { createGeoApi } from "../api/geoApi.js";
import type { GeoApi } from "../api/geoApi.js";

/**
 * The wired geo runtime — core's `ModuleRuntime` bound to this pair's API.
 * The `client` is what the host injects into core's `StapelConfigProvider`
 * (as the default or the `"geo"` module client), preserving the
 * client-injection fork seam (frontend-standard §7.2).
 *
 * ── The mount prefix is configuration, not a constant ──────────────────────
 *
 * A host mounts `path("geo/", include("stapel_geo.urls"))` — `geo/` by
 * convention and by nothing stronger. `baseUrl` therefore ends at that mount
 * and every path this pair sends is relative to it: the one it spells
 * (`api/v1/map/config`) and the four it is HANDED by that call's `endpoints`
 * table.
 *
 * ── Anonymous is a supported state, not an error ───────────────────────────
 *
 * `map/config` is public; the four geocoding verbs default to authenticated
 * only (`STAPEL_GEO["GEOCODER_PERMISSIONS"]`), so an anonymous caller gets
 * 401/403 from them and 200 from the config. That is a configuration fact of
 * the deployment, and the pair is built around it: the map renders and the pin
 * drops for a signed-out visitor, and only the ADDRESS is unavailable. Nothing
 * here gates the whole surface on a session.
 */
export type GeoRuntime = ModuleRuntime<GeoApi>;

export type CreateGeoRuntimeOptions = CreateModuleRuntimeOptions;

export function createGeoRuntime(options: CreateGeoRuntimeOptions): GeoRuntime {
  return createModuleRuntime(createGeoApi, options);
}
