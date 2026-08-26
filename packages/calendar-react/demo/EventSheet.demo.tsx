/**
 * One event, everything about it, and only the actions this viewer can take.
 *
 * The sheet's whole subject is the AXIS between an owner and an invitee, and
 * the three different refusals that can arrive on the same request:
 *
 *   403 forbidden — a workspace you are not in ("we asked; the answer is no")
 *   503 mandate   — we could not ASK; a wait with a retry, never a denial
 *   403 not-owner — the narrower owner-only refusal, shown beside the control
 *                   it blocks rather than as a page-level error
 *
 * None of those is reachable from a click in a catalogue, so every variant
 * SEEDS the detail read — with a body, or with the exact refusal — and the
 * shot is the proof that the three sentences differ.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { EventSheet } from "../src/default/index.js";
import { calendarQueryKeys } from "../src/index.js";
import type { CalendarEvent } from "../src/index.js";
import { CalendarDemoHarness, DEMO_BASE, demoApiError } from "./_harness.js";
import type { DemoSeed } from "./_harness.js";

const EVENT_ID = "e-standalone";
const OWNER = "u-1";
const INVITEE = "u-2";

const EVENT: CalendarEvent = {
  id: EVENT_ID,
  title: "Design review",
  description: "Weekly sync on the new booking flow.",
  start: "2026-07-13T10:00:00Z",
  end: "2026-07-13T11:00:00Z",
  owner_id: OWNER,
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  participants: [
    { user_id: INVITEE, rsvp: "accepted" },
    { user_id: "u-3", rsvp: "invited" },
  ],
};

/** One time in a series, already cancelled — the tombstone arm. */
const CANCELLED_OCCURRENCE: CalendarEvent = {
  ...EVENT,
  title: "Stand-up",
  description: "",
  status: "cancelled",
  recurrence_type: "weekly",
  rrule: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR",
  recurrence_parent_id: "series-1",
};

const ready = (event: CalendarEvent): DemoSeed => [
  { key: calendarQueryKeys.event(event.id), data: event },
];

const refused = (status: number, code: string, message: string): DemoSeed => [
  {
    key: calendarQueryKeys.event(EVENT_ID),
    error: demoApiError(status, code, message),
  },
];

function Sheet(props: {
  readonly seed: DemoSeed;
  readonly viewerId?: string;
}): ReactElement {
  const { viewerId } = props;
  return (
    <CalendarDemoHarness seed={props.seed}>
      <EventSheet
        eventId={EVENT_ID}
        open
        onClose={() => undefined}
        baseUrl={DEMO_BASE}
        {...(viewerId !== undefined ? { viewerId } : {})}
      />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.event-sheet",
  title: "Event",
  description:
    "The detail sheet: a bottom sheet on a phone, a centred modal above the tablet breakpoint, with owner-only controls switched off WITH their reason instead of hidden. `viewerId` is the host's to supply — when it is absent the sheet says it cannot tell whose event this is rather than guessing either way.",
  component: EventSheet,
  covers: ["EventDetail"],
  tokens: ["surface-raised", "warning-bg", "danger"],
  variants: {
    owner: {
      description: "The owner's view: edit, add-to-calendar and delete are live, and the invitee list is the replace-set editor.",
      viewport: "phone",
      step: "ready.owner",
      render: () => <Sheet seed={ready(EVENT)} viewerId={OWNER} />,
    },
    invitee: {
      description: "An invitee's view: RSVP is the live control, the owner-only buttons are off with the sentence beside them, and the invitee list is a read-only roll-up.",
      viewport: "phone",
      step: "ready.invitee",
      render: () => <Sheet seed={ready(EVENT)} viewerId={INVITEE} />,
    },
    "viewer-unknown": {
      description: "No `viewerId` from the host: every identity-dependent control reports that it cannot tell, which is not the same answer as 'no'.",
      viewport: "phone",
      step: "ready.viewer_unknown",
      render: () => <Sheet seed={ready(EVENT)} />,
    },
    cancelled: {
      description: "A cancelled time in a series: the banner is above the facts, answering is blocked with its own reason, and the series note says the row belongs to a rule.",
      viewport: "phone",
      step: "ready.cancelled",
      render: () => (
        <Sheet seed={ready(CANCELLED_OCCURRENCE)} viewerId={INVITEE} />
      ),
    },
    "mandate-unavailable": {
      description: "The mandate service could not be reached. 'We could not ask' gets a RETRY — rendering it as a denial is the same lie as rendering a failed load as an empty list.",
      viewport: "desktop",
      step: "failed.mandate_unavailable",
      render: () => (
        <Sheet
          seed={refused(
            503,
            "error.503.mandate_unavailable",
            "mandate service unavailable"
          )}
          viewerId={INVITEE}
        />
      ),
    },
    forbidden: {
      description: "We asked, and the answer is no: this calendar belongs to a workspace the viewer is not in. A settled refusal, so no retry is offered.",
      viewport: "desktop",
      step: "failed.mandate_denied",
      render: () => (
        <Sheet
          seed={refused(403, "error.403.forbidden", "forbidden")}
          viewerId={INVITEE}
        />
      ),
    },
  },
});
