/**
 * The home feed: borderless tiles, two across, on the page's own ground.
 *
 * `<FeedGrid>` is covered here rather than in a demo of its own, because a
 * grid with nothing in it photographs as an empty rectangle — the thing worth
 * showing is the RHYTHM two columns of borderless tiles make, which only
 * exists once the tiles are in it.
 */
import type { ReactElement } from "react";
import { Tag } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { FeedGrid, ListingFeedCard } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

/** Six rows, so the grid has two full columns and a third row starting. */
const ROWS = [
  { ...DEMO_CARD, id: 7 },
  { ...DEMO_CARD, id: 8, title: "Makita HR2470 rotary hammer", price: "6900.00" },
  { ...DEMO_CARD, id: 9, title: "Extension cord, 20 m", price: "1200.00" },
  {
    ...DEMO_CARD,
    id: 10,
    title:
      "Bosch professional cordless drill with two batteries and a charger in the original case",
    price: "12400.00",
  },
  { ...DEMO_CARD, id: 11, title: "Drill bit set", price: "800.00", images: [] },
  { ...DEMO_CARD, id: 12, title: "Workbench vice", price: "" },
];

function NewTag(): ReactElement {
  const t = useT();
  return <Tag color="blue">{t("demo.feed.badge")}</Tag>;
}

function Feed(): ReactElement {
  return (
    <ListingsDemoHarness>
      <FeedGrid>
        {ROWS.map((row) => (
          <ListingFeedCard
            key={row.id}
            listing={row}
            href={`/l/${String(row.id)}`}
            {...(row.id === 7 ? { badgeOverlay: <NewTag /> } : {})}
          />
        ))}
      </FeedGrid>
    </ListingsDemoHarness>
  );
}

function Single(): ReactElement {
  return (
    <ListingsDemoHarness>
      <ListingFeedCard
        listing={ROWS[3] ?? DEMO_CARD}
        href="/l/10"
        badgeOverlay={<NewTag />}
      />
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <FeedGrid>
        {ROWS.slice(0, 2).map((row) => (
          <ListingFeedCard
            key={row.id}
            listing={row}
            href={`/l/${String(row.id)}`}
          />
        ))}
      </FeedGrid>
    </ListingsDemoHarness>
  );
}

function Wide(): ReactElement {
  return (
    <ListingsDemoHarness>
      <FeedGrid columns={4}>
        {ROWS.map((row) => (
          <ListingFeedCard
            key={row.id}
            listing={row}
            href={`/l/${String(row.id)}`}
          />
        ))}
      </FeedGrid>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.feed-card",
  title: "Listing feed card",
  description:
    "The phone home feed: no border and no card surface, so the photo is the card and the rhythm of the grid is what separates one listing from the next. Two lines of title then a clamp, the price in bold, the place muted, and the favourite heart pinned over the photo's trailing corner — the one surface in this pair where the heart floats, because a two-column tile has no line to spare for a refusal. A container draws the grid inside a PaneGate so that refusal is said once for the whole feed.",
  component: ListingFeedCard,
  covers: ["FeedGrid", "ListingsProvider"],
  tokens: ["text-muted"],
  variants: {
    default: {
      viewport: "phone",
      step: "member_two_columns",
      description:
        "Six listings, two across: a clamped two-line title, one badge overlay, and a row with no photo.",
      render: () => <Feed />,
    },
    tile: {
      viewport: "phone",
      step: "member_single_tile",
      description:
        "One tile on its own — the title clamp and the overlay, at full width.",
      render: () => <Single />,
    },
    visitor: {
      viewport: "phone",
      step: "anonymous_blocked",
      description:
        "A visitor: the hearts are off and each states its reason. This is the shot that argues for wrapping a real feed in a PaneGate.",
      render: () => <Visitor />,
    },
    wide: {
      viewport: "desktop",
      step: "member_four_columns",
      description:
        "columns={4} — desktop is not this wave's consumer, but the same declaration serves it.",
      render: () => <Wide />,
    },
  },
});
