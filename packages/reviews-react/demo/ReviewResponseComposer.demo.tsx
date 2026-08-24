/** The seller's one reply: shown, written, and refused — in one component. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewResponseComposer } from "../src/default/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_ANSWERED, DEMO_TARGET, DEMO_UNANSWERED } from "./fixtures.js";

const ACCEPTS: DemoHandlers = {
  "POST /response": [
    201,
    {
      ...DEMO_UNANSWERED,
      response: {
        author_id: "seller-1",
        body: "Fair point — photos are updated now.",
        created_at: "2026-08-23T09:00:00Z",
      },
    },
  ],
};

function Composer(props: {
  review: typeof DEMO_UNANSWERED;
  canRespond?: boolean;
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={ACCEPTS}>
      <ReviewResponseComposer
        target={DEMO_TARGET}
        review={props.review}
        surface="raised"
        signIn={{ href: "/login" }}
        {...(props.canRespond !== undefined
          ? { canRespond: props.canRespond }
          : {})}
      />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.response",
  title: "Seller's reply",
  description:
    "POST {id}/response was displayed by this pair from the first release and could never be written by it. The composer and the reply are deliberately the SAME component, because on the page they are one thing: no reply and you may write it → the box, with the one-shot rule stated beside it; no reply and you may not → the reason beside a switched-off control; a reply exists → the reply, and no box at all. The one-shot line matters: the module stores at most one Response per review and ships no endpoint to edit or delete it, so a composer that discovered that afterwards would be a text box that silently turns out to have been the last word. The empty-body block is the pair's own rule, not the contract's — RespondRequest.body defaults to \"\", so the server would store a blank reply and then refuse forever to replace it.",
  component: ReviewResponseComposer,
  covers: ["ReviewResponseForm"],
  tokens: ["surface-raised"],
  variants: {
    "the owner, nothing written yet": {
      viewport: "phone",
      step: "empty",
      description:
        "Reply is off until there are words in the box, and says so; the one-shot rule is stated before it is spent.",
      render: () => <Composer review={DEMO_UNANSWERED} canRespond />,
    },
    "already answered": {
      viewport: "phone",
      step: "answered",
      description: "The reply, read-only forever — there is no edit endpoint.",
      render: () => <Composer review={DEMO_ANSWERED} canRespond />,
    },
    "not the owner": {
      viewport: "desktop",
      step: "blocked",
      description:
        "The control is rendered switched off with its reason, not removed — a seller whose ownership callback is mis-wired sees a bug report instead of a blank row.",
      render: () => <Composer review={DEMO_UNANSWERED} canRespond={false} />,
    },
  },
});
