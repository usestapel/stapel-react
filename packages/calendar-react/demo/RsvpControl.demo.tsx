/**
 * The three answers an invitation asks for — and the three reasons a person
 * may not give one.
 *
 * The visual pass found this row as three identical solid primaries, with the
 * brand fill on "Decline". Three equal primaries is a choice refused, not a
 * choice offered, so Accept is the only primary here and the answer already on
 * record is MARKED (`aria-pressed`) rather than restyled into a fourth
 * appearance. `invited` is a server-set state and is never a button.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { actionAvailable, actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { RsvpControl } from "../src/default/index.js";
import { CALENDAR_I18N_KEYS } from "../src/index.js";
import type { ParticipantRsvp } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";

const EVENT_ID = "e-standalone";

function Control(props: {
  readonly current?: ParticipantRsvp;
  readonly gate?: ActionAvailability;
}): ReactElement {
  const { current, gate } = props;
  return (
    <CalendarDemoHarness>
      <RsvpControl
        eventId={EVENT_ID}
        {...(current !== undefined ? { current } : {})}
        gate={gate ?? actionAvailable()}
      />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.rsvp-control",
  title: "Your answer",
  description:
    "Accept / Maybe / Decline with ONE primary, the answer on record marked rather than recoloured, and every refusal stated beside the buttons instead of hidden behind a disabled control. `invited` is the server's initial state and is deliberately absent from the row — a control offering a meaningless option is the same defect as one offering none.",
  component: RsvpControl,
  covers: ["EventRsvp"],
  tokens: ["brand", "text-muted"],
  variants: {
    "no-answer": {
      description: "Invited and yet to answer: the row says so in words above the buttons.",
      viewport: "phone",
      step: "ready.no_answer",
      render: () => <Control />,
    },
    accepted: {
      description: "An answer is on record — Accept is pressed, and the sentence above names it.",
      viewport: "phone",
      step: "ready.accepted",
      render: () => <Control current="accepted" />,
    },
    "not-invited": {
      description: "A viewer who is not on the invitee list: the buttons are off WITH the reason under them, never a tooltip a disabled control could not show anyway.",
      viewport: "phone",
      step: "blocked.not_invited",
      render: () => (
        <Control gate={actionBlocked(CALENDAR_I18N_KEYS.blockedNotInvited)} />
      ),
    },
    "event-cancelled": {
      description: "The event was cancelled: answering it would mean nothing, and the reason says which of the three refusals this is.",
      viewport: "desktop",
      step: "blocked.event_cancelled",
      render: () => (
        <Control
          current="tentative"
          gate={actionBlocked(CALENDAR_I18N_KEYS.blockedEventCancelled)}
        />
      ),
    },
  },
});
