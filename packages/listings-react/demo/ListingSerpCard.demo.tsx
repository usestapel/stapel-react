/**
 * The phone SERP's one-column card: photo strip, price first, action rail.
 *
 * The `trend` variant is the one worth reading twice. `priceTrend` is a SEAM
 * over data the search projection does not carry — no price history reaches
 * this card on any live deployment today (wave gap G-2) — so the fixture here
 * is exactly that: a fixture. The demo photographs the layout the field will
 * land into, and says so rather than implying the number is real.
 */
import type { ReactElement } from "react";
import { Button } from "antd";
import { defineDemo } from "@stapel/showcase";
import { useT } from "@stapel/core";
import { ListingSerpCard } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

/** Two photos, so the strip peeks and draws its dots. */
const MANY_PHOTOS = {
  ...DEMO_CARD,
  images: ["image/9f2c1a", "image/71b0dd", "image/33cc10"],
};

/** The host's spec line — derived by the container from the category's own
 * editorial order, never guessed by this pair. */
const SPECS = "demo.serp.specs";

/** A stand-in for the container's chat control. "Call" is the other one, and
 * it is deliberately absent: the search projection carries no telephone
 * number, so a demo that drew the button would be drawing a stub. */
function Rail(): ReactElement {
  const t = useT();
  return (
    <Button type="primary" size="small" data-testid="demo-chat">
      {t("demo.contact.seller")}
    </Button>
  );
}

function Seller(): ReactElement {
  const t = useT();
  return <span data-testid="demo-seller">{t("demo.serp.seller")}</span>;
}

/**
 * The card itself, INSIDE the harness — `useT()` needs the provider the
 * harness mounts, so the body cannot resolve copy from outside it.
 */
function Card(props: { readonly trend?: boolean }): ReactElement {
  const t = useT();
  return (
    <ListingSerpCard
      listing={MANY_PHOTOS}
      href="/l/7"
      specsLine={t(SPECS)}
      {...(props.trend === true
        ? { priceTrend: { oldPrice: "5900.00", direction: "down" as const } }
        : {})}
      sellerSlot={<Seller />}
      actionsRail={<Rail />}
    />
  );
}

function Basic(): ReactElement {
  return (
    <ListingsDemoHarness>
      <Card />
    </ListingsDemoHarness>
  );
}

function Trend(): ReactElement {
  return (
    <ListingsDemoHarness>
      <Card trend />
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness principal="anonymous">
      <ListingSerpCard listing={DEMO_CARD} href="/l/7" />
    </ListingsDemoHarness>
  );
}

function Bare(): ReactElement {
  return (
    <ListingsDemoHarness>
      <ListingSerpCard
        listing={{ ...DEMO_CARD, id: 11, images: [], price: "", location_label: "" }}
        href="/l/11"
      />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.serp-card",
  title: "Listing SERP card",
  description:
    "The one-column result card of a phone search page: a SkinCarousel photo strip that peeks, then the PRICE as the first and largest line, the title at regular weight, the seller's spec line, the stored badge projection, the seller slot and the place. The strip sits outside the card's anchor on purpose — a horizontal swipe that ends inside a link is a swipe the browser may deliver as a navigation — and the trailing rail carries the container's call and chat controls with the favourite heart at its end.",
  component: ListingSerpCard,
  covers: ["ListingsProvider"],
  tokens: ["surface-raised", "text-muted"],
  variants: {
    default: {
      viewport: "phone",
      step: "member_three_photos",
      description:
        "Three photos, so the strip peeks and draws dots; a signed-in reader.",
      render: () => <Basic />,
    },
    trend: {
      viewport: "phone",
      step: "member_price_dropped",
      description:
        "The price-trend seam with fixture data: the arrow and the struck previous price. No live projection carries this yet (gap G-2).",
      render: () => <Trend />,
    },
    visitor: {
      viewport: "phone",
      step: "anonymous_blocked",
      description:
        "A visitor with no rail: the heart is off and its reason is printed beside it. A real feed wraps the list in a PaneGate so that sentence is said once, not once per card.",
      render: () => <Visitor />,
    },
    bare: {
      viewport: "desktop",
      step: "member_no_media",
      description:
        "No photo, no price, no place — the absences a result page has to draw without looking broken.",
      render: () => <Bare />,
    },
  },
});
