/**
 * "Search in other categories" as ONE line, drawn from the answer that drew
 * the cards.
 *
 * The demo is seeded rather than fetched because the whole claim of this
 * control is about TIMING: the rows come out of `facet_meta.categories` on the
 * search response, in the same frame as the results, so there is nothing to
 * arrive late and nothing to push the page. A variant whose answer landed
 * asynchronously would photograph an empty line and prove the opposite.
 *
 * The third variant is the one case that does earn a request — an empty result
 * set has no candidates, so the categories come from `/suggest` and the line
 * holds its height while they travel.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { OtherCategoriesLine } from "../src/default/OtherCategoriesLine.js";
import { OTHER_CATEGORIES_PHONE_LIMIT } from "../src/index.js";
import { SearchSkinHarness } from "./_harness.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";
import {
  DEMO_EMPTY_RESPONSE,
  DEMO_SEARCH_RESPONSE,
  DEMO_SUGGEST,
  DEMO_TYPE,
} from "./fixtures.js";

const SEARCH = `type=${DEMO_TYPE}&q=bosch`;

/**
 * Ten sections the same query reaches, busiest first — two more than the
 * desktop cap, so the fold marker is part of every shot rather than a state
 * only a reviewer with a debugger ever sees.
 *
 * Each path ends in a SLUG on purpose: it exercises the third and last naming
 * source (the host resolver and a cached `/suggest` answer come first), and it
 * is the source a storefront falls back to when it has no catalogue loaded.
 */
const REACHED: readonly (readonly [string, number])[] = [
  ["10/dreli", 128],
  ["10/perforatory", 74],
  ["10/shurupoverty", 61],
  ["11/gaykoverty", 44],
  ["11/lobziki", 39],
  ["12/bolgarki", 27],
  ["12/frezery", 18],
  ["13/kompressory", 12],
  ["13/generatory", 7],
  ["14/pylesosy", 3],
];

const REACHED_SEED: DemoSeed = {
  page: {
    ...DEMO_SEARCH_RESPONSE,
    facet_meta: {
      ...DEMO_SEARCH_RESPONSE.facet_meta,
      categories: REACHED.map(([category, count]) => ({ category, count })),
    },
  },
};

/**
 * Nothing matched, so `facet_meta.categories` is empty by definition and the
 * rows can only come from `/suggest` — which is also where their NAMES come
 * from, so this variant shows the server-named arm beside the slug-named one.
 */
const NOTHING_SEED: DemoSeed = { page: DEMO_EMPTY_RESPONSE };

/** The empty-result path's own request — the only one this control ever makes,
 * and the reason the slot holds its height while it travels. */
const NOTHING_HANDLERS: DemoHandlers = { "/suggest": DEMO_SUGGEST };

function Line(props: {
  readonly seed: DemoSeed;
  readonly handlers?: DemoHandlers;
  readonly phone?: boolean;
  readonly limit?: number;
}): ReactElement {
  return (
    <SearchSkinHarness
      search={SEARCH}
      seed={props.seed}
      {...(props.handlers !== undefined ? { handlers: props.handlers } : {})}
      {...(props.phone === true ? { phone: true } : {})}
    >
      <OtherCategoriesLine {...(props.limit !== undefined ? { limit: props.limit } : {})} />
    </SearchSkinHarness>
  );
}

export default defineDemo({
  id: "search.other-categories-line",
  title: "Other categories line",
  description:
    "The sections this query also reaches, with the count each one has FOR THIS QUERY, on one line under the results. Pressing an entry narrows the search that is already on screen rather than leaving it for the bare category feed, whose number would be a different and larger one — so every entry is a real button and none of them is a link.",
  component: OtherCategoriesLine,
  covers: ["OtherCategoriesLine"],
  tokens: ["text-subtle"],
  variants: {
    line: {
      description:
        "Ten reachable sections on a desktop: eight print, the rest fold behind a marker that says how many are hidden. Drawn from the search response, so it is on screen in the first frame with the cards.",
      viewport: "desktop",
      step: "other-categories",
      render: () => <Line seed={REACHED_SEED} />,
    },
    narrow: {
      description:
        "The same ten at 390px with the sheet's own cap passed in: four entries plus the fold, because eight short names are a paragraph at this width and the requirement is a line. The collapsed line is clamped to two rows besides — a cap counts entries, and it is name length that makes a paragraph.",
      viewport: "phone",
      step: "other-categories-phone",
      render: () => (
        <Line seed={REACHED_SEED} phone limit={OTHER_CATEGORIES_PHONE_LIMIT} />
      ),
    },
    empty: {
      description:
        "Nothing matched, which is the one screen where 'this word exists in these sections' is worth the most and the only one with a request behind it. The rows carry the server's own names, and the slot holds its height from the first frame so the answer lands without moving the page a second time.",
      viewport: "desktop",
      step: "other-categories-empty",
      render: () => <Line seed={NOTHING_SEED} handlers={NOTHING_HANDLERS} />,
    },
  },
});
