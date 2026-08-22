/** Real counts, and a named gap where the rows should be. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MyListingsPane } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_COUNTERS, DEMO_PAGE } from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/listings/my/counters/": DEMO_COUNTERS,
};

function WithoutSource(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="MyListingsPane — no source wired">
        <MyListingsPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function WithSource(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="MyListingsPane — a host-supplied source">
        <MyListingsPane source={() => Promise.resolve(DEMO_PAGE)} />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.mine",
  title: "My listings",
  description:
    "stapel-listings 0.6.1 has no owner-scoped list endpoint: GET /listings/ answers published() and takes no owner parameter, so a seller's own drafts are unreachable by any call the contract offers. The counters ARE real and are shown; the rows come from an injected source, and with none the pane says so instead of drawing an empty grid that reads as 'you have no listings'.",
  component: MyListingsPane,
  covers: ["MyListings"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <WithSource /> },
    "no-source": { render: () => <WithoutSource /> },
  },
});
