/** The card another pair renders: badges from the stored projection alone. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingCard } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

function Card(): ReactElement {
  return (
    <ListingsDemoHarness>
      <DemoCard heading="ListingCard">
        <div style={{ width: 260 }}>
          <ListingCard listing={DEMO_CARD} href="/l/7" />
        </div>
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function VisitorCard(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <DemoCard heading="ListingCard — a visitor">
        <div style={{ width: 260 }}>
          <ListingCard listing={DEMO_CARD} href="/l/7" />
        </div>
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.card",
  title: "Listing card",
  description:
    "The slot @stapel/search-react fills through the container — the two pairs never import each other. Badges come out of the stored DAO projection, which carries each type's display config beside its value, so a grid of forty cards costs one query and no category read. The heart is never hidden from a visitor: it is blocked, with the reason, and the container attaches the sign-in CTA.",
  component: ListingCard,
  covers: ["ListingsProvider"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Card /> },
    visitor: { render: () => <VisitorCard /> },
  },
});
