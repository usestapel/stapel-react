/** The list, in both scopes: what the public reads, and what a moderator asked for. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewList } from "../src/index.js";
import { DemoCard, ReviewsDemoHarness, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE, DEMO_PAGE_ALL, DEMO_TARGET } from "./fixtures.js";

const PUBLISHED: DemoHandlers = { "/reviews": DEMO_PAGE };
const MODERATOR: DemoHandlers = { "/reviews": DEMO_PAGE_ALL };
/** Nobody has reviewed this target — a state a GUEST can now reach. */
const EMPTY: DemoHandlers = {
  "/reviews": {
    items: [],
    next_anchor: null,
    prev_anchor: null,
    has_next: false,
    has_prev: false,
    count: 0,
  },
};

function Rows(props: { handlers: DemoHandlers; include?: "all" }): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <DemoCard heading="ReviewList">
        <ReviewList
          target={DEMO_TARGET}
          {...(props.include !== undefined ? { include: props.include } : {})}
        >
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              {bag.state.status === "ready" &&
                bag.state.data.map((review) => (
                  <StepBadge
                    key={review.id}
                    step={`${review.rating}/5 · ${review.status}${review.response ? " · reply" : ""}`}
                  />
                ))}
              <StepBadge
                step={`more: ${bag.more.available ? "available" : bag.more.block.code}`}
              />
            </>
          )}
        </ReviewList>
      </DemoCard>
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.list",
  title: "Review list",
  description:
    "GET /reviews answers core's AnchorPagination envelope — declared as components/ReviewPage since stapel-reviews 0.3.0, so the pair reads a generated shape instead of the copy it used to maintain. The published scope is what everyone reads, guests included (IsAuthenticatedOrReadOnly since the same release), so an empty list is a reachable state that means what it says. include=all is honoured only for a moderator of the target and narrowed silently for anyone else, which is why every non-published row names its state.",
  component: ReviewList,
  covers: ["ReviewsProvider"],
  tokens: ["surface-raised"],
  variants: {
    published: { render: () => <Rows handlers={PUBLISHED} /> },
    "moderator (include=all)": {
      render: () => <Rows handlers={MODERATOR} include="all" />,
    },
    "empty (reachable by a guest)": { render: () => <Rows handlers={EMPTY} /> },
  },
});
