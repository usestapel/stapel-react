/**
 * The search field's states, side by side — the point being how FEW of them
 * are failures.
 *
 * Look at these with the intent that four of the five below are the system
 * working: nothing typed yet, nothing matched, not allowed to ask, asked too
 * often. Only the last one is a fault, and only it is drawn as one.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { AddressSearchField } from "../src/default/AddressSearchField.js";
import { usePlaceSearch } from "../src/headless/usePlaceSearch.js";
import type { MapConfig } from "../src/api/types.js";
import { GeoSkinTheme } from "../src/default/theme.js";
import {
  DEMO_SEARCH,
  DemoFrame,
  GeoDemoHarness,
  demoConfig,
  demoEnvelope,
} from "./_harness.js";

const CONFIG = demoConfig() as unknown as MapConfig;
/** Module-level: the hook takes the bias by identity (an effect dependency),
 * so a fresh literal each render would re-arm the debounce forever. */
const BIAS = { lat: 52.51667, lon: 13.38333 };

function Field(): ReactElement {
  const search = usePlaceSearch({ config: CONFIG, bias: BIAS, zoom: 13 });
  return <AddressSearchField search={search} onPick={() => undefined} />;
}

function Framed(props: { handlers: Record<string, unknown> }): ReactElement {
  return (
    <GeoDemoHarness handlers={props.handlers}>
      <GeoSkinTheme>
        <Field />
      </GeoSkinTheme>
    </GeoDemoHarness>
  );
}

const RESULTS = { "map/config": demoConfig(), "geocoding/search": DEMO_SEARCH };

const NOTHING = {
  "map/config": demoConfig(),
  "geocoding/search": { type: "FeatureCollection", lang: "default", features: [] },
};

const UNAUTHORIZED = {
  "map/config": demoConfig(),
  "geocoding/search": [
    403,
    demoEnvelope("error.403.forbidden", "You do not have permission to perform this action"),
  ] as const,
};

const THROTTLED = {
  "map/config": demoConfig(),
  "geocoding/search": [
    429,
    demoEnvelope("error.429.too_many_requests", "Too many requests"),
  ] as const,
};

const DOWN = {
  "map/config": demoConfig(),
  "geocoding/search": [
    502,
    demoEnvelope("error.502.geocoder_unavailable", "The geocoder is unavailable"),
  ] as const,
};

export default defineDemo({
  id: "geo.address-search",
  title: "Search-as-you-type, and the five ways it can say nothing",
  description:
    "The address field over usePlaceSearch. Below the deployment's search_min_chars it says keep typing rather than showing an empty state; zero results is an empty state and never an error; a 401 states the deployment's own permission answer without alarm; a 429 keeps the last suggestions on screen; only a 502 is drawn as a failure, with a retry.",
  component: AddressSearchField,
  flow: "geo.geocode_address",
  variants: {
    default: {
      description: "Type three characters or more: the server's own `formatted` line per row.",
      viewport: "phone",
      step: "results",
      render: () => (
        <DemoFrame>
          <Framed handlers={RESULTS} />
        </DemoFrame>
      ),
    },
    empty: {
      description: "A successful call that matched nothing — an empty state, not a red box.",
      viewport: "phone",
      step: "empty",
      render: () => (
        <DemoFrame>
          <Framed handlers={NOTHING} />
        </DemoFrame>
      ),
    },
    unauthorized: {
      description:
        "401/403. The deployment's geocoding verbs default to authenticated-only, so this is the normal configuration for a signed-out visitor — stated in plain text, with the map still working.",
      viewport: "phone",
      step: "unauthorized",
      render: () => (
        <DemoFrame>
          <Framed handlers={UNAUTHORIZED} />
        </DemoFrame>
      ),
    },
    throttled: {
      description:
        "429. The last good suggestions stay on screen and a line says why nothing new arrives. A rate limit is the server asking for quiet, not a fault.",
      viewport: "phone",
      step: "throttled",
      render: () => (
        <DemoFrame>
          <Framed handlers={THROTTLED} />
        </DemoFrame>
      ),
    },
    unavailable: {
      description: "502 — the one that IS a failure, and the one that is retryable.",
      viewport: "phone",
      step: "unavailable",
      render: () => (
        <DemoFrame>
          <Framed handlers={DOWN} />
        </DemoFrame>
      ),
    },
  },
});
