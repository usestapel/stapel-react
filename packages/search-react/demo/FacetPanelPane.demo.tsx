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
 * category and the location arrived in the URL, and each one has a control
 * that WIDENS it again even though no host filled either slot.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FacetPanelPane } from "../src/default/FacetPanelPane.js";
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
      <FacetPanelPane categoryFeatures={DEMO_FEATURES} languages={LANGUAGES} />
    </SearchSkinHarness>
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
        "A shared link that already narrows by category, brand, power and a 25km radius — at 390px. Every one of those constraints has a control that removes it, including the two whose slots no host filled.",
      viewport: "phone",
      step: "narrowed",
      render: () => <Panel phone search={NARROWED_SEARCH} />,
    },
  },
});
