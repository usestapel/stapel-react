/**
 * The triage board — the screen somebody opens when something is wrong, and
 * the one they must be able to trust when nothing is.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { IssueFilterBar, IssuesFeed } from "../src/default/index.js";
import type { IssueFeedFilters } from "../src/index.js";
import { AlertsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { BUSY_PAGE, EMPTY_PAGE, STAFF_ONLY } from "./_fixtures.js";

const BUSY: DemoHandlers = { "/issues": BUSY_PAGE };
const QUIET: DemoHandlers = { "/issues": EMPTY_PAGE };
const REFUSED: DemoHandlers = { "/issues": STAFF_ONLY };

function Feed(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <AlertsDemoHarness handlers={props.handlers}>
      <IssuesFeed issueHref={(id) => `#/admin/alerts/${id}`} />
    </AlertsDemoHarness>
  );
}

/** The bar on its own — what a host mounting its own board gets. */
function Bar(): ReactElement {
  const [filters, setFilters] = useState<IssueFeedFilters>({ open: true });
  return (
    <AlertsDemoHarness handlers={BUSY}>
      <IssueFilterBar
        value={filters}
        onChange={setFilters}
        services={["svc-api", "svc-billing", "svc-worker"]}
      />
    </AlertsDemoHarness>
  );
}

export default defineDemo({
  id: "alerts.feed",
  title: "Triage feed",
  description:
    "Grouped by the service that reported, worst level first and then loudest — never the wire's newest-first order, which answers 'what moved' and not 'what is broken'. Each row carries its level, its status, how many times it has happened and when it was first and last seen, because the gap between those two is what separates a flare from something that has been failing quietly for a month. The empty state is two different sentences depending on whether a filter is set: 'nothing has failed' and 'nothing matches these filters' are the one pair of messages an error tracker must never confuse. The 403 is named rather than drawn as an empty table.",
  component: IssuesFeed,
  covers: ["IssueFilterBar"],
  tokens: ["error", "warning", "success", "text-muted"],
  variants: {
    default: {
      description:
        "Two services, five rows, every status represented — billing is on top because it has the fatal.",
      viewport: "desktop",
      step: "busy",
      render: () => <Feed handlers={BUSY} />,
    },
    phone: {
      description:
        "390px: each row becomes a card with its level and status as badges, and the way in underneath.",
      viewport: "phone",
      step: "cards",
      render: () => <Feed handlers={BUSY} />,
    },
    quiet: {
      description:
        "Nothing has failed. Said out loud — the tracker is reachable and has nothing to show, which is not the same as a tracker that could not be read.",
      viewport: "desktop",
      step: "quiet",
      render: () => <Feed handlers={QUIET} />,
    },
    refused: {
      description:
        "Signed in with an account that is not staff. The door stayed visible and the screen explains itself; an empty board here would have said 'nothing is broken'.",
      viewport: "desktop",
      step: "refused",
      render: () => <Feed handlers={REFUSED} />,
    },
    filters: {
      description:
        "The bar alone. Every control clears, and 'Clear filters' appears the moment anything is set.",
      viewport: "desktop",
      step: "filters",
      render: () => <Bar />,
    },
  },
});
