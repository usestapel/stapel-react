/** The list, in both scopes: what the public reads, and what a moderator asked for. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewList } from "../src/index.js";
import { DemoCard, ReviewsDemoHarness, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE, DEMO_PAGE_ALL, DEMO_TARGET } from "./fixtures.js";

const PUBLISHED: DemoHandlers = { "/reviews": DEMO_PAGE };
const MODERATOR: DemoHandlers = { "/reviews": DEMO_PAGE_ALL };
const SIGNED_OUT: DemoHandlers = {
  "/reviews": [401, { localizable_error: "stapel.http.401" }],
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
              {bag.signInRequired ? <StepBadge step="signInRequired" /> : null}
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
    "GET /reviews answers core's AnchorPagination envelope, which the schema declares as a bare array — the pair types the shape that actually arrives. The published scope is what everyone reads; include=all is honoured only for a moderator of the target and narrowed silently for anyone else, so every non-published row names its state. A 401 is its own state: every endpoint of this module is IsAuthenticated, and rendering the empty list there would tell a signed-out visitor the seller has never been reviewed.",
  component: ReviewList,
  covers: ["ReviewsProvider"],
  tokens: ["surface-raised"],
  variants: {
    published: { render: () => <Rows handlers={PUBLISHED} /> },
    "moderator (include=all)": {
      render: () => <Rows handlers={MODERATOR} include="all" />,
    },
    "signed out (401)": { render: () => <Rows handlers={SIGNED_OUT} /> },
  },
});
