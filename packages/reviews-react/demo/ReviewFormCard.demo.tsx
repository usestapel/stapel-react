/** Writing one — and the refusal a naive form gets wrong. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewFormCard } from "../src/default/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_TARGET } from "./fixtures.js";

const created = (status: string) => ({
  id: "new",
  target_type: DEMO_TARGET.targetType,
  target_key: DEMO_TARGET.targetKey,
  author_id: "me",
  rating: 5,
  body: "",
  status,
  created_at: "2026-08-22T10:00:00Z",
  response: null,
});

const ACCEPTS: DemoHandlers = { "POST /reviews": [201, created("published")] };
const PRE_MODERATED: DemoHandlers = { "POST /reviews": [201, created("pending")] };

function Form(props: {
  handlers: DemoHandlers;
  alreadyReviewed?: boolean;
  max?: number;
}): ReactElement {
  return (
    <ReviewsDemoHarness
      handlers={props.handlers}
      {...(props.max !== undefined ? { ratingBounds: { max: props.max } } : {})}
    >
      <ReviewFormCard
        target={DEMO_TARGET}
        signIn={{ href: "/login" }}
        {...(props.alreadyReviewed !== undefined
          ? { alreadyReviewed: props.alreadyReviewed }
          : {})}
      />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.form",
  title: "Write a review",
  description:
    "The submit button is switched off until a rating is chosen, and it says so beside itself rather than in a tooltip a disabled button can never fire. 'Already rated' is not an error banner: it is the same sentence whether the host knew up front (the own-review pre-check over the loaded rows) or the server answered error.400.reviews_duplicate_review — a 400, while the module's only 409 says the owner's REPLY already exists, so a form branching on the number would miss the first and mishandle the second. The star row draws the DEPLOYMENT's bounds: RATING_MIN/RATING_MAX are settings, and a client that hardwired five would refuse a rating a 1..10 deployment accepts.",
  component: ReviewFormCard,
  // REVIEWS_ELEVATION_ACTIONS is this pair's action name for a host's
  // auto-anonymous list — the client half of the server's
  // ALLOW_ANONYMOUS_WRITES. A constant, not a component, and it belongs to
  // the form: writing a review is the act a host would have to name, and by
  // default does not.
  covers: ["ReviewForm", "REVIEWS_ELEVATION_ACTIONS"],
  tokens: ["surface-raised"],
  variants: {
    idle: {
      viewport: "phone",
      step: "idle",
      description: "No rating chosen: submit is off, with the reason under it.",
      render: () => <Form handlers={ACCEPTS} />,
    },
    "already rated": {
      viewport: "phone",
      step: "duplicate",
      description:
        "The form collapses into a note — there is nothing here to fill in.",
      render: () => <Form handlers={ACCEPTS} alreadyReviewed />,
    },
    "a 1..10 deployment": {
      viewport: "desktop",
      step: "idle-wide-bounds",
      description: "Ten stars, because the runtime says the ceiling is ten.",
      render: () => <Form handlers={PRE_MODERATED} max={10} />,
    },
  },
});
