/** The category grid — the public board narrowed to a category subtree. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingBoardPane } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE, DEMO_PAGE_WITH_NEXT } from "./fixtures.js";

const FULL: DemoHandlers = { "/listings/": DEMO_PAGE };
const PAGED: DemoHandlers = { "/listings/": DEMO_PAGE_WITH_NEXT };
const EMPTY: DemoHandlers = {
  "/listings/": { items: [], has_next: false, has_prev: false, count: 0 },
};
const BROKEN: DemoHandlers = { "/listings/": [503, {}] };

function Board(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ListingsDemoHarness handlers={props.handlers}>
      <ListingBoardPane categoryIds={["7", "8"]} hrefFor={(id) => `/l/${String(id)}`} />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.board",
  title: "Category board",
  description:
    "The default grid for a category page on a deployment without the search module: GET /listings/?category_id= with the category and its subtree. Loading, empty and failed are three arms; the pager renders only when there is a page to go to.",
  component: ListingBoardPane,
  covers: ["ListingBoard"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready_single_page",
      description: "The category's listings, one page.",
      render: () => <Board handlers={FULL} />,
    },
    paged: {
      viewport: "desktop",
      step: "ready_has_next",
      description: "A second page exists, so the pager appears.",
      render: () => <Board handlers={PAGED} />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "No listings in this category yet.",
      render: () => <Board handlers={EMPTY} />,
    },
    failed: {
      viewport: "phone",
      step: "failed",
      description: "We could not ask — a retry, never an empty grid.",
      render: () => <Board handlers={BROKEN} />,
    },
  },
});
