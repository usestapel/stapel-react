/** Both axes on one page: published, and the edit under review. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingDetailPane } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_DETAIL } from "./fixtures.js";

const HANDLERS: DemoHandlers = {
  "/listings/7/status/": {
    status: "published",
    moderation_status: "pending",
    is_deleted: false,
    is_expired: false,
    is_active: true,
    owner_id: DEMO_DETAIL.owner,
  },
  "/listings/7/": DEMO_DETAIL,
};

function Buyer(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="ListingDetailPane — a buyer">
        <ListingDetailPane id={7} />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function Owner(): ReactElement {
  return (
    <ListingsDemoHarness handlers={HANDLERS}>
      <DemoCard heading="ListingDetailPane — the owner">
        <ListingDetailPane id={7} viewerId={DEMO_DETAIL.owner} />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.detail",
  title: "Listing detail",
  description:
    "The same listing, read by two people. A buyer sees a live page. The OWNER also sees the moderation axis — 'published, changes under review' — because since stapel-listings 0.5.0 an edit to a live listing keeps status=published and moves only moderation_status, and a dashboard that derived one field from the other would either hide the listing or hide the review.",
  component: ListingDetailPane,
  covers: ["ListingDetail"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Buyer /> },
    owner: { render: () => <Owner /> },
  },
});
