/** The rating line — and the zero that is not a rating. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { RatingBadge } from "../src/default/index.js";
import type { RatingAggregate } from "../src/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import {
  DEMO_AGGREGATE,
  DEMO_AGGREGATE_ONE,
  DEMO_AGGREGATE_UNRATED,
  DEMO_SELLER_ROLLUP,
  DEMO_TARGET,
} from "./fixtures.js";

const RATED: DemoHandlers = { "/reviews/aggregate": DEMO_AGGREGATE };
const ONE: DemoHandlers = { "/reviews/aggregate": DEMO_AGGREGATE_ONE };
const UNRATED: DemoHandlers = { "/reviews/aggregate": DEMO_AGGREGATE_UNRATED };

function Badge(props: {
  handlers: DemoHandlers;
  aggregate?: RatingAggregate;
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <RatingBadge
        target={DEMO_TARGET}
        {...(props.aggregate !== undefined ? { aggregate: props.aggregate } : {})}
      />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.rating",
  title: "Rating badge",
  description:
    "avg is 0.0 when count is 0 — the module says so in its own schema — so a naive renderer draws the worst possible score over a target nobody has rated. ratingSummary() answers rated:false there and this skin never reaches <Rate> in that arm: no star row at all, one sentence instead. The count is a plural through core's tPlural, so a single review does not read '1 reviews' (and Russian agrees with its own numeral instead of dodging into 'Отзывов: 1'). The last variant is the seller roll-up: stapel-reviews aggregates ONE (target_type, target_key) per call and cannot roll a seller's listings up, so the composite's projection computes {avg, count} — the same two field names, deliberately — and this component renders them without a request.",
  component: RatingBadge,
  covers: ["ReviewAggregate", "ReviewsProvider"],
  tokens: ["surface-raised"],
  variants: {
    rated: {
      viewport: "phone",
      step: "ready",
      description: "12 reviews, 4.25 rounded to one decimal for display.",
      render: () => <Badge handlers={RATED} />,
    },
    "one review": {
      viewport: "phone",
      step: "ready-singular",
      description: "The singular arm of the plural family.",
      render: () => <Badge handlers={ONE} />,
    },
    "never rated": {
      viewport: "phone",
      step: "unrated",
      description: "count 0, avg 0.0 — and no star row is drawn.",
      render: () => <Badge handlers={UNRATED} />,
    },
    "seller roll-up (supplied)": {
      viewport: "desktop",
      step: "supplied",
      description: "Numbers from the composite's projection; no request made.",
      render: () => <Badge handlers={RATED} aggregate={DEMO_SELLER_ROLLUP} />,
    },
  },
});
