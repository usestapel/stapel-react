/** Saved for later — four arms, four different things on screen. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { FavoritesPane } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE, DEMO_PAGE_WITH_NEXT } from "./fixtures.js";

const FULL: DemoHandlers = { "/listings/my/favorites/": DEMO_PAGE };
const PAGED: DemoHandlers = { "/listings/my/favorites/": DEMO_PAGE_WITH_NEXT };
const EMPTY: DemoHandlers = {
  "/listings/my/favorites/": { items: [], has_next: false, has_prev: false, count: 0 },
};
const BROKEN: DemoHandlers = { "/listings/my/favorites/": [503, {}] };

function Saved(): ReactElement {
  return (
    <ListingsDemoHarness handlers={FULL}>
      <FavoritesPane hrefFor={(id) => `/l/${String(id)}`} />
    </ListingsDemoHarness>
  );
}

function Paged(): ReactElement {
  return (
    <ListingsDemoHarness handlers={PAGED}>
      <FavoritesPane hrefFor={(id) => `/l/${String(id)}`} />
    </ListingsDemoHarness>
  );
}

function Nothing(): ReactElement {
  return (
    <ListingsDemoHarness handlers={EMPTY}>
      <FavoritesPane />
    </ListingsDemoHarness>
  );
}

function Broken(): ReactElement {
  return (
    <ListingsDemoHarness handlers={BROKEN}>
      <FavoritesPane />
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness handlers={FULL} principal="anonymous">
      <FavoritesPane signIn={{ href: "/login?next=/account/favorites" }} />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.favorites",
  title: "Favourites",
  description:
    "The plainest place to see the load-state discipline: 'you have not saved anything yet' and 'we could not load your favourites' are two arms, not one. Merging them is the substitution that turned a 5xx into an empty result page on 2026-08-09. A visitor makes no request at all and is shown ONE state — the reason plus the door — where the pane used to render a blocked notice with a spinner turning underneath it. The pager renders only when there is a page to go to.",
  component: FavoritesPane,
  covers: ["Favorites"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "ready_single_page",
      description: "Two saved listings, no pager — there is nowhere to page to.",
      render: () => <Saved />,
    },
    paged: {
      viewport: "phone",
      step: "ready_has_next",
      description: "A second page exists, so the pager appears.",
      render: () => <Paged />,
    },
    empty: {
      viewport: "phone",
      step: "empty",
      description: "Nothing saved yet, and the hint that says how to change that.",
      render: () => <Nothing />,
    },
    failed: {
      viewport: "phone",
      step: "failed",
      description: "We could not ask — a retry, never an empty grid.",
      render: () => <Broken />,
    },
    visitor: {
      viewport: "desktop",
      step: "no_mandate",
      description: "One state, with the sign-in door inside it.",
      render: () => <Visitor />,
    },
  },
});
