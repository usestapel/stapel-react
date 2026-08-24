/** The whole block a listing detail page drops in. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewsPanel } from "../src/default/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_AGGREGATE,
  DEMO_AGGREGATE_UNRATED,
  DEMO_PAGE_ALL,
  DEMO_PAGE_EMPTY,
  DEMO_PAGE_LAST,
  DEMO_TARGET,
} from "./fixtures.js";

const BUYER: DemoHandlers = {
  "/reviews/aggregate": DEMO_AGGREGATE,
  "/reviews": DEMO_PAGE_LAST,
};
const MODERATOR: DemoHandlers = {
  "/reviews/aggregate": DEMO_AGGREGATE,
  "/reviews": DEMO_PAGE_ALL,
};
const UNRATED: DemoHandlers = {
  "/reviews/aggregate": DEMO_AGGREGATE_UNRATED,
  "/reviews": DEMO_PAGE_EMPTY,
};

function Panel(props: {
  handlers: DemoHandlers;
  viewerId?: string;
  canModerate?: boolean;
  canRespond?: boolean;
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <ReviewsPanel
        target={DEMO_TARGET}
        signIn={{ href: "/login" }}
        {...(props.viewerId !== undefined ? { viewerId: props.viewerId } : {})}
        {...(props.canModerate !== undefined
          ? { canModerate: props.canModerate }
          : {})}
        {...(props.canRespond !== undefined
          ? { canRespond: props.canRespond }
          : {})}
      />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.panel",
  title: "Reviews block",
  description:
    "The composed block: the rating line, the list, the form for a reader who has not rated yet, and — for whoever the host says moderates the item — the queue below it. Two of those are worth watching. First, a target nobody has rated shows 'No rating yet' above 'No reviews yet': two different absences, two different sentences, because the storefront once printed the identical words twice forty pixels apart and it read as a rendering bug. Second, the moderator variant is TWO panes on purpose: 'what does the public see' and 'what is there' are different questions against different cache keys, and folding them into one switch would make the public view unreachable for the one person who most needs to check it.",
  component: ReviewsPanel,
  covers: ["ReviewsProvider", "ReviewList"],
  tokens: ["surface-base"],
  variants: {
    "a buyer": {
      viewport: "phone",
      step: "ready",
      description: "Rating, reviews, and the form — the storefront case.",
      render: () => <Panel handlers={BUYER} />,
    },
    "nothing rated yet": {
      viewport: "phone",
      step: "empty",
      description:
        "Two absences, two sentences: no rating, and no reviews.",
      render: () => <Panel handlers={UNRATED} />,
    },
    "the seller, moderating": {
      viewport: "desktop",
      step: "moderating",
      description:
        "The public list AND the queue, plus the reply composer under every unanswered review.",
      render: () => (
        <Panel handlers={MODERATOR} canModerate canRespond viewerId="user-1" />
      ),
    },
  },
});
