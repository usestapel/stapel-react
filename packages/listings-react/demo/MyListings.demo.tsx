/** The seller's dashboard: real counts, real rows, and the takedown that is in no tab. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { MyListingsPane } from "../src/default/index.js";
import { ListingsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_COUNTERS,
  DEMO_MY_ARCHIVED,
  DEMO_MY_BLOCKED,
  DEMO_MY_NONE_BLOCKED,
  DEMO_MY_PAGE,
} from "./fixtures.js";

/**
 * One PATH, two questions. `GET my/listings/?status=published,pending` is the
 * active tab; `?status=blocked` is the takedown check the pane runs beside it.
 * The handler reads the query rather than answering both with the same body,
 * because a demo that showed a live listing as taken down would be teaching
 * the wrong screen.
 */
function handlers(blocked: unknown): DemoHandlers {
  return {
    "/listings/my/counters/": DEMO_COUNTERS,
    "/listings/my/listings/": (url: string) =>
      url.includes("status=blocked") ? blocked : DEMO_MY_PAGE,
  };
}

/**
 * The archived tab, off the same path: `?status=archived,paused,expired,sold`
 * is the tab's set, `?status=blocked` is the takedown check.
 */
const ARCHIVED: DemoHandlers = {
  "/listings/my/counters/": DEMO_COUNTERS,
  "/listings/my/listings/": (url: string) =>
    url.includes("status=blocked") ? DEMO_MY_NONE_BLOCKED : DEMO_MY_ARCHIVED,
};

const BROKEN: DemoHandlers = {
  "/listings/my/counters/": DEMO_COUNTERS,
  "/listings/my/listings/": [503, {}],
};

/** How a container that HAS a composer mounts it. */
function Dashboard(): ReactElement {
  return (
    <ListingsDemoHarness handlers={handlers(DEMO_MY_NONE_BLOCKED)}>
      <MyListingsPane onEdit={() => undefined} />
    </ListingsDemoHarness>
  );
}

/** How the scripted scaffold mounts it today: no `onEdit`. The Edit button is
 * switched off WITH the reason instead of being enabled and inert. */
function NoEditor(): ReactElement {
  return (
    <ListingsDemoHarness handlers={handlers(DEMO_MY_NONE_BLOCKED)}>
      <MyListingsPane />
    </ListingsDemoHarness>
  );
}

function WithTakedown(): ReactElement {
  return (
    <ListingsDemoHarness handlers={handlers(DEMO_MY_BLOCKED)}>
      <MyListingsPane onEdit={() => undefined} />
    </ListingsDemoHarness>
  );
}

function Visitor(): ReactElement {
  return (
    <ListingsDemoHarness
      handlers={handlers(DEMO_MY_NONE_BLOCKED)}
      principal="anonymous"
    >
      <MyListingsPane signIn={{ href: "/login" }} />
    </ListingsDemoHarness>
  );
}

/** Where deleting becomes possible at all — see the `archived` variant. */
function Archived(): ReactElement {
  return (
    <ListingsDemoHarness handlers={ARCHIVED}>
      <MyListingsPane initialTab="archived" onEdit={() => undefined} />
    </ListingsDemoHarness>
  );
}

function Broken(): ReactElement {
  return (
    <ListingsDemoHarness handlers={BROKEN}>
      <MyListingsPane onEdit={() => undefined} />
    </ListingsDemoHarness>
  );
}

export default defineDemo({
  id: "listings.mine",
  title: "My listings",
  description:
    "stapel-listings 0.7.0 gave the owner's own listings a route (GET my/listings/, every status, ?status= for a tab's set), so the rows here are the contract's own. Four things the pane refuses to smooth over: both axes on every row (a LIVE listing whose edit is under review says so — status alone cannot); a moderation takedown, which my/counters counts in no tab at all, sits ABOVE the tabs; every switched-off action prints its reason beside itself instead of hiding it in a hover a phone cannot open; and Delete asks first, through a bottom sheet — and is drawn only on the rows that HAVE a delete route, never as a switched-off button on a listing that is on sale. The row is a thumbnail plus a min-width:0 column, so four actions wrap at 390px instead of clipping.",
  component: MyListingsPane,
  covers: ["MyListings"],
  tokens: ["surface-raised"],
  variants: {
    default: {
      viewport: "phone",
      step: "active_tab_with_editor",
      description: "A container that has a composer to open.",
      render: () => <Dashboard />,
    },
    "no-editor": {
      viewport: "phone",
      step: "active_tab_edit_blocked",
      description:
        "The scaffold's wiring: Edit is off and says why, instead of being a click that does nothing.",
      render: () => <NoEditor />,
    },
    "taken-down": {
      viewport: "phone",
      step: "takedown_above_tabs",
      description: "One listing removed by moderation, in no tab and impossible to miss.",
      render: () => <WithTakedown />,
    },
    visitor: {
      viewport: "phone",
      step: "no_mandate",
      description: "No mandate: one designed state carrying its own way in.",
      render: () => <Visitor />,
    },
    archived: {
      viewport: "phone",
      step: "archived_tab_deletable",
      description:
        "The archived tab, and the one row with a Delete control. A listing that is ON SALE has no delete route behind it, so the pane offers Archive and draws no delete button at all — rather than a live-looking one carrying aria-disabled, which is what the desktop walk pressed twenty-six times for no dialog and no effect (D425).",
      render: () => <Archived />,
    },
    failed: {
      viewport: "desktop",
      step: "rows_failed",
      description:
        "The rows could not be fetched — which is not the same as having none.",
      render: () => <Broken />,
    },
  },
});
