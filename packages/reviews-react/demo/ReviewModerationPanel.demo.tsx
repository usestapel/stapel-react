/** The moderation queue — the capability that had no screen until now. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ReviewModerationPanel } from "../src/default/index.js";
import { ReviewsDemoHarness } from "./_harness.js";
import type { DemoHandlers } from "./_harness.js";
import { DEMO_PAGE_ALL, DEMO_PAGE_EMPTY, DEMO_PAGE_LAST, DEMO_TARGET } from "./fixtures.js";

/** What the server sends a moderator: the two states the public never sees. */
const GRANTED: DemoHandlers = {
  "POST /moderate": [200, { ...DEMO_PAGE_ALL.items[3], status: "published" }],
  "/reviews": DEMO_PAGE_ALL,
};
/** The same request from a non-moderator: narrowed to published, silently. */
const NARROWED: DemoHandlers = { "/reviews": DEMO_PAGE_LAST };
const NOTHING: DemoHandlers = { "/reviews": DEMO_PAGE_EMPTY };

function Queue(props: {
  handlers: DemoHandlers;
  canModerate?: boolean;
}): ReactElement {
  return (
    <ReviewsDemoHarness handlers={props.handlers}>
      <ReviewModerationPanel
        target={DEMO_TARGET}
        {...(props.canModerate !== undefined
          ? { canModerate: props.canModerate }
          : {})}
      />
    </ReviewsDemoHarness>
  );
}

export default defineDemo({
  id: "reviews.moderation",
  title: "Moderation queue",
  description:
    "POST {id}/moderate has existed since stapel-reviews 0.1 and could be reached from no screen in the fleet. This is that screen. Every verdict is state-gated on the row it acts on: re-applying the state a review is already in is an upstream no-op that answers 200, so 'Already hidden' is said before the click instead of a button that appears to do nothing. Hiding is confirmed, because it removes the review from every page AND from the rating — a bottom sheet on a phone, a small modal above it. The second variant is the one to look at: the server narrows include=all for a non-moderator without an error, so a pane that trusted the request would show a short list as if it were the whole queue.",
  component: ReviewModerationPanel,
  covers: ["ReviewModeration"],
  tokens: ["surface-raised"],
  variants: {
    "granted, six rows": {
      viewport: "phone",
      step: "ready",
      description:
        "Published, pending, hidden and a state this build does not know — each badged, each with both verdicts gated on where it stands.",
      render: () => <Queue handlers={GRANTED} canModerate />,
    },
    "not a moderator": {
      viewport: "phone",
      step: "blocked",
      description:
        "The request was narrowed and every verdict is off, each carrying its own sentence — never an empty pane.",
      render: () => <Queue handlers={NARROWED} canModerate={false} />,
    },
    "nothing written yet": {
      viewport: "desktop",
      step: "empty",
      description: "A designed empty state, reachable only from a load that succeeded.",
      render: () => <Queue handlers={NOTHING} canModerate />,
    },
  },
});
