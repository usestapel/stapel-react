/**
 * The screen `/s` actually renders — the one the nav manifest names and the
 * one that, until 0.6.0, had no story at all: every demo in this package drew
 * the headless bag's state chips, so nobody had ever LOOKED at the product.
 *
 * Three variants because the page has three shapes worth photographing: the
 * filters are a column on a desktop and a bottom sheet behind a "Filters (N)"
 * button on a phone, and a link whose parameters could not be read says so
 * instead of silently widening the search. The shape is pinned per variant
 * (`filtersLayout`) rather than left to the viewport, so each one photographs
 * what it is named for.
 *
 * Every variant is SEEDED (`_harness`'s `DemoSeed`): the answer is in the
 * query cache before the first render, so the static shot is the results page
 * rather than the skeleton every variant would otherwise share.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchPage } from "../src/default/SearchPage.js";
import { SearchDemoHarness, DemoFrame, useMemoryParams } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_FEATURES,
  DEMO_RANKING,
  DEMO_SEARCH_RESPONSE,
  DEMO_SUGGEST,
  DEMO_TYPE,
} from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/query": DEMO_SEARCH_RESPONSE,
  "/suggest": DEMO_SUGGEST,
  "/ranking": DEMO_RANKING,
};

const SEED: DemoSeed = { page: DEMO_SEARCH_RESPONSE };

const RESULTS_SEARCH = `type=${DEMO_TYPE}&q=bosch`;
const UNREADABLE_SEARCH = `type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6&r.price=cheap`;

function Page(props: { phone?: boolean; search?: string }): ReactElement {
  const search = props.search ?? RESULTS_SEARCH;
  const adapter = useMemoryParams(search);
  return (
    <SearchDemoHarness handlers={HANDLERS} seed={SEED} seedSearch={search}>
      <DemoFrame {...(props.phone === true ? { phone: true } : {})}>
        <SearchPage
          adapter={adapter}
          defaultType={DEMO_TYPE}
          categoryFeatures={DEMO_FEATURES}
          filtersLayout={props.phone === true ? "sheet" : "column"}
        />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

export default defineDemo({
  id: "search.page",
  title: "Search page",
  description:
    "The composed /s screen: the query box bound to setText, the filter panel (category and location slots, numeric ranges, drill-down facets), the sort and page-size toolbar, and one keyset page of cards with the DSA promoted marking explained in words rather than in a tooltip.",
  component: SearchPage,
  covers: ["SearchStateProvider", "SearchProvider"],
  tokens: ["surface-raised", "warning-bg"],
  variants: {
    desktop: {
      description: "Filters beside the results, the way a catalogue reads on a desktop.",
      viewport: "desktop",
      step: "results",
      render: () => <Page />,
    },
    phone: {
      description:
        "The same search at 390px: the filters move behind a Filters (N) button that opens a bottom sheet, so the first card is the first thing on screen.",
      viewport: "phone",
      step: "results-phone",
      render: () => <Page phone />,
    },
    "unreadable-link": {
      description:
        "A shared link whose location and price range could not be read: the page says which parameters it dropped instead of silently widening the search.",
      viewport: "phone",
      step: "url-issues",
      render: () => <Page phone search={UNREADABLE_SEARCH} />,
    },
  },
});
