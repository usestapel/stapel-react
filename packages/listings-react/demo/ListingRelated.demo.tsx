/**
 * THE TWO WAYS A LISTING PAGE ENDS — and they are two sections, not one rail.
 *
 * The reference classified draws "more options like this" and "other listings
 * from this seller" separately, and the separation is the point: a reader of
 * the first is still shopping, a reader of the second has decided who they are
 * buying from. Each is a horizontal strip so the next card peeks and the row
 * says it scrolls, and each carries a link into the search it is a sample of —
 * three cards are a taste, not the answer.
 *
 * The rows arrive from the HOST, because both lists are search results and
 * this pair does not read search (`<ListingRelatedStrip>` has the argument).
 */
import type { ReactElement } from "react";
import { Flex } from "antd";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { ListingRelatedStrip } from "../src/default/ListingRelated.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

const SIMILAR = [
  DEMO_CARD,
  { ...DEMO_CARD, id: 8, title: "Makita HR2470", price: "5200.00" },
  { ...DEMO_CARD, id: 9, title: "Metabo SBE 650", price: "3900.00" },
];

const FROM_SELLER = [
  { ...DEMO_CARD, id: 21, title: "Bosch PSB 500 RE", price: "2400.00" },
  { ...DEMO_CARD, id: 22, title: "Bosch GSR 12V-15", price: "6100.00" },
];

function Both(): ReactElement {
  return (
    <ListingsDemoHarness handlers={{}}>
      <Flex vertical gap={spacing[5]}>
        <ListingRelatedStrip
          heading="Similar listings"
          items={SIMILAR}
          testId="demo-similar"
          showAllHref="/s?category=tools%2Fpower"
          listingHref={(id) => `/l/${String(id)}`}
        />
        <ListingRelatedStrip
          heading="More from this seller"
          items={FROM_SELLER}
          testId="demo-from-seller"
          showAllHref="/s?owner=1f5b2b3c"
          listingHref={(id) => `/l/${String(id)}`}
        />
      </Flex>
    </ListingsDemoHarness>
  );
}

function NoLinkOut(): ReactElement {
  return (
    <ListingsDemoHarness handlers={{}}>
      <ListingRelatedStrip
        heading="More from this seller"
        items={FROM_SELLER}
        testId="demo-from-seller"
        listingHref={(id) => `/l/${String(id)}`}
      />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.related",
  title: "Find more",
  description:
    "The two sections a listing page ends with. They are separate because they answer different questions — 'what else is like this' and 'what else does this person sell' — and the reference classified draws both. Each strip is drawn only when it has rows: a heading over nothing reads as a section that failed to load, which is worse than no section.",
  component: ListingRelatedStrip,
  covers: ["ListingRelatedStrip"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "both_strips",
      description:
        "Both sections on a phone: one and a half cards wide, so the next one peeks and the row says it scrolls, each with a link into the search it samples.",
      render: () => <Both />,
    },
    "no-link-out": {
      viewport: "phone",
      step: "strip_without_show_all",
      description:
        "A host that named no search: the strip stands on its own rather than offering a 'show all' that goes nowhere.",
      render: () => <NoLinkOut />,
    },
  },
});
