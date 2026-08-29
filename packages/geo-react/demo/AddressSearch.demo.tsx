/**
 * The search field's states, side by side — the point being how FEW of them
 * are failures.
 *
 * Look at these with the intent that five of the six below are the system
 * working: nothing typed yet, still asking, nothing matched, not allowed to
 * ask, asked too often. Only the last one is a fault, and only it is drawn as
 * one.
 *
 * ── Why these variants hand the field a BAG and not a server ────────────────
 *
 * They used to differ only in what a canned `fetch` would have answered, and
 * they were all the same picture: `usePlaceSearch` starts at `query: ""`, which
 * is below `search_min_chars`, so `idle` is true, the effect returns before it
 * asks anything, and every variant painted "Keep typing to search." The five
 * handler maps were never reached — not on the first frame, not on any frame,
 * because nothing types into a static render.
 *
 * `AddressSearchField` takes `search: PlaceSearchBag` as a PROP. That is not a
 * test hatch bolted on for the demos; it is the component's shipped seam — the
 * default skin is a renderer over a bag a host supplies — so handing it a bag
 * exercises exactly the code a host runs. What it buys is that the first paint
 * IS the named state, which is the frame a shot runner keeps and the frame a
 * person opening the viewer sees.
 *
 * The hook itself is not left undocumented: `default` below drives the real
 * `usePlaceSearch` against the real wire, so the demo that claims
 * "search-as-you-type" is the one where typing really searches.
 */
import { useEffect } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { loadFailed, loadLoading, loadReady } from "@stapel/core";
import { AddressSearchField } from "../src/default/AddressSearchField.js";
import { usePlaceSearch } from "../src/headless/usePlaceSearch.js";
import type { PlaceSearchBag, PlaceSuggestion } from "../src/headless/usePlaceSearch.js";
import type { GeocodeFeature, MapConfig } from "../src/api/types.js";
import { GeoSkinTheme } from "../src/default/theme.js";
import {
  DEMO_SEARCH,
  DemoFrame,
  GeoDemoHarness,
  demoConfig,
  demoEnvelope,
} from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";

const CONFIG = demoConfig() as unknown as MapConfig;
/** Module-level: the hook takes the bias by identity (an effect dependency),
 * so a fresh literal each render would re-arm the debounce forever. */
const BIAS = { lat: 52.51667, lon: 13.38333 };

/** What a person has typed in every variant that shows an ANSWER to it. */
const TYPED = "Unter den Linden";

/** The demo's suggestions, built from the same features the wire sends. */
const SUGGESTIONS: readonly PlaceSuggestion[] = (
  DEMO_SEARCH["features"] as readonly GeocodeFeature[]
).map((feature, index) => {
  const properties = feature.properties as unknown as Record<string, unknown>;
  const coordinates = (feature.geometry as unknown as { coordinates: [number, number] })
    .coordinates;
  return {
    id: `w-${String(properties["osm_id"] ?? index)}`,
    label: String(properties["formatted"] ?? ""),
    // GeoJSON is [lon, lat]; the pair swaps it exactly once, in model/coords.
    point: { lat: coordinates[1], lon: coordinates[0] },
    feature,
  };
});

/**
 * A bag in one named state. Every field is filled — a partial bag would let a
 * variant render a state the type says cannot exist.
 */
function bag(overrides: Partial<PlaceSearchBag>): PlaceSearchBag {
  return {
    query: TYPED,
    setQuery: () => undefined,
    accept: () => undefined,
    chosen: false,
    results: loadReady(SUGGESTIONS),
    availability: "available",
    lang: "default",
    idle: false,
    retry: () => undefined,
    ...overrides,
  };
}

const TYPING = bag({ results: loadLoading() });
const NOTHING = bag({ results: loadReady([]) });
const UNAUTHORIZED = bag({
  results: loadFailed(
    demoEnvelope("error.401.unauthorized", "Authentication required")
  ),
  availability: "unauthorized",
});
const THROTTLED = bag({ availability: "throttled" });
const DOWN = bag({
  results: loadFailed(
    demoEnvelope("error.502.geocoder_unavailable", "The geocoder is unavailable")
  ),
  availability: "unavailable",
});

