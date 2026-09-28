import type { I18nDictionary, I18nEngine } from "@stapel/core";
import { geoErrorBundleEn } from "./generated/errors.gen.js";

/**
 * geo-react's own translation KEYS (frontend-standard §4.2): components never
 * render literal strings — hosts resolve these through core's i18n engine
 * (`useT`). Backend error codes flow through the same contour, so the default
 * bundle below ships English for both the backend's generated codes and this
 * pair's own UI copy.
 */
export const GEO_I18N_KEYS = {
  unknownError: "geo.error.unknown",

  // The picker
  pickerSearchLabel: "geo.picker.search_label",
  pickerSearchPlaceholder: "geo.picker.search_placeholder",
  pickerUseMyPosition: "geo.picker.use_my_position",
  pickerLocating: "geo.picker.locating",
  pickerConfirm: "geo.picker.confirm",
  pickerClose: "geo.picker.close",
  pickerTitle: "geo.picker.title",
  pickerOpen: "geo.picker.open",
  /** The map itself, for a screen reader: it is a control, not a picture. */
  pickerMapLabel: "geo.picker.map_label",
  pickerZoomIn: "geo.picker.zoom_in",
  pickerZoomOut: "geo.picker.zoom_out",
  /** The centre crosshair. The map moves under a fixed pin, which is the
   * shape a thumb can actually use — dragging a small marker on a phone means
   * covering it with the finger that is dragging it. */
  pickerPinLabel: "geo.picker.pin_label",
  pickerResolving: "geo.picker.resolving",
  /** A SUCCESSFUL resolve with nothing at that point — the middle of a lake.
   * An empty state, and never a failure (contract §6). */
  pickerNoAddress: "geo.picker.no_address",

  // The location FIELD — the shape a form actually wants (LocationField).
  /** What the empty field says it is for. Not "choose on the map": a map is
   * the mechanism, and most people answer this by typing a street. */
  fieldPlaceholder: "geo.field.placeholder",
  /** A place IS chosen but the geocoder had no address for it. The field must
   * not look unanswered. */
  fieldChosenNoAddress: "geo.field.chosen_no_address",
  /** The door out of a refused permission prompt, inside the sheet. */
  fieldChooseAnyway: "geo.field.choose_anyway",
  /** Where the map will open from, when the answer came from an address
   * rather than a device. Said out loud because a city-level guess presented
   * silently reads as a precise one. */
  fieldNearYou: "geo.field.near_you",

  /** The pre-prompt this pair puts in front of the browser's own one-shot
   * geolocation prompt — its copy, because the generic floor sentence cannot
   * know that the alternative here is typing a street. */
  permissionTitle: "geo.permission.title",
  permissionBody: "geo.permission.body",
  permissionDenied: "geo.permission.denied",

  // Search states
  searchTypeMore: "geo.search.type_more",
  searchNoResults: "geo.search.no_results",
  searchRetry: "geo.search.retry",

  /**
   * Why the geocoder is not answering. FOUR sentences, because they are four
   * different situations with three different next actions — and because the
   * first of them is not a fault at all.
   */
  geocoderUnauthorized: "geo.geocoder.unauthorized",
  geocoderThrottled: "geo.geocoder.throttled",
  geocoderUnavailable: "geo.geocoder.unavailable",
  geocoderFailed: "geo.geocoder.failed",

  /** The browser's own refusals. The server never sees any of these. */
  positionDenied: "geo.position.denied",
  positionUnavailable: "geo.position.unavailable",
  positionTimeout: "geo.position.timeout",

  /** The map could not be configured at all — no tile template, so there is
   * nothing to draw. The only state in which this pair renders no map. */
  mapConfigFailed: "geo.map.config_failed",
  mapRetry: "geo.map.retry",
} as const;

export type GeoI18nKey = (typeof GEO_I18N_KEYS)[keyof typeof GEO_I18N_KEYS];

/**
 * The pair's English bundle: the generated backend error texts (complete over
 * the registry by construction) plus the hand-written UI copy.
 *
 * Two sentences here are load-bearing and worth reading twice.
 * `geo.geocoder.unauthorized` must not read as a breakage: the deployment's
 * default really is authenticated-only geocoding, so a signed-out visitor
 * seeing it is the system working. And `geo.picker.no_address` is the answer
 * to a SUCCESSFUL call — "there is no address here" — not to a failed one.
 */
export const geoI18nBundleEn: I18nDictionary = {
  ...geoErrorBundleEn,

  "geo.error.unknown": "Something went wrong. Please try again.",

  "geo.picker.title": "Choose a location",
  "geo.picker.open": "Choose on the map",
  "geo.picker.search_label": "Address",
  "geo.picker.search_placeholder": "Street, city…",
  "geo.picker.use_my_position": "Use my position",
  "geo.picker.locating": "Finding you…",
  "geo.picker.confirm": "Use this location",
  "geo.picker.close": "Close",
  "geo.picker.map_label": "Map. Drag to move the pin; use the zoom buttons or the arrow keys.",
  "geo.picker.zoom_in": "Zoom in",
  "geo.picker.zoom_out": "Zoom out",
  "geo.picker.pin_label": "The chosen point is at the centre of the map",
  "geo.picker.resolving": "Looking up this place…",
  "geo.picker.no_address": "No address at this point. The place is still saved.",

  "geo.field.placeholder": "Choose a location",
  "geo.field.chosen_no_address": "A place on the map, with no address",
  "geo.field.choose_anyway": "Choose it on the map instead",
  "geo.field.near_you": "Starting near {place}.",

  "geo.permission.title": "Start from where you are?",
  "geo.permission.body":
    "Then the map opens on your street instead of somewhere you have to travel across. Your browser asks next, and you can type the address instead.",
  "geo.permission.denied":
    "This site cannot see your position, and the browser will not ask again. You can turn it back on in the site settings beside the address bar — or just find the place on the map.",

  "geo.search.type_more": "Keep typing to search.",
  "geo.search.no_results": "Nothing matched. Try fewer words, or drop the pin yourself.",
  "geo.search.retry": "Try again",

  "geo.geocoder.unauthorized":
    "Address search needs you to be signed in here. The map still works — you can place the pin yourself.",
  "geo.geocoder.throttled":
    "Too many searches at once. Showing the last results; try again in a moment.",
  "geo.geocoder.unavailable":
    "The address service is not responding. The map still works — you can place the pin yourself, and try again shortly.",
  "geo.geocoder.failed":
    "Address search did not work. The map still works — you can place the pin yourself.",

  "geo.position.denied":
    "This site cannot see your position. Allow location for it in your browser settings, or search for the address instead.",
  "geo.position.unavailable":
    "Your device could not work out where it is. Search for the address instead.",
  "geo.position.timeout": "Finding your position took too long. Try again.",

  "geo.map.config_failed": "The map could not be loaded.",
  "geo.map.retry": "Try again",
};

/** Register the pair's `en` floor into a core i18n engine (call once at
 * startup). A host's own bundle registered AFTER this one wins. */
export function registerGeoI18n(engine: I18nEngine, locale = "en"): void {
  engine.registerBundle(locale, geoI18nBundleEn);
}
