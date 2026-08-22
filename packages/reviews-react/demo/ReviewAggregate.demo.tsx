/** The rating, and the zero that is not a rating. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewAggregate } from "../src/index.js";
import type { RatingAggregate } from "../src/index.js";
import { DemoCard, ReviewsDemoHarness, StepBadge } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_AGGREGATE,
  DEMO_AGGREGATE_UNRATED,
  DEMO_SELLER_ROLLUP,
  DEMO_TARGET,
} from "./fixtures.js";

const RATED: DemoHandlers = { "/reviews/aggregate": DEMO_AGGREGATE };
const UNRATED: DemoHandlers = { "/reviews/aggregate": DEMO_AGGREGATE_UNRATED };

function Badge(props: {
  handlers: DemoHandlers;
  aggregate?: RatingAggregate;
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <DemoCard heading="ReviewAggregate">
        <ReviewAggregate
          target={DEMO_TARGET}
          {...(props.aggregate !== undefined ? { aggregate: props.aggregate } : {})}
        >
          {(bag) => (
            <>
              <StepBadge step={bag.state.status} />
              <StepBadge step={`source: ${bag.source}`} />
              {bag.state.status === "ready" ? (
                <StepBadge
                  step={
                    bag.state.data.rated
                      ? `${bag.state.data.rounded}/${bag.max} over ${bag.state.data.count}`
                      : "not rated — no star row is drawn"
                  }
                />
              ) : null}
            </>
          )}
        </ReviewAggregate>
      </DemoCard>
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.aggregate",
  title: "Rating aggregate",
  description:
    "avg is 0.0 when count is 0 — the module says so in its own schema — so a naive renderer draws the worst possible score over a target nobody has rated. ratingSummary() answers rated:false there and the skin has nothing to draw a star row from. The third variant is the seller roll-up: stapel-reviews aggregates ONE (target_type, target_key) per call and cannot roll a seller's listings up, so the composite's projection computes {avg, count} — the same two field names, deliberately — and this component renders them without a request.",
  component: ReviewAggregate,
  tokens: ["surface-raised"],
  variants: {
    rated: { render: () => <Badge handlers={RATED} /> },
    "never rated": { render: () => <Badge handlers={UNRATED} /> },
    "seller roll-up (supplied)": {
      render: () => <Badge handlers={RATED} aggregate={DEMO_SELLER_ROLLUP} />,
    },
  },
});
