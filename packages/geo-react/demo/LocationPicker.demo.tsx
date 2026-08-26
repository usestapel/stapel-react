/**
 * The picker, and the states a product will actually meet in the wild.
 *
 * This demo exists because of a specific finding: a live product's listing
 * composer shipped two raw fields, `latitude` and `longitude`. The `default`
 * variant is what replaces them — one mounted component, a map, a search, a
 * pin, an address. The others are the states most implementations get wrong: an
 * anonymous visitor (whose 401 is the deployment's configuration, not a fault,
 * and must not take the map away), a point with no address at all (an empty
 * answer, not a failure), and a `map/config` that failed (the ONE case where
 * there is no map, because there is no tile template).
 *
 * ── Why every variant seeds `map/config` ────────────────────────────────────
 *
 * `LocationPickerField` opens with `useMapConfig()` and renders
 * `<MapPlaceholder/>` — the map's exact box, in grey — until it answers. The
 * config arrives over `fetch`, so on the FIRST frame it is always pending, and
 * the first frame is what a static markup renderer produces and what a shot
 * runner keeps. Every variant here was therefore photographed as the same grey
 * rectangle: not one of them had reached the state it was named for. Seeding
 * the config makes the first frame the real picker.
 *
 * `config-failed` is the deliberate exception — its whole subject is the config
 * NOT arriving, so seeding it would delete the demo.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LocationPickerField } from "../src/default/LocationPickerField.js";
import { GeoSkinTheme } from "../src/default/theme.js";
import type { LatLon } from "../src/model/coords.js";
import type { PlaceResolution } from "../src/api/types.js";
import {
  DEMO_RESOLVE,
  DEMO_SEARCH,
  DemoFrame,
  GeoDemoHarness,
  demoConfig,
  demoEnvelope,
  seedMapConfig,
} from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";

const WORKING: DemoHandlers = {
  "map/config": demoConfig(),
  "geocoding/search": DEMO_SEARCH,
  "geocoding/resolve": DEMO_RESOLVE,
};

/**
 * The deployment's default: the four geocoding verbs are authenticated-only,
 * so a signed-out visitor gets 401 from them and 200 from `map/config`.
 *
 * This is NOT "the geocoder is down". `availabilityOf` sorts 401/403 into
 * `unauthorized`, which the skin renders as plain secondary text with no retry
 * — because there is nothing to retry, the answer will not change, and the map
 * and the pin go on working. A 502 lands in `unavailable`, which IS drawn as a
 * failure with a retry beside it. Same empty address line, two different
 * sentences and two different affordances; see the `anonymous` and
 * `unavailable` variants side by side.
 */
const ANONYMOUS: DemoHandlers = {
  "map/config": demoConfig(),
  "geocoding/search": [
    401,
    demoEnvelope("error.401.unauthorized", "Authentication required"),
  ] as const,
  "geocoding/resolve": [
    401,
    demoEnvelope("error.401.unauthorized", "Authentication required"),
  ] as const,
};

/** The geocoder itself is down — retryable, and drawn as the fault it is. */
const GEOCODER_DOWN: DemoHandlers = {
  "map/config": demoConfig(),
  "geocoding/search": [
    502,
    demoEnvelope("error.502.geocoder_unavailable", "Geocoding provider is unavailable"),
  ] as const,
  "geocoding/resolve": [
    502,
    demoEnvelope("error.502.geocoder_unavailable", "Geocoding provider is unavailable"),
  ] as const,
};

/**
 * A SUCCESSFUL resolve that matched nothing. `formatted` and `feature` are both
 * absent, which `useLocationPicker` reads as `"nowhere"` — an empty state, not
 * an error. The coordinates are still saved; only the address line changes.
 */
const NOWHERE: DemoHandlers = {
  "map/config": demoConfig(),
  "geocoding/search": DEMO_SEARCH,
  "geocoding/resolve": {
    lat: 54.8,
    lon: 15.2,
    geohash: "u3rgs4pc",
    lang: "default",
    formatted: null,
    address: null,
    feature: null,
    alternatives: [],
    nearest: [],
  },
};

const CONFIG_FAILED: DemoHandlers = {
  "map/config": [500, demoEnvelope("error.500.internal", "Something went wrong")] as const,
};

/** The seed is shared by every variant that has a map — one object, so the
 * harness's `useMemo` is not re-keyed on every render. */
const SEEDED: DemoSeed = seedMapConfig();

/** Pins the variants start on. Different points, so two variants that render
 * the same STATE still render different tiles and different coordinates. */
const UNTER_DEN_LINDEN: LatLon = { lat: 52.51667, lon: 13.38333 };
const ALEXANDERPLATZ: LatLon = { lat: 52.52182, lon: 13.41314 };
const OPEN_SEA: LatLon = { lat: 54.8, lon: 15.2 };

