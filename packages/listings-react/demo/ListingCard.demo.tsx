/** The card another pair renders: badges from the stored projection alone. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ListingCard } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

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
    "no-photo": {
      viewport: "desktop",
      step: "member_no_media",
      description:
        "No photo and no price — the two absences a marketplace grid has to draw honestly.",
      render: () => <NoPhotoCard />,
    },
  },
});
