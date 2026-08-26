/**
 * Delete, asked first — and told apart from cancel.
 *
 * Two destructive verbs live on an event screen: **cancel** leaves the event on
 * everyone's calendar, marked; **delete** takes it away, and on one time in a
 * repeating series the backend tombstones instead of hard-deleting so the
 * virtual instant cannot resurrect. If both were the same red button with
 * different words the difference would exist only in the backend, so the
 * confirmation is the frame worth photographing — twice, once per consequence.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { DeleteEventAction } from "../src/default/index.js";
import { CALENDAR_I18N_KEYS } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";

const EVENT_ID = "e-standalone";

function Action(props: {
  readonly gate?: ActionAvailability;
  readonly open?: boolean;
  readonly isOccurrence?: boolean;
}): ReactElement {
  const { gate, open, isOccurrence } = props;
  return (
    <CalendarDemoHarness>
      <DeleteEventAction
        eventId={EVENT_ID}
        gate={gate ?? actionAvailable()}
        {...(open !== undefined ? { open } : {})}
        {...(isOccurrence !== undefined ? { isOccurrence } : {})}
        onOpenChange={() => undefined}
      />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.delete-event",
  title: "Delete event",
  description:
    "The destructive verb, confirmed on a bottom sheet on a phone (never a popover under somebody's thumb) with a confirm button that NAMES the action instead of saying OK. Deleting one time in a series is a different consequence from deleting a standalone event, so it is a different sentence.",
  component: DeleteEventAction,
  covers: ["EventDelete"],
  tokens: ["danger", "surface-raised"],
  variants: {
    offered: {
      description: "The owner's control, closed: one danger button, and nothing destroyed until it is answered.",
      viewport: "phone",
      step: "idle",
      render: () => <Action />,
    },
    confirming: {
      description: "The confirmation as a bottom sheet: what deleting this event does, in words, with the action named on the button.",
      viewport: "phone",
      step: "asking",
      render: () => <Action open />,
    },
    "confirming-occurrence": {
      description: "The same question about ONE time in a series — a different consequence, so a different sentence, because the backend tombstones rather than hard-deletes here.",
      viewport: "phone",
      step: "asking.occurrence",
      render: () => <Action open isOccurrence />,
    },
    "not-owner": {
      description: "An invitee: the control is off WITH the reason beside it, rather than hidden (which teaches nothing) or lit and then refused (which is worse).",
      viewport: "desktop",
      step: "blocked.not_owner",
      render: () => (
        <Action gate={actionBlocked(CALENDAR_I18N_KEYS.blockedNotOwner)} />
      ),
    },
  },
});
