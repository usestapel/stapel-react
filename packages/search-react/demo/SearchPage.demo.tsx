/**
 * The screen `/s` actually renders — the one the nav manifest names and the
 * one that, until 0.6.0, had no story at all: every demo in this package drew
 * the headless bag's state chips, so nobody had ever LOOKED at the product.
 *
 * Two variants because the page has two shapes: the filters are a column on a
 * desktop and a bottom sheet behind a "Filters (N)" button on a phone. The
 * shape is pinned per variant (`filtersLayout`) rather than left to the
 * viewport, so each one photographs what it is named for.
 */
import type { ReactElement, ReactNode } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchPage } from "../src/default/SearchPage.js";
import { SearchDemoHarness, useMemoryParams } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_FEATURES,
  DEMO_RANKING,
  DEMO_SEARCH_RESPONSE,
  DEMO_TYPE,
} from "./fixtures.js";

/** The narrow frame a phone variant is drawn in (390px — the iPhone width the
 * visual pass shoots at), as a named constant rather than a bare number. */
export const PHONE_FRAME_WIDTH = 390;

const HANDLERS: DemoHandlers = {
  "/query": DEMO_SEARCH_RESPONSE,
  "/suggest": { items: ["Bosch GSB 13 RE", "Bosch GBH 2-26"], backend: "postgres" },
  "/ranking": DEMO_RANKING,
};

function Frame(props: { phone?: boolean; children: ReactNode }): ReactElement {
  return (
    <div style={props.phone === true ? { maxWidth: PHONE_FRAME_WIDTH } : undefined}>
      {props.children}
    </div>
  );
}

function Page(props: {
  phone?: boolean;
  search?: string;
}): ReactElement {
  const adapter = useMemoryParams(props.search ?? `type=${DEMO_TYPE}&q=bosch`);
  return (
    <SearchDemoHarness handlers={HANDLERS}>
      <Frame {...(props.phone === true ? { phone: true } : {})}>
        <SearchPage
          adapter={adapter}
          defaultType={DEMO_TYPE}
          categoryFeatures={DEMO_FEATURES}
          filtersLayout={props.phone === true ? "sheet" : "column"}
        />
      </Frame>
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
      render: () => (
        <Page phone search={`type=${DEMO_TYPE}&q=bosch&lat=abc&lon=37.6&r.price=cheap`} />
      ),
    },
  },
});
