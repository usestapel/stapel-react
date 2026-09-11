/** The public review list: what a reader sees, and what it refuses to imply. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewListPanel } from "../src/default/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_OUTAGE,
  DEMO_OWNER,
  DEMO_PAGE,
  DEMO_PAGE_BY_OWNER,
  DEMO_PAGE_EMPTY,
  DEMO_PAGE_LAST,
  DEMO_TARGET,
} from "./fixtures.js";

const PUBLISHED: DemoHandlers = { "/reviews": DEMO_PAGE };
const LAST_PAGE: DemoHandlers = { "/reviews": DEMO_PAGE_LAST };
const EMPTY: DemoHandlers = { "/reviews": DEMO_PAGE_EMPTY };
const FAILED: DemoHandlers = { "/reviews": DEMO_OUTAGE };
const BY_OWNER: DemoHandlers = { "/reviews": DEMO_PAGE_BY_OWNER };

function Panel(props: {
  handlers: DemoHandlers;
  include?: "all";
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <ReviewListPanel
        target={DEMO_TARGET}
        {...(props.include !== undefined ? { include: props.include } : {})}
      />
    </ReviewsDemoHarness>
  );
}

/** The same panel, addressed by OWNER — `target` is not passed and cannot be. */
function OwnerPanel(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <ReviewListPanel owner={DEMO_OWNER} />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.list",
  title: "Review list",
  description:
    "GET /reviews answers core's AnchorPagination envelope, declared as components/ReviewPage since stapel-reviews 0.3.0. One endpoint, two addressings since 0.7.0 — the target pair, or an owner key for a seller page's whole tab — and the panel takes exactly one of them, because naming both is error.400.reviews_ambiguous_addressing and a refusal a host can provoke by writing one prop is a refusal the types should forbid. Guests read it (IsAuthenticatedOrReadOnly), so an EMPTY list is a reachable state that means what it says — which is why it is a designed empty state and not a spinner that never stops. The 'narrowed scope' variant is the one worth reading twice: include=all is honoured only for a moderator of the target and silently narrowed to published for everyone else, with no error and no marker in the body, so a host that passed the prop to the wrong viewer used to get a quietly incomplete list. The pane now says so.",
  component: ReviewListPanel,
  covers: ["ReviewList", "ReviewOwnerList", "ReviewResponseComposer"],
  tokens: ["surface-raised"],
  variants: {
    published: {
      viewport: "phone",
      step: "ready",
      description:
        "Three rows, one carrying the seller's reply, one with a rating and no words.",
      render: () => <Panel handlers={PUBLISHED} />,
    },
    "end of the run": {
      viewport: "phone",
      step: "ready-exhausted",
      description:
        "has_next false: the load-more control is off, and it says which of the two reasons it is off for.",
      render: () => <Panel handlers={LAST_PAGE} />,
    },
    "narrowed scope": {
      viewport: "phone",
      step: "narrowed",
      description:
        "include=all was asked for and nothing that arrived proves it was granted.",
      render: () => <Panel handlers={LAST_PAGE} include="all" />,
    },
    empty: {
      viewport: "desktop",
      step: "empty",
      description: "Nobody has reviewed this — a state a guest can reach.",
      render: () => <Panel handlers={EMPTY} />,
    },
    failed: {
      viewport: "desktop",
      step: "failed",
      description: "A 503 is not an empty list, and never renders as one.",
      render: () => <Panel handlers={FAILED} />,
    },
    "a seller's reviews": {
      viewport: "phone",
      step: "owner",
      description:
        "Addressed by OWNER (stapel-reviews 0.7.0): one request for every review of everything this seller owns, instead of one list per listing. The rows are about THREE different targets — which is the reason the reply composer under a row is addressed from the row and not from the pane.",
      render: () => <OwnerPanel handlers={BY_OWNER} />,
    },
    "a seller nobody has reviewed": {
      viewport: "phone",
      step: "owner-empty",
      description:
        "The owner arm's own empty state. It is not the target arm's sentence reworded: 'be the first to say how it went' is an invitation, and nobody reviews an owner — they review one of the owner's items, which this pane does not name. So it says what is on screen and offers no door. Indistinguishable on the wire from a deployment that registers no owner_key_for resolver, which is why it does not claim to know why.",
      render: () => <OwnerPanel handlers={EMPTY} />,
    },
  },
});
