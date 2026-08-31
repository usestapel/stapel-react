/**
 * The card another pair renders: badges from the stored projection alone.
 *
 * Two variants photograph the SAME card at the two widths it is asked to be,
 * because it is one component with two arms and a shot of either alone proves
 * nothing about the other. In a grid column it stacks — photo strip above,
 * price and title below. Given a full-width row (a "list" view on a desktop
 * SERP) it lays the strip BESIDE the text at a fixed 260px, so several offers
 * fit a screen. The live 1440px SERP was measured at one card per screen,
 * 974x835, with a 974x731 photograph: a grid card handed a full-page track and
 * asked to keep its shape.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingCard } from "../src/default/index.js";
import { LISTING_CARD_ROW_MIN } from "../src/default/ListingCard.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

/** Three photos, so the strip peeks and draws its dots — what every card on
 * the live category page carried, and what the desktop card drew one of. */
const THREE_PHOTOS = {
  ...DEMO_CARD,
  images: ["image/9f2c1a", "image/71b0dd", "image/33cc10"],
};

/** A grid column, at the width `<SearchResultsPane>`'s grid gives one. */
function GridCell(): ReactElement {
  return (
    <div style={{ width: 320 }}>
      <ListingsDemoHarness>
        <ListingCard listing={THREE_PHOTOS} href="/l/7" signIn={{ href: "/login" }} />
      </ListingsDemoHarness>
    </div>
  );
}

/** A list row, at the width the desktop SERP's one-column arrangement gives
 * one. Comfortably over {@link LISTING_CARD_ROW_MIN}, which is the point. */
function ListRow(): ReactElement {
  return (
    <div style={{ width: LISTING_CARD_ROW_MIN + 400 }}>
      <ListingsDemoHarness>
        <ListingCard listing={THREE_PHOTOS} href="/l/7" signIn={{ href: "/login" }} />
      </ListingsDemoHarness>
    </div>
  );
}

function Card(): ReactElement {
  return (
    <ListingsDemoHarness>
      <ListingCard listing={DEMO_CARD} href="/l/7" signIn={{ href: "/login" }} />
    </ListingsDemoHarness>
  );
}

function SavedCard(): ReactElement {
  return (
    <ListingsDemoHarness>
      <ListingCard
        listing={{ ...DEMO_CARD, is_favorited: true }}
        href="/l/7"
        signIn={{ href: "/login" }}
      />
    </ListingsDemoHarness>
  );
}

function VisitorCard(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <ListingCard listing={DEMO_CARD} href="/l/7" signIn={{ href: "/login" }} />
    </ListingsDemoHarness>
  );
}

function NoPhotoCard(): ReactElement {
  return (
    <ListingsDemoHarness>
      <ListingCard
        listing={{ ...DEMO_CARD, id: 11, images: [], price: "" }}
        href="/l/11"
      />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.card",
  title: "Listing card",
  description:
    "The slot @stapel/search-react fills through the container — the two pairs never import each other. Badges come out of the stored DAO projection, which carries each type's display config beside its value, so a grid of forty cards costs one query and no category read. The heart is never hidden from a visitor: it is blocked, the reason is printed beside it as ordinary text (a disabled button never fires the events a tooltip needs), and the container attaches the sign-in door.",
  component: ListingCard,
  covers: ["ListingsProvider"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "member_not_saved",
      description: "A signed-in reader: one primary, the heart beside it.",
      render: () => <Card />,
    },
    saved: {
      viewport: "phone",
      step: "member_saved",
      description: "The same card once the heart is filled.",
      render: () => <SavedCard />,
    },
    visitor: {
      viewport: "phone",
      step: "anonymous_blocked",
      description:
        "A visitor: the heart is off, the reason is on the page, and the door is beside it.",
      render: () => <VisitorCard />,
    },
    "grid cell": {
      viewport: "phone",
      step: "member_stacked_320",
      description:
        "In a 320px grid column: the card stacks, the photo strip runs edge to edge above the text, and the three photos peek with dots. Below the row threshold, so nothing about a grid changes.",
      render: () => <GridCell />,
    },
    "list row": {
      viewport: "desktop",
      step: "member_row_960",
      description:
        "The same card in a 960px list row: the strip moves beside the text at a fixed 260px and the reading column takes what is left, so several offers fit a screen. The live desktop SERP drew this as one 974x835 card per screen with a 974x731 photograph and no carousel at all.",
      render: () => <ListRow />,
    },
    "no-photo": {
      viewport: "desktop",
      step: "member_no_media",
      description:
        "No photo and no price — the two absences a marketplace grid has to draw honestly.",
      render: () => <NoPhotoCard />,
    },
  },
});
