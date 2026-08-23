/** The seller's dashboard: real counts, real rows, and the takedown that is in no tab. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MyListingsPane } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_COUNTERS,
  DEMO_MY_BLOCKED,
  DEMO_MY_NONE_BLOCKED,
  DEMO_MY_PAGE,
} from "./fixtures.js";

/**
 * One PATH, two questions. `GET my/listings/?status=published,pending` is the
 * active tab; `?status=blocked` is the takedown check the pane runs beside it.
 * The handler reads the query rather than answering both with the same body,
 * because a demo that showed a live listing as taken down would be teaching
 * the wrong screen.
 */
function handlers(blocked: unknown): DemoHandlers {
  return {
    "/listings/my/counters/": DEMO_COUNTERS,
    "/listings/my/listings/": (url: string) =>
      url.includes("status=blocked") ? blocked : DEMO_MY_PAGE,
  };
}

function Dashboard(): ReactElement {
  return (
    <ListingsDemoHarness handlers={handlers(DEMO_MY_NONE_BLOCKED)}>
      <DemoCard heading="MyListingsPane — the seller's own rows">
        <MyListingsPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function WithTakedown(): ReactElement {
  return (
    <ListingsDemoHarness handlers={handlers(DEMO_MY_BLOCKED)}>
      <DemoCard heading="MyListingsPane — one listing taken down">
        <MyListingsPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.mine",
  title: "My listings",
  description:
    "stapel-listings 0.7.0 gave the owner's own listings a route (GET my/listings/, every status, ?status= for a tab's set), so the rows here are the contract's own. Three things the pane refuses to smooth over: both axes on every row (a LIVE listing whose edit is under review says so — status alone cannot); a row still in draft renders off title_draft, because the published title is empty until a publish, and is marked as such; and a moderation takedown, which my/counters counts in no tab at all, sits ABOVE the tabs where it cannot be missed.",
  component: MyListingsPane,
  covers: ["MyListings"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Dashboard /> },
    "taken-down": { render: () => <WithTakedown /> },
  },
});
