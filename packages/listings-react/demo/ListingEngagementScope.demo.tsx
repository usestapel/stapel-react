/**
 * The engagement overlay — one request for a page, read by every card in it.
 *
 * This demo exists to photograph a DIFFERENCE rather than a component: the
 * scope renders nothing of its own, so the only honest way to show what it
 * does is the same grid twice, wired and unwired.
 *
 * The wired grid is what a shopper should see on their third evening of the
 * same search — the rows they have already opened sink back, the one they
 * saved carries a filled heart, and the two they have not seen stay at full
 * strength. The unwired grid beside it is the bug this closes: identical
 * rows, identical server, nothing dimmed and every heart an outline, because
 * a storefront's feed and SERP are drawn from the SEARCH index and its stored
 * document can carry neither a flag that differs per reader nor a counter
 * that moves faster than a re-index.
 *
 * `ListingEngagementContext` is covered here rather than in a demo of its
 * own: it is the wire between the two halves shown below, and a demo of a
 * context object is a photograph of nothing.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FeedGrid, ListingFeedCard } from "../src/default/index.js";
import { ListingEngagementScope } from "../src/index.js";
import type { ListingCard } from "../src/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import { DEMO_CARD } from "./fixtures.js";

/**
 * Four rows exactly as a search-served grid delivers them: no `viewed`, no
 * `view_count`, and `is_favorited: null` because the index cannot know who is
 * looking. Everything on screen below therefore comes from the overlay or
 * from nowhere.
 */
const ROWS: readonly ListingCard[] = [
  { ...DEMO_CARD, id: 7, is_favorited: null },
  {
    ...DEMO_CARD,
    id: 8,
    title: "Makita HR2470 rotary hammer",
    price: "6900.00",
    is_favorited: null,
  },
  {
    ...DEMO_CARD,
    id: 9,
    title: "Extension cord, 20 m",
    price: "1200.00",
    is_favorited: null,
  },
  {
    ...DEMO_CARD,
    id: 10,
    title: "Bosch cordless drill, two batteries and a charger",
    price: "12400.00",
    is_favorited: null,
  },
];

const IDS = ROWS.map((row) => row.id);

/** What `GET /listings/engagement/` answers for a signed-in reader: two rows
 * already opened, one of them saved, and two never seen. */
const MEMBER_OVERLAY = {
  items: {
    "7": { view_count: 340, viewed: true, is_favorited: false },
    "8": { view_count: 128, viewed: true, is_favorited: true },
    "9": { view_count: 12, viewed: false, is_favorited: false },
    "10": { view_count: 86, viewed: false, is_favorited: false },
  },
};

/**
 * The same endpoint for a VISITOR. `AllowAny` on purpose: `view_count` is
 * public and both per-viewer flags answer `null`, so a storefront makes the
 * identical request signed in or not and a guest's grid is not a second code
 * path. `null` dims nothing and claims nothing.
 */
const GUEST_OVERLAY = {
  items: {
    "7": { view_count: 340, viewed: null, is_favorited: null },
    "8": { view_count: 128, viewed: null, is_favorited: null },
    "9": { view_count: 12, viewed: null, is_favorited: null },
    "10": { view_count: 86, viewed: null, is_favorited: null },
  },
};

function Grid(): ReactElement {
  return (
    <FeedGrid>
      {ROWS.map((row) => (
        <ListingFeedCard
          key={row.id}
          listing={row}
          href={`/l/${String(row.id)}`}
        />
      ))}
    </FeedGrid>
  );
}

function Scoped(): ReactElement {
  return (
    <ListingsDemoHarness handlers={{ "/listings/engagement/": MEMBER_OVERLAY }}>
      <ListingEngagementScope ids={IDS}>
        <Grid />
      </ListingEngagementScope>
    </ListingsDemoHarness>
  );
}

function Unscoped(): ReactElement {
  // The same rows and the same server — the scope is the only thing missing,
  // and it is the whole difference.
  return (
    <ListingsDemoHarness handlers={{ "/listings/engagement/": MEMBER_OVERLAY }}>
      <Grid />
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness
      principal="anonymous"
      handlers={{ "/listings/engagement/": GUEST_OVERLAY }}
    >
      <ListingEngagementScope ids={IDS}>
        <Grid />
      </ListingEngagementScope>
    </ListingsDemoHarness>
  );
}

function Failed(): ReactElement {
  // A decoration that 500s must cost the grid nothing: no dimming invented,
  // no retry, and above all no error banner over a results page that works.
  return (
    <ListingsDemoHarness
      handlers={{ "/listings/engagement/": [500, { detail: "overlay down" }] }}
    >
      <ListingEngagementScope ids={IDS}>
        <Grid />
      </ListingEngagementScope>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.engagement-scope",
  title: "Engagement overlay",
  description:
    "One request for a whole page of cards, read by every card in it. A storefront's feed and SERP are drawn from the search index, whose stored document can carry neither a per-reader flag nor a fast-moving counter — so without this scope the already-seen rows and the saved ones are indistinguishable from the rest, on exactly the two screens the state exists for. The container opens a scope with the ids it just rendered, GET /listings/engagement/ answers once, and each card looks itself up and lays the entry over its own row. No scope, a missing id, a read in flight and a read that FAILED are all the same silent no-op: the card draws from its row and the grid keeps working.",
  component: ListingEngagementScope,
  covers: ["ListingEngagementContext", "ListingsProvider"],
  tokens: ["text-muted"],
  variants: {
    default: {
      viewport: "phone",
      step: "member_overlay_applied",
      description:
        "Wired. The first two rows are already opened and sink back; the second is also saved, so its heart is filled. The two below are untouched and stay at full strength.",
      render: () => <Scoped />,
    },
    unscoped: {
      viewport: "phone",
      step: "member_no_scope",
      description:
        "The same four rows and the same server, with no scope around the grid — nothing dims and every heart is an outline. This is what a search-served feed looks like without the overlay, and it is the defect the scope closes.",
      render: () => <Unscoped />,
    },
    visitor: {
      viewport: "phone",
      step: "anonymous_null_flags",
      description:
        "A visitor. The endpoint is AllowAny, so the same request is made and both per-viewer flags come back null — nothing is remembered for a stranger. Null dims nothing and claims nothing; the hearts are blocked for the usual reason.",
      render: () => <Visitor />,
    },
    failed: {
      viewport: "phone",
      step: "overlay_failed",
      description:
        "The overlay 500s. The grid is untouched: cards draw from their rows, nothing is dimmed on a guess, and no banner is put over a results page the shopper came for.",
      render: () => <Failed />,
    },
  },
});
