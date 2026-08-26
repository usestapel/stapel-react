/**
 * The result page as a PRODUCT surface — the count, the honesty banner, the
 * grid of cards and the keyset controls, drawn by the default skin.
 *
 * The pane's four load arms are the reason this demo is seeded rather than
 * fetched: "nothing matches this search" and "we could not run this search"
 * are different sentences about different facts, and a demo whose answer
 * arrives asynchronously photographs the skeleton under both names. Each
 * variant therefore opens with its answer already in the query cache.
 *
 * The empty variant is not an edge case: it is the arm whose substitution for
 * the failure arm cost the 2026-08-09 incident, and the one a reviewer should
 * be able to see without a debugger.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { SearchResultsPane } from "../src/default/SearchResultsPane.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";
import {
  DEMO_EMPTY_RESPONSE,
  DEMO_RANKING,
  DEMO_SEARCH_RESPONSE,
  DEMO_TYPE,
} from "./fixtures.js";

const SEARCH = `type=${DEMO_TYPE}&q=bosch`;
// The ranking answer rides along so the degradation banner can NAME the scorer
// the engine skipped instead of printing its registry slug — the disclosure is
// where that name lives, and the pane reads it from cache without asking again.
const FOUND: DemoSeed = {
  page: DEMO_SEARCH_RESPONSE,
  ranking: DEMO_RANKING,
  rankingType: DEMO_TYPE,
};
const NOTHING: DemoSeed = { page: DEMO_EMPTY_RESPONSE };

function Pane(props: { phone?: boolean; seed: DemoSeed }): ReactElement {
  return (
    <SearchSkinHarness
      search={SEARCH}
      seed={props.seed}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <SearchResultsPane />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.results-pane",
  title: "Results pane",
  description:
    "One keyset page in the default skin: a counted heading (a capped count reads 'N+', never a flat number the server did not promise), the degradation banner, an auto-fill card grid, and a pager that is ABSENT when there is nothing to page rather than disabled with its reason in a tooltip.",
  component: SearchResultsPane,
  covers: ["SearchResults"],
  tokens: ["surface-raised", "warning-bg"],
  variants: {
    desktop: {
      description:
        "A found page on a desktop: as many card columns as fit, capped at the reading measure so the status row stays beside the controls that act on it.",
      viewport: "desktop",
      step: "results",
      render: () => <Pane seed={FOUND} />,
    },
    phone: {
      description:
        "The same page at 390px — the grid collapses to one column with no breakpoint to maintain.",
      viewport: "phone",
      step: "results-phone",
      render: () => <Pane phone seed={FOUND} />,
    },
    empty: {
      description:
        "A search that RAN and matched nothing: the designed empty state, and no pager under it — two dead buttons below an empty page is the C-DEADPAGER defect.",
      viewport: "phone",
      step: "empty",
      render: () => <Pane phone seed={NOTHING} />,
    },
  },
});
