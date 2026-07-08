/** Event RSVP — headless respond-to-invitation mutation. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { EventRsvp } from "../src/index.js";
import {
  CalendarDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
} from "./_harness.js";

const EVENT_ID = "550e8400-e29b-41d4-a716-446655440000";

/** The event echoed back after a successful RSVP (participant now accepted). */
const RESPONDED_EVENT = {
  id: EVENT_ID,
  title: "Design review",
  description: "",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T10:30:00Z",
  owner_id: "u-2",
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  participants: [{ user_id: "u-1", rsvp: "accepted" }],
};

function RsvpBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="EventRsvp">
      <EventRsvp eventId={EVENT_ID}>
        {({ respond, isResponding, event }) => (
          <>
            <span style={{ color: cssVar("color-text-secondary") }}>
              {isResponding
                ? t("calendar.rsvp.responding")
                : (event?.participants?.[0]?.rsvp ?? "")}
            </span>
            <DemoActions>
              <DemoButton
                run={() => respond("accepted")}
                labelKey="calendar.rsvp.accept"
              />
              <DemoButton
                run={() => respond("tentative")}
                labelKey="calendar.rsvp.tentative"
              />
              <DemoButton
                run={() => respond("declined")}
                labelKey="calendar.rsvp.decline"
              />
            </DemoActions>
          </>
        )}
      </EventRsvp>
    </DemoCard>
  );
}

function EventRsvpDemo(): ReactElement {
  return (
    <CalendarDemoHarness handlers={{ "/respond": RESPONDED_EVENT }}>
      <RsvpBody />
    </CalendarDemoHarness>
  );
}

/**
 * Demonstrates the headless RSVP control: the canned handler echoes the event
 * with the current user's participant set to the chosen state, so clicking
 * Accept/Maybe/Decline resolves to the updated RSVP. Bring your own control
 * group — the component is renderless.
 */
export default defineDemo({
  id: "calendar.rsvp",
  title: "Event RSVP",
  description:
    "The headless EventRsvp wraps the respond mutation for one event (accepted/tentative/declined). Bring your own control UI — the component is renderless.",
  component: EventRsvp,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <EventRsvpDemo /> },
  },
});
