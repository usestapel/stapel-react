/**
 * The row above a phone SERP's chips: where the search is looking, and how
 * much has been narrowed.
 *
 * The three variants are the three states that matter and the ones a
 * screenshot suite would otherwise never reach: nothing applied (the search is
 * looking everywhere, which is both the truth and the invitation), a place
 * with a radius, and a place with four other constraints beside it so the
 * count on the right has something to count.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { LocationSummaryLine } from "../src/default/LocationSummaryLine.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import { DEMO_SEARCH_RESPONSE, DEMO_TYPE } from "./fixtures.js";

const SEED: DemoSeed = { page: DEMO_SEARCH_RESPONSE };

/** No location at all — the state a fresh `/s` opens in. */
const EVERYWHERE = `type=${DEMO_TYPE}&q=bosch`;
/** A centre and a radius, exactly as a shared link carries them. */
const NEARBY = `type=${DEMO_TYPE}&q=bosch&lat=55.7963&lon=49.1064&radius_km=200`;
/** The same place, narrowed by four more things. */
const NARROWED = `${NEARBY}&f.brand=bosch&f.condition=used&r.power=500..1500`;

/**
 * The host's name for the point. Inside the harness because it is copy, and
 * because it is the whole argument of `geoLabel`: this package has two numbers
 * and no geocoder, so the NAME arrives from the container or not at all.
 */
function Line(): ReactElement {
  const t = useT();
  return (
    <LocationSummaryLine
      geoLabel={t("demo.geo.city")}
      onOpenAll={() => undefined}
    />
  );
}

function At(props: { readonly search: string }): ReactElement {
  return (
    <SearchSkinHarness search={props.search} seed={SEED} phone>
      <Line />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.location-summary",
  title: "Location summary line",
  description:
    "Where this search is looking, on a row of its own above the chips — because the chip row scrolls and location is the one constraint that changes what a result MEANS rather than narrowing a set. It prints the name the container handed it plus the radius, never a coordinate, and it opens the same location sheet the geo chip opens. On the right, the filter affordance carries a COUNT rather than the chip row's dot: this row has the width to say how many.",
  component: LocationSummaryLine,
  covers: ["SearchStateProvider"],
  tokens: ["brand", "text-muted"],
  variants: {
    everywhere: {
      description:
        "Nothing applied: the line says the search is looking everywhere, and the filter side carries no count.",
      viewport: "phone",
      step: "no-geo",
      render: () => <At search={EVERYWHERE} />,
    },
    placed: {
      description:
        "A centre and a 200 km radius from a shared link — the name comes from the host, the radius from the URL.",
      viewport: "phone",
      step: "geo-radius",
      render: () => <At search={NEARBY} />,
    },
    narrowed: {
      description:
        "The same place with four more constraints applied: the badge on the right counts them.",
      viewport: "phone",
      step: "geo-and-filters",
      render: () => <At search={NARROWED} />,
    },
    wide: {
      description:
        "The same row on a desktop: it is a full-width line either way, because what it states describes the whole page.",
      viewport: "desktop",
      step: "geo-desktop",
      render: () => (
        <SearchSkinHarness search={NARROWED} seed={SEED}>
          <Line />
        </SearchSkinHarness>
      ),
    },
  },
});
