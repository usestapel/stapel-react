/**
 * Create AND edit, in one surface — because it is one screen.
 *
 * The fields are the same and the validation is the same; what differs is the
 * verb on the button and the presence of the cancel arm. Both are drawn here,
 * along with the two 400s this backend documents, answered BEFORE the round
 * trip: an empty title and `end < start` appear as the submit button's blocked
 * reason instead of arriving as a server error after a hopeful click.
 *
 * `end == start` is deliberately NOT blocked — it is a valid zero-duration
 * marker, and the form says so rather than quietly changing it.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { actionBlocked } from "@stapel/core";
import type { ActionAvailability } from "@stapel/core";
import { EventEditorSheet } from "../src/default/index.js";
import { CALENDAR_I18N_KEYS } from "../src/index.js";
import type { CalendarEvent } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";

/** A fixed instant, so the create form opens on the same frame every time. */
const OPENED_AT = "2026-07-13T09:00:00Z";

const EVENT: CalendarEvent = {
  id: "e-standalone",
  title: "Design review",
  description: "Weekly sync on the new booking flow.",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T11:00:00Z",
  owner_id: "u-1",
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "weekly",
  rrule: "FREQ=WEEKLY;BYDAY=MO",
  participants: [{ user_id: "u-2", rsvp: "accepted" }],
};

/** A zero-duration marker: valid, and the reason the form does not "fix" it. */
const MARKER: CalendarEvent = {
  ...EVENT,
  title: "Contract expires",
  description: "",
  end: EVENT.start,
  recurrence_type: "none",
  rrule: "",
};

function Editor(props: {
  readonly event?: CalendarEvent;
  readonly canEdit?: ActionAvailability;
}): ReactElement {
  const { event, canEdit } = props;
  return (
    <CalendarDemoHarness>
      <EventEditorSheet
        open
        onClose={() => undefined}
        defaultStart={OPENED_AT}
        {...(event !== undefined ? { event } : {})}
        {...(canEdit !== undefined ? { canEdit } : {})}
      />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.event-editor",
  title: "New event",
  description:
    "One form for create and edit, on the shared dialog surface (a bottom sheet below the tablet breakpoint, a centred modal above it). The two documented 400s are answered locally and rendered as the submit button's blocked reason; cancelling an event is a different verb from deleting it and lives here, with copy that names what it does.",
  component: EventEditorSheet,
  covers: ["EventComposer", "EventEditor"],
  tokens: ["surface-raised", "brand", "danger"],
  variants: {
    create: {
      description: "A new event on a phone: the form opens with an empty title, so the submit button is off and says why before anybody presses it.",
      viewport: "phone",
      step: "create.blocked_title",
      render: () => <Editor />,
    },
    edit: {
      description: "Editing an existing event: the same fields, the save verb, and the cancel-event arm that create has nothing to offer.",
      viewport: "phone",
      step: "edit",
      render: () => <Editor event={EVENT} />,
    },
    marker: {
      description: "A zero-duration marker (`end == start`). Valid, so it is not blocked — the form states what it means instead of silently adding an hour.",
      viewport: "phone",
      step: "edit.marker",
      render: () => <Editor event={MARKER} />,
    },
    "not-owner": {
      description: "An invitee opened the editor: the fields stay readable, the write is off with the owner-only reason beside it.",
      viewport: "desktop",
      step: "blocked.not_owner",
      render: () => (
        <Editor
          event={EVENT}
          canEdit={actionBlocked(CALENDAR_I18N_KEYS.blockedNotOwner)}
        />
      ),
    },
  },
});
