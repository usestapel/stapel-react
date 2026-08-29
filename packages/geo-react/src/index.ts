/**
 * `@stapel/geo-react` — the human half of a location.
 *
 * The owner opened a live product's listing composer and found two raw fields,
 * `latitude` and `longitude`, and called the geo library useless. The reason
 * was structural and it was this package's absence: stapel-geo shipped
 * coordinates, and a coordinate is not how a person chooses a place. A person
 * points at a map, types a street, or presses "where I am" — and reads back an
 * address to check.
 *
 * So the default skin (`@stapel/geo-react/default`) is the deliverable, not an
 * example: mount `<LocationPickerField>` and a product has a map, search-as-
 * you-type, the browser's position prompt, a pin that can be moved, and the
 * address that follows it. A product should never have to render a lat/lon
 * input again.
 *
 * The headless layer below is what that skin is built on, exported because a
 * host with its own visuals should not have to re-derive the disciplines that
 * make the skin correct: the axis swap, the debounce-and-abort, the four
 * geolocation refusals, and "geocoding is not available to me" as a state
 * rather than an error.
 */

// The one boundary conversion, and the projection a raster map is drawn with.
export {
  fromGeoJson,
  toGeoJson,
  clampLat,
  wrapLon,
  project,
  unproject,
  tilesFor,
  panBy,
  tileUrl,
  worldSize,
  TILE_SIZE,
  MERCATOR_MAX_LAT,
} from "./model/coords.js";
export type { LatLon, WorldPoint, TileRef } from "./model/coords.js";

// Why the geocoder is not answering — four situations, not one error.
export { availabilityOf, isRetryable } from "./model/availability.js";
export type { GeocoderAvailability } from "./model/availability.js";

// Runtime + context.
export { createGeoRuntime } from "./model/runtime.js";
export type { CreateGeoRuntimeOptions, GeoRuntime } from "./model/runtime.js";
export {
  GeoRuntimeContext,
  useGeoRuntime,
  useGeoApi,
  useGeoAnalytics,
} from "./model/context.js";
export { GeoProvider } from "./headless/GeoProvider.js";

// The typed operation surface.
export { createGeoApi, endpointsOf, MAP_CONFIG_PATH } from "./api/geoApi.js";
export type { GeoApi } from "./api/geoApi.js";
export type {
  GeoEndpoints,
  GeocodeFeature,
  GeocodeProperties,
  GeocodeResponse,
  MapConfig,
  PlaceResolution,
  IpLocation,
  PlaceSummary,
  ResolveQuery,
  SearchQuery,
  Schemas,
  TileLayer,
} from "./api/types.js";

// Reads and bags.
export { geoKeys } from "./model/queryKeys.js";
export { useMapConfig } from "./model/queries.js";
export { usePlaceSearch } from "./headless/usePlaceSearch.js";
export type {
  PlaceSearchBag,
  PlaceSuggestion,
  UsePlaceSearchOptions,
} from "./headless/usePlaceSearch.js";
export { useBrowserPosition } from "./headless/useBrowserPosition.js";
export type {
  BrowserPositionBag,
  PositionOutcome,
  PositionState,
  UseBrowserPositionOptions,
} from "./headless/useBrowserPosition.js";
export { useResolvedLocation } from "./headless/useResolvedLocation.js";
export type {
  ResolvedLocation,
  ResolvedLocationBag,
  ResolvedLocationSource,
  UseResolvedLocationOptions,
} from "./headless/useResolvedLocation.js";
export { useLocationPicker } from "./headless/useLocationPicker.js";
export type {
  LocationPickerBag,
  PickedLocation,
  ResolveState,
  UseLocationPickerOptions,
} from "./headless/useLocationPicker.js";

// i18n.
export { GEO_I18N_KEYS, geoI18nBundleEn, registerGeoI18n } from "./i18n/keys.js";
export type { GeoI18nKey } from "./i18n/keys.js";
export { GEO_ERRORS, GEO_ERROR_CODES, geoErrorBundleEn, explain } from "./i18n/errorsMap.js";
export type { GeoErrorCode, GeoErrorSpec, Remediation } from "./i18n/errorsMap.js";
