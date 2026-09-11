/** The public seller page — a person with SECTIONS, not one filtered list. */
import type { ReactElement, ReactNode } from "react";
import { Card, Typography } from "antd";
import { defineDemo } from "@stapel/showcase";
import { SellerPage, PublicProfilePage } from "../src/default/index.js";
import type { SellerPageTab } from "../src/default/index.js";
import { SELLER_TAB } from "../src/index.js";
import { ProfilesDemoHarness } from "./_harness.js";
import { ADA, ADA_ID, SELF_ID } from "./_fixtures.js";

const HANDLERS = {
  "/relationship": { user_id: ADA_ID, status: "neutral" },
  [`/${ADA_ID}`]: ADA,
} as const;

/**
 * Stand-ins for the three bodies a storefront hands in: the inventory is
 * `@stapel/search-react` or `@stapel/listings-react`, the reviews are
 * `@stapel/reviews-react`'s `<ReviewsPanel>`, and the introduction is whatever
 * the deployment has to say. `<SellerPage>` owns none of them — it owns the
 * skeleton — so the demo photographs the skeleton with plain copy in the
 * slots rather than pulling three other pairs in to draw a tab strip.
 *
 * The copy is fixture DATA, held in constants for the same reason the people
 * are: a demo's sample text is not a label, and the guardrail that forbids
 * literal JSX prose is right to forbid it.
 */
const OVERVIEW_BODY =
  "Restoring and selling vintage calculating machines since 2019. Every item is tested before it is listed, and posted within one working day.";
const LISTINGS_BODY =
  "Fourteen items on sale — the host mounts its own owner-scoped feed here, filter rail and all.";
const REVIEWS_BODY =
  "Nine reviews, 4.8 average — <ReviewsPanel> from @stapel/reviews-react goes in this slot.";

function Body(props: { readonly text: string }): ReactElement {
  return (
    <Card>
      <Typography.Paragraph>{props.text}</Typography.Paragraph>
    </Card>
  );
}

function identity(): ReactNode {
  return <PublicProfilePage userId={ADA_ID} selfUserId={SELF_ID} />;
}

const THREE: readonly SellerPageTab[] = [
  { key: SELLER_TAB.overview, content: <Body text={OVERVIEW_BODY} /> },
  { key: SELLER_TAB.listings, content: <Body text={LISTINGS_BODY} /> },
  { key: SELLER_TAB.reviews, content: <Body text={REVIEWS_BODY} /> },
];

/** The page as a buyer meets it: the inventory is what `/u/<id>` shows. */
function Page(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <SellerPage identity={identity()} tabs={THREE} />
    </ProfilesDemoHarness>
  );
}

/** A routed host at `/u/<id>/reviews`: the address decides the section, and
 * the person stays above it. */
function Reviews(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <SellerPage
        identity={identity()}
        tabs={THREE}
        activeTab={SELLER_TAB.reviews}
      />
    </ProfilesDemoHarness>
  );
}

/** A deployment that has not enabled reviews. Two sections, and a
 * `/u/<id>/reviews` link from before they were switched off lands on a real
 * one instead of on an empty frame. */
function TwoSections(): ReactElement {
  return (
    <ProfilesDemoHarness handlers={HANDLERS}>
      <SellerPage
        identity={identity()}
        tabs={[THREE[0], THREE[1]] as readonly SellerPageTab[]}
        activeTab={SELLER_TAB.reviews}
      />
    </ProfilesDemoHarness>
  );
}

/**
 * The composition walk read our seller page as "functionally a pre-filtered
 * search results page scoped to one seller" (§30(a)): the inventory, and
 * nothing else — no way to read what other buyers said, nowhere for a seller
 * to say anything about themselves. The reference's page is three sections.
 * This is the skeleton that holds them: identity above, sections below, the
 * URL in the host's hands.
 */
export default defineDemo({
  id: "profiles.seller-page-skin",
  title: "Seller page (skin)",
  description:
    "The public /u/:id page as three sections over one identity: overview, listings and reviews. The bodies belong to whichever pairs a storefront composes — search or listings for the inventory, reviews-react for the reviews — so this owns the skeleton: the identity block that never moves, the section bar, and the section the host's URL names. Opens on the inventory, because somebody who arrives from a listing came to see the rest of what this person sells.",
  component: SellerPage,
  covers: ["PublicProfilePage"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    page: {
      description:
        "The bare /u/<id>: the inventory section, under a name, a face and a tenure that no section changes.",
      viewport: "desktop",
      step: "listings",
      render: () => <Page />,
    },
    reviews: {
      description:
        "/u/<id>/reviews on a phone — the address chose the section, and the person is still at the top of it.",
      viewport: "phone",
      step: "reviews",
      render: () => <Reviews />,
    },
    "two-sections": {
      description:
        "A deployment with no reviews section, asked for one anyway: a stale link resolves to a section this page really has instead of leaving the frame empty.",
      viewport: "desktop",
      step: "fallback",
      render: () => <TwoSections />,
    },
  },
});
