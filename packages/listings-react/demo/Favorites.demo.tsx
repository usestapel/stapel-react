/** Saved for later — four arms, four different things on screen. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FavoritesPane } from "../src/default/index.js";
import { DemoCard, ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE } from "./fixtures.js";

const FULL: DemoHandlers = { "/listings/my/favorites/": DEMO_PAGE };
const EMPTY: DemoHandlers = {
  "/listings/my/favorites/": { items: [], has_next: false, has_prev: false, count: 0 },
};
const BROKEN: DemoHandlers = { "/listings/my/favorites/": [503, {}] };

function Saved(): ReactElement {
  return (
    <ListingsDemoHarness handlers={FULL}>
      <DemoCard heading="FavoritesPane">
        <FavoritesPane hrefFor={(id) => `/l/${String(id)}`} />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function Nothing(): ReactElement {
  return (
    <ListingsDemoHarness handlers={EMPTY}>
      <DemoCard heading="FavoritesPane — nothing saved">
        <FavoritesPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function Broken(): ReactElement {
  return (
    <ListingsDemoHarness handlers={BROKEN}>
      <DemoCard heading="FavoritesPane — we could not ask">
        <FavoritesPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness handlers={FULL} principal="anonymous">
      <DemoCard heading="FavoritesPane — a visitor">
        <FavoritesPane />
      </DemoCard>
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.favorites",
  title: "Favourites",
  description:
    "The plainest place to see the load-state discipline: 'you have not saved anything yet' and 'we could not load your favourites' are two arms, not one. Merging them is the substitution that turned a 5xx into an empty result page on 2026-08-09. A visitor is told to sign in and no request is made at all.",
  component: FavoritesPane,
  covers: ["Favorites"],
  tokens: ["surface-raised"],
  variants: {
    default: { render: () => <Saved /> },
    empty: { render: () => <Nothing /> },
    failed: { render: () => <Broken /> },
    visitor: { render: () => <Visitor /> },
  },
});