/**
 * A field over a fixed bag: the first paint is already the named state.
 *
 * Still mounted inside the harness — the field reads i18n and the geo runtime
 * from context, and a demo that skipped the providers would be documenting a
 * component nobody can mount. Nothing is fetched: the bag is the answer.
 */
const NO_WIRE: DemoHandlers = { "map/config": demoConfig() };

function Seeded(props: { search: PlaceSearchBag }): ReactElement {
  return (
    <GeoDemoHarness handlers={NO_WIRE}>
      <DemoFrame>
        <GeoSkinTheme>
          <AddressSearchField search={props.search} onPick={() => undefined} />
        </GeoSkinTheme>
      </DemoFrame>
    </GeoDemoHarness>
  );
}

/** The REAL hook against the REAL wire, with the query already typed in. */
function Live(): ReactElement {
  const search = usePlaceSearch({ config: CONFIG, bias: BIAS, zoom: 13 });
  const { setQuery } = search;
  // Typed the way a person types it — through the bag's own setter, so the
  // debounce, the abort and the min-chars gate all run for real.
  useEffect(() => {
    setQuery(TYPED);
  }, [setQuery]);
  return <AddressSearchField search={search} onPick={() => undefined} />;
}

const LIVE_HANDLERS = { "map/config": demoConfig(), "geocoding/search": DEMO_SEARCH };

export default defineDemo({
  id: "geo.address-search",
  title: "Search-as-you-type, and the six ways it can say nothing",
  description:
    "The address field over usePlaceSearch. Below the deployment's search_min_chars it says keep typing rather than showing an empty state; zero results is an empty state and never an error; a 401 states the deployment's own permission answer without alarm; a 429 keeps the last suggestions on screen; only a 502 is drawn as a failure, with a retry.",
  component: AddressSearchField,
  flow: "geo.geocode_address",
  variants: {
    default: {
      description:
        "Search-as-you-type, running for real: the query is typed through the bag's own setter, so the debounce, the abort and the min-chars gate all run, and the rows are the server's own `formatted` lines.",
      viewport: "phone",
      step: "results",
      render: () => (
        <GeoDemoHarness handlers={LIVE_HANDLERS}>
          <DemoFrame>
            <GeoSkinTheme>
              <Live />
            </GeoSkinTheme>
          </DemoFrame>
        </GeoDemoHarness>
      ),
    },
    typing: {
      description:
        "The keystroke is out and the answer is not back. A spinner, not an empty state — the field must never say `nothing matched` about a question that is still open.",
      viewport: "phone",
      step: "loading",
      render: () => <Seeded search={TYPING} />,
    },
    idle: {
      description:
        "Below the deployment's `search_min_chars`: nothing has been ASKED yet, so nothing is reported about results. Two letters that matched nothing and two letters nobody searched for are different sentences.",
      viewport: "phone",
      step: "idle",
      render: () => <Seeded search={bag({ query: "Un", idle: true })} />,
    },
    empty: {
      description: "A successful call that matched nothing — an empty state, not a red box.",
      viewport: "phone",
      step: "empty",
      render: () => <Seeded search={NOTHING} />,
    },
    unauthorized: {
      description:
        "401/403. The deployment's geocoding verbs default to authenticated-only, so this is the NORMAL configuration for a signed-out visitor — stated in plain text with no alarm, and the copy itself says the map still works and the pin can be placed by hand. It is not the geocoder being down.",
      viewport: "phone",
      step: "unauthorized",
      render: () => <Seeded search={UNAUTHORIZED} />,
    },
    throttled: {
      description:
        "429. The last good suggestions stay on screen and a line says why nothing new arrives. A rate limit is the server asking for quiet, not a fault.",
      viewport: "phone",
      step: "throttled",
      render: () => <Seeded search={THROTTLED} />,
    },
    unavailable: {
      description:
        "502 — the one that IS a failure, and the one that is retryable. Compare it with `unauthorized`: same empty list of suggestions, entirely different sentence and entirely different affordance.",
      viewport: "phone",
      step: "unavailable",
      render: () => <Seeded search={DOWN} />,
    },
  },
});