function Picker(props: {
  handlers: DemoHandlers;
  seed?: DemoSeed;
  value?: LatLon;
  /** The address the form already stored for `value` — see the `default`
   * variant. Seeds the confirmation line on the FIRST frame. */
  resolution?: PlaceResolution;
  dialog?: boolean;
}): ReactElement {
  return (
    <DemoFrame>
      <GeoDemoHarness
        handlers={props.handlers}
        {...(props.seed ? { seed: props.seed } : {})}
      >
        <LocationPickerField
          {...(props.dialog === true ? {} : { mode: "inline" as const })}
          height={props.dialog === true ? 280 : 320}
          {...(props.value !== undefined ? { value: props.value } : {})}
          {...(props.resolution !== undefined ? { resolution: props.resolution } : {})}
        />
      </GeoDemoHarness>
    </DemoFrame>
  );
}

/**
 * The skin's own theme root, pinned to the dark side.
 *
 * `<GeoSkinTheme/>` normally reads the mode REACTIVELY off the document and
 * every `/default` surface mounts it without being asked — which is exactly
 * why it had never been photographed. It exists because of tracker #26: a skin
 * set with no internal provider inherited a host theme bridge serving
 * light-mode values inside a dark document, and rendered text on background at
 * 1.00:1. Pinning the mode is the one use the prop is FOR ("a demo showing
 * both"), and it is what makes that failure visible if it ever comes back.
 */
function DarkPicker(): ReactElement {
  return (
    <DemoFrame>
      <GeoDemoHarness handlers={WORKING} seed={SEEDED}>
        <GeoSkinTheme mode="dark" surface="raised">
          <LocationPickerField mode="inline" height={320} value={ALEXANDERPLATZ} />
        </GeoSkinTheme>
      </GeoDemoHarness>
    </DemoFrame>
  );
}

export default defineDemo({
  id: "geo.location-picker",
  title: "The location picker a product mounts once",
  description:
    "One component instead of two raw fields called latitude and longitude: a map with search-as-you-type, the browser's position prompt, a centre pin, and the address the pin resolved to. The basemap is drawn by this package — no map library, and the OpenStreetMap credit it is not allowed to suppress.",
  component: LocationPickerField,
  // The provider is what every variant here is mounted inside — the demo
  // harness supplies it, so this demo genuinely exercises it.
  covers: ["AddressSearchField", "TileMap", "GeoSkinTheme", "GeoProvider"],
  flow: "geo.pick_location",
  tokens: ["surface-raised", "border-subtle", "text"],
  variants: {
    default: {
      description:
        "LOCATED — the whole thing, inline in a form column, on a pin the form already held and the address it was saved with. Both halves are on the first frame: the map because `map/config` is seeded, and the address because an edit form hands back the `resolution` it stored rather than making the geocoder re-answer a question it has already answered. Drag the map and the address re-resolves for real.",
      viewport: "desktop",
      step: "resolved",
      render: () => (
        <Picker
          handlers={WORKING}
          seed={SEEDED}
          value={UNTER_DEN_LINDEN}
          resolution={DEMO_RESOLVE as unknown as PlaceResolution}
        />
      ),
    },
    sheet: {
      description:
        "The dialog form. On a phone SkinDialog makes it a bottom sheet; the map's pan does not fight the sheet's drag-to-dismiss, which is anchored to the header alone.",
      viewport: "phone",
      step: "idle",
      render: () => <Picker handlers={WORKING} seed={SEEDED} dialog />,
    },
    anonymous: {
      description:
        "A signed-out visitor. The four geocoding verbs default to authenticated-only, so search and resolve answer 401 — this deployment's configuration, not a fault. The map still renders, the pin still drops and its coordinates are still saved; only the ADDRESS is unavailable, and it says so in plain text with no retry, because retrying will not change the answer.",
      viewport: "phone",
      step: "unauthorized",
      render: () => <Picker handlers={ANONYMOUS} seed={SEEDED} />,
    },
    unavailable: {
      description:
        "The geocoder is genuinely down — 502. Compare with `anonymous`: the address line is empty in both, and only this one is a failure, drawn as one, with a retry. Conflating the two sends a person hunting for a permissions bug that does not exist, or waiting for an outage to end that never started.",
      viewport: "phone",
      step: "unavailable",
      render: () => (
        <Picker handlers={GEOCODER_DOWN} seed={SEEDED} value={ALEXANDERPLATZ} />
      ),
    },
    nowhere: {
      description:
        "A pin in the open sea. The resolve SUCCEEDED and matched nothing, which is an empty state and not an error: the line says there is no address here, and the coordinates are still saved.",
      viewport: "phone",
      step: "nowhere",
      render: () => <Picker handlers={NOWHERE} seed={SEEDED} value={OPEN_SEA} />,
    },
    "config-failed": {
      description:
        "map/config failed. No tile template means no map — the only state in which this pair draws none — so it says so and offers a retry instead of an empty grey rectangle. Deliberately NOT seeded: the missing config is the subject.",
      viewport: "phone",
      step: "config-failed",
      render: () => <Picker handlers={CONFIG_FAILED} />,
    },
    dark: {
      description:
        "The same picker under the skin's own theme root, pinned dark. The wrapper is not decoration: without it a skin inherits whatever theme bridge the host mounted, which once meant light-mode values inside a dark document and text at 1.00:1 contrast.",
      viewport: "phone",
      step: "dark",
      render: () => <DarkPicker />,
    },
  },
});
