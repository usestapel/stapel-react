/**
 * The filter panel in the default skin: everything that narrows a search, in
 * the order a person narrows it — category, language, location, numeric
 * ranges, then the drill-down facets with their counts.
 *
 * The two unfilled slots are the subject as much as the facets are. A panel
 * that silently omits `renderCategoryFilter` looks finished and is not, so a
 * DEV build draws a named placeholder where the control belongs. A production
 * build — which is what the showcase and these shots are — draws neither the
 * placeholder nor its heading: a "Location" label over empty space is not a
 * quieter version of the warning, it is a different defect.
 *
 * The second variant shows the same panel narrowed by a shared link: the
 * category arrived in the URL, and it has a control that WIDENS it again even
 * though no host filled the slot.
 *
 * THE LOCATION IS NOT IN HERE, and its absence is the point. A place is not a
 * filter — a coordinate pair is the machine form of somewhere, and a "Location"
 * group in this list is what let a live landing report "clear all filters (2)"
 * over an empty page with two constraints that had no name. The place, its
 * radius and the way off are one control of their own: see the
 * `search.location-summary-line` demo.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FacetPanelPane } from "../src/default/FacetPanelPane.js";
import { FILTERS_RAIL_WIDTH } from "../src/default/SearchPage.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import { DEMO_FEATURES, DEMO_SEARCH_RESPONSE, DEMO_TYPE } from "./fixtures.js";

const SEED: DemoSeed = { page: DEMO_SEARCH_RESPONSE };
const OPEN_SEARCH = `type=${DEMO_TYPE}&q=bosch`;
const NARROWED_SEARCH =
  `type=${DEMO_TYPE}&q=bosch&category=tools%2Fdrills&f.brand=bosch` +
  "&r.power_w=500..1200&lat=55.75&lon=37.62&radius_km=25";

const LANGUAGES: readonly string[] = ["ru", "en"];

function Panel(props: { phone?: boolean; search: string }): ReactElement {
  return (
    <SearchSkinHarness
      search={props.search}
      seed={SEED}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <FacetPanelPane
        categoryFeatures={DEMO_FEATURES}
        languages={LANGUAGES}
      />
    </SearchSkinHarness>
  );
}

/**
 * The panel at the width it actually gets on a desktop SERP — the rail, not
 * the page.
 *
 * `<SearchPage>` gives the filters a fixed 280px column, and the heading row
 * has to survive it with a twenty-five-character "Clear all filters (3)"
 * beside the word "Filters". On the live stand it did not: the heading came
 * out 43px wide and 78px tall, three lines, one syllable each (defect C14).
 * Photographed at the rail's own width because that is the only width at
 * which the row is under any pressure at all.
 */
function Rail(): ReactElement {
  return (
    <div style={{ width: FILTERS_RAIL_WIDTH }}>
      <SearchSkinHarness search={NARROWED_SEARCH} seed={SEED}>
        <FacetPanelPane
          categoryFeatures={DEMO_FEATURES}
          languages={LANGUAGES}
        />
      </SearchSkinHarness>
    </div>
  );
}

export default defineDemo({
  id: "search.facet-panel-pane",
  title: "Filter panel",
  description:
    "The drill-down facet panel with every count beside its option — including the options you have not chosen, which is what makes them drill-down rather than naive — plus the server's honesty flags said in words: 'these counts are approximate' and the slugs it did not count at all, whose options read 'not counted' and never a zero that looks like an answer.",
  component: FacetPanelPane,
  covers: ["FacetPanel"],
  tokens: ["surface-raised"],
  variants: {
    "open-search": {
      description:
        "Nothing narrowed yet: the language filter, the numeric range row the category schema declares, and the drill-down facets with the count each option would give you. The unfilled category and location slots are named holes in a dev build and nothing at all here — a label with no control under it is not an honest placeholder.",
      viewport: "desktop",
      step: "open",
      render: () => <Panel search={OPEN_SEARCH} />,
    },
    narrowed: {
      description:
        "A shared link that already narrows by category, brand, power and a 25km radius — at 390px. Every one of those constraints has a control that removes it, including the two whose slots no host filled. The location reads as the place the host named it, not as the pair of numbers the URL stores.",
      viewport: "phone",
      step: "narrowed",
      render: () => <Panel phone search={NARROWED_SEARCH} />,
    },
    "in the desktop rail": {
      description:
        "The same narrowed panel in the 280px column <SearchPage> gives it. Both halves of the heading row are present and neither is squeezed: the word keeps its own width and never breaks between its letters, and \"Clear all filters (3)\" wraps onto its own line instead of taking the heading's. Measured on the live SERP before this, the heading was a 43x78 box holding three lines.",
      viewport: "desktop",
      step: "narrowed-in-rail",
      render: () => <Rail />,
    },
  },
});
