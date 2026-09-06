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
import { Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
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

/**
 * The ranking answer is seeded beside the page's own, and it is not decoration:
 * `degraded[]` reports a scorer the engine skipped as the slug `geo_decay`, and
 * the disclosure is the only thing that knows that slug's NAME. Seed it and the
 * banner says "Distance"; leave it out and the shot photographs a registry
 * identifier in a shopper's sentence, which is what the visual pass found.
 */
const SEED: DemoSeed = {
  page: DEMO_SEARCH_RESPONSE,
  ranking: DEMO_RANKING,
  rankingType: DEMO_TYPE,
};

const RESULTS_SEARCH = `type=${DEMO_TYPE}&q=bosch`;
const UNREADABLE_SEARCH = `type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6&r.price=cheap`;

/** The height a storefront's own pinned header takes — `<PublicShell>`
 * publishes exactly this as `--stapel-header-height`. Stated here because the
 * demo frame draws no shell of its own. */
const DEMO_HEADER_HEIGHT = 64;

function Page(props: {
  phone?: boolean;
  search?: string;
  /** The catalogue leaf shape — see the `catalogue-leaf` variant. */
  leaf?: boolean;
  /** Both columns told where the host's chrome ends — see `under-a-header`. */
  underHeader?: boolean;
}): ReactElement {
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
          {...(props.leaf === true
            ? {
                categoryFilter: false,
                resultsLead: <LeafIntro />,
              }
            : {})}
          {...(props.underHeader === true
            ? {
                railTop: DEMO_HEADER_HEIGHT,
                stickyToolbar: { top: DEMO_HEADER_HEIGHT },
              }
            : {})}
        />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

/** What a catalogue leaf puts over its own list — the `resultsLead` slot. */
function LeafIntro(): ReactElement {
  const t = useT();
  return (
    <Typography.Paragraph type="secondary" style={{ margin: 0 }}>
      {t("demo.leaf.intro")}
    </Typography.Paragraph>
  );
}

export default defineDemo({
  id: "search.page",
  title: "Search page",
  description:
    "The composed /s screen: the query box bound to setText, the filter panel (category and location slots, numeric ranges, drill-down facets), the sort and page-size toolbar, and one keyset page of cards with the DSA promoted marking explained in words rather than in a tooltip.",
  component: SearchPage,
  covers: ["SearchStateProvider", "SearchProvider", "SearchResults", "FacetPanel"],
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
    "catalogue-leaf": {
      description:
        "A page reached by walking the catalogue: the category IS the page, so the «Category» pane goes entirely (`categoryFilter={false}`) rather than printing the id path with a Clear button under it, and the leaf's own words go in `resultsLead` — inside the results column, above the toolbar, and not over the filter rail the way a full-width header would be.",
      viewport: "desktop",
      step: "catalogue-leaf",
      render: () => <Page leaf />,
    },
    "under-a-header": {
      description:
        "The same page under a host's pinned header: `railTop` starts the filter rail below it (and moves the rail's own height cap with it, so the rail still ends at the foot of the window rather than that far past it), and `stickyToolbar` pins the results toolbar at the same offset. Both used to be a host's stylesheet problem — the rail's `top: 0` is written INLINE, so moving it took the one `!important` a deployment had aimed at a pair's own geometry, and the toolbar had no element to aim anything at.",
      viewport: "desktop",
      step: "under-a-header",
      render: () => <Page underHeader />,
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
