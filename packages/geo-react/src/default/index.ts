/**
 * `@stapel/geo-react/default` — the antd skin, and the deliverable.
 *
 * For every other pair the `/default` subpath is the convenience layer over a
 * headless core. Here it is the point: a coordinate is not how a person
 * chooses a place, and the reason a live product shipped two raw fields called
 * `latitude` and `longitude` is that this half of the library did not exist.
 * A product mounts `<LocationField>` — one field that says "Choose a
 * location" while empty and HOLDS the chosen place once it is not — and gets
 * the whole ladder behind it: the permission pre-prompt before the browser's
 * one-shot one, the IP centre when that is refused, then a map,
 * search-as-you-type, a movable pin and the address that followed it. No
 * lat/lon input, and no lat/lon on screen anywhere.
 *
 * `<LocationPickerField>` is the earlier shape — a button that opens the same
 * picker and prints the answer beneath itself — kept for a surface that wants
 * an action rather than a field.
 *
 * A separate entry point (the convention every pair follows) so a host with
 * its own visuals never pulls `antd` — or this package's tile renderer — into
 * its bundle. The main entry has no visual opinion and no import path from it
 * reaches this directory; size-limit is the teeth on that.
 *
 * ```tsx
 * import { createGeoRuntime, GeoProvider } from "@stapel/geo-react";
 * import { LocationField } from "@stapel/geo-react/default";
 *
 * <GeoProvider runtime={createGeoRuntime({ baseUrl: "/geo/" })}>
 *   <LocationField onChange={(picked) => save(picked)} />
 * </GeoProvider>
 * ```
 */
export { LocationField } from "./LocationField.js";
export type { LocationFieldProps, ChosenPlace } from "./LocationField.js";

export { LocationPickerField } from "./LocationPickerField.js";
export type { LocationPickerFieldProps } from "./LocationPickerField.js";

export { AddressSearchField, AVAILABILITY_KEYS } from "./AddressSearchField.js";
export type { AddressSearchFieldProps } from "./AddressSearchField.js";

export { TileMap, clampToBbox } from "./TileMap.js";
export type { TileMapProps, TileMapLabels } from "./TileMap.js";

export { GeoSkinTheme } from "./theme.js";
export type { GeoSkinThemeProps } from "./theme.js";
