/**
 * The picker, and the two states a product will actually meet in the wild.
 *
 * This demo exists because of a specific finding: a live product's listing
 * composer shipped two raw fields, `latitude` and `longitude`. The `working`
 * variant is what replaces them — one mounted component, a map, a search, a
 * pin, an address. The other two are the states most implementations get
 * wrong: an anonymous visitor (whose 401 is the deployment's configuration,
 * not a fault, and must not take the map away) and a `map/config` that failed
 * (the ONE case where there is no map, because there is no tile template).
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { LocationPickerField } from "../src/default/LocationPickerField.js";
import { GeoSkinTheme } from "../src/default/theme.js";
import {
  DEMO_RESOLVE,
  DEMO_SEARCH,
  DemoFrame,
  GeoDemoHarness,
  demoConfig,
  demoEnvelope,
} from "./_harness.js";

const WORKING = {
  "map/config": demoConfig(),
  "geocoding/search": DEMO_SEARCH,
  "geocoding/resolve": DEMO_RESOLVE,
};

/** The deployment's default: the four geocoding verbs are authenticated-only,
 * so a signed-out visitor gets 401 from them and 200 from `map/config`. */
const ANONYMOUS = {
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

const CONFIG_FAILED = {
  "map/config": [500, demoEnvelope("error.500.internal", "Something went wrong")] as const,
};

function WorkingPicker(): ReactElement {
  return (
    <GeoDemoHarness handlers={WORKING}>
      <LocationPickerField mode="inline" height={320} />
    </GeoDemoHarness>
  );
}

function DialogPicker(): ReactElement {
  return (
    <GeoDemoHarness handlers={WORKING}>
      <LocationPickerField height={280} />
    </GeoDemoHarness>
  );
}

function AnonymousPicker(): ReactElement {
  return (
    <GeoDemoHarness handlers={ANONYMOUS}>
      <LocationPickerField mode="inline" height={320} />
    </GeoDemoHarness>
  );
}

function ConfigFailedPicker(): ReactElement {
  return (
    <GeoDemoHarness handlers={CONFIG_FAILED}>
      <LocationPickerField mode="inline" height={320} />
    </GeoDemoHarness>
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
    <GeoDemoHarness handlers={WORKING}>
      <GeoSkinTheme mode="dark" surface="raised">
        <LocationPickerField mode="inline" height={320} />
      </GeoSkinTheme>
    </GeoDemoHarness>
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
        "The whole thing, inline in a form column. Drag the map, type an address, press the pin's confirmation.",
      viewport: "desktop",
      step: "resolved",
      render: () => (
        <DemoFrame>
          <WorkingPicker />
        </DemoFrame>
      ),
    },
    sheet: {
      description:
        "The dialog form. On a phone SkinDialog makes it a bottom sheet; the map's pan does not fight the sheet's drag-to-dismiss, which is anchored to the header alone.",
      viewport: "phone",
      step: "idle",
      render: () => (
        <DemoFrame>
          <DialogPicker />
        </DemoFrame>
      ),
    },
    anonymous: {
      description:
        "A signed-out visitor. The four geocoding verbs default to authenticated-only, so search and resolve answer 401 — which is this deployment's configuration, not a fault. The map still renders, the pin still drops, and only the ADDRESS is unavailable.",
      viewport: "phone",
      step: "unauthorized",
      render: () => (
        <DemoFrame>
          <AnonymousPicker />
        </DemoFrame>
      ),
    },
    "config-failed": {
      description:
        "map/config failed. No tile template means no map — the only state in which this pair draws none — so it says so and offers a retry instead of an empty grey rectangle.",
      viewport: "phone",
      step: "config-failed",
      render: () => (
        <DemoFrame>
          <ConfigFailedPicker />
        </DemoFrame>
      ),
    },
    dark: {
      description:
        "The same picker under the skin's own theme root, pinned dark. The wrapper is not decoration: without it a skin inherits whatever theme bridge the host mounted, which once meant light-mode values inside a dark document and text at 1.00:1 contrast.",
      viewport: "phone",
      step: "dark",
      render: () => (
        <DemoFrame>
          <DarkPicker />
        </DemoFrame>
      ),
    },
  },
});
