/** Writing one — and the two refusals a naive form gets wrong. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewForm } from "../src/index.js";
import { DemoCard, ReviewsDemoHarness, StepBadge } from "./_harness.js";
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
// The trap this pair exists to avoid: the duplicate refusal is a 400, while
// the module's only 409 means the owner's REPLY already exists.
const DUPLICATE: DemoHandlers = {
  "POST /reviews": [400, { localizable_error: "error.400.reviews_duplicate_review" }],
};

function Form(props: { handlers: DemoHandlers }): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <DemoCard heading="ReviewForm">
        <ReviewForm target={DEMO_TARGET}>
          {(bag) => (
            <>
              <StepBadge step={`rating: ${bag.rating ?? "none"}`} />
              <StepBadge
                step={
                  bag.canSubmit.available
                    ? "submit: available"
                    : `submit: ${bag.canSubmit.block.code}`
                }
              />
              <button
                type="button"
                onClick={() => bag.setRating(5)}
                data-analytics="none"
                data-analytics-reason="demo control — it moves local form state and sends nothing"
              >
                <StepBadge step="setRating(5)" />
              </button>
              <button
                type="button"
                onClick={bag.submit}
                data-analytics="none"
                data-analytics-reason="demo control over a mocked fetch — the host tracks the real submit"
              >
                <StepBadge step="submit()" />
              </button>
              {bag.submitted ? (
                <StepBadge step={`sent · ${bag.submittedVisibility ?? "?"}`} />
              ) : null}
              {bag.alreadyReviewed ? <StepBadge step="alreadyReviewed" /> : null}
            </>
          )}
        </ReviewForm>
      </DemoCard>
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.form",
  title: "Write a review",
  description:
    "The duplicate refusal is read by CODE: `error.400.reviews_duplicate_review` arrives with status 400, while the module's only 409 says the owner's reply already exists — a form branching on the number would miss the first and mishandle the second. And a submitted review is not necessarily a visible one: under pre-moderation the created row comes back `pending`, so the author is told it will appear once checked instead of being left to hunt for it.",
  component: ReviewForm,
  tokens: ["surface-raised"],
  variants: {
    "post-moderation (published)": { render: () => <Form handlers={ACCEPTS} /> },
    "pre-moderation (pending)": { render: () => <Form handlers={PRE_MODERATED} /> },
    "already rated (400)": { render: () => <Form handlers={DUPLICATE} /> },
  },
});
