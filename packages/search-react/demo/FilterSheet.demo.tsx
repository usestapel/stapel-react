/**
 * The phone filter sheet, OPEN.
 *
 * On a phone this is the whole filter path: the panel is not on the page, it
 * is behind a button, and every count, every checkbox and the control that
 * commits them live inside a surface a static shot had never once caught. The
 * visual pass could say nothing about it beyond "unproven", because the two
 * stories that would have shown it rendered a blank page and the third was the
 * closed button.
 *
 * `defaultFiltersOpen` is what makes it photographable — a real prop, for a
 * container that deep-links into the filters, not a test hook. The link the
 * story mounts on already carries a brand and a power range, so the sheet
 * opens with something applied: the Clear all appears, the drill-down counts
 * are beside their options, and the footer says how many results the choices
 * so far actually lead to.
 *
 * ONE variant on purpose. An open sheet is a portal, and a portal cannot be
 * server-rendered — which is what the multi-variant distinctness check does.
 * Splitting it out keeps that check honest for `search.page` instead of
 * turning it off.
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
  DEMO_TYPE,
} from "./fixtures.js";

const HANDLERS: DemoHandlers = { "/query": DEMO_SEARCH_RESPONSE };

const SEED: DemoSeed = {
  page: DEMO_SEARCH_RESPONSE,
  ranking: DEMO_RANKING,
  rankingType: DEMO_TYPE,
};

/** A shared link that already narrows by brand and by a power range. */
const NARROWED_SEARCH = `type=${DEMO_TYPE}&q=bosch&f.brand=bosch&r.power_w=500..1200`;

const LANGUAGES: readonly string[] = ["ru", "en"];

function Sheet(): ReactElement {
  const adapter = useMemoryParams(NARROWED_SEARCH);
  return (
    <SearchDemoHarness handlers={HANDLERS} seed={SEED} seedSearch={NARROWED_SEARCH}>
      <DemoFrame phone>
        <SearchPage
          adapter={adapter}
          defaultType={DEMO_TYPE}
          categoryFeatures={DEMO_FEATURES}
          languages={LANGUAGES}
          filtersLayout="sheet"
          defaultFiltersOpen
        />
      </DemoFrame>
    </SearchDemoHarness>
  );
}

export default defineDemo({
  id: "search.filter-sheet",
  title: "Filter sheet",
  description:
    "The filters as a phone actually meets them: a bottom sheet over the results, with the drill-down counts beside every option, a Clear all for the two constraints the link arrived with, and a footer that commits by saying how many results the current choices lead to rather than a bare 'Apply'.",
  component: SearchPage,
  tokens: ["surface-raised"],
  variants: {
    open: {
      description:
        "Opened on a link that already narrows by brand and power, at 390px. The sheet is as tall as its content up to 90% of the viewport, its body scrolls, and the commit button stays put at the bottom of it.",
      viewport: "phone",
      step: "sheet-open",
      render: () => <Sheet />,
    },
  },
});
