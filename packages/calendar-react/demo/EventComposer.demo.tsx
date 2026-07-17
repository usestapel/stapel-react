/** Event composer — headless create-event mutation. */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { cssVar } from "@stapel/tokens";
import { useT } from "@stapel/core";
import { EventComposer } from "../src/index.js";
import type { EventCreateRequest } from "../src/index.js";
import {
  CalendarDemoHarness,
  DemoCard,
  DemoActions,
  DemoButton,
} from "./_harness.js";

/** The 201 body the canned handler echoes for a created event. */
const CREATED_EVENT = {
  id: "550e8400-e29b-41d4-a716-4466554400ff",
  title: "Coffee chat",
  description: "",
  start: "2026-07-15T09:00:00Z",
  end: "2026-07-15T09:30:00Z",
  owner_id: "u-1",
  scope_key: "ws-1",
  status: "confirmed",
  recurrence_type: "none",
  rrule: "",
  participants: [],
};

/** A minimal draft the demo submits (a real host builds this from a form). */
const DRAFT: EventCreateRequest = {
  title: "Coffee chat",
  start: "2026-07-15T09:00:00Z",
  end: "2026-07-15T09:30:00Z",
};

function ComposerBody(): ReactElement {
  const t = useT();
  return (
    <DemoCard heading="EventComposer">
      <EventComposer>
        {({ create, isCreating, created }) => (
          <>
            <span style={{ color: cssVar("text-muted") }}>
              {created
                ? t("calendar.composer.created")
                : isCreating
                  ? t("calendar.composer.creating")
                  : t("calendar.composer.create")}
            </span>
            <DemoActions>
              <DemoButton
                run={() => create(DRAFT)}
                labelKey="calendar.composer.create"
              />
            </DemoActions>
          </>
        )}
      </EventComposer>
    </DemoCard>
  );
}

function EventComposerDemo(): ReactElement {
  return (
    <CalendarDemoHarness handlers={{ "/events": [201, CREATED_EVENT] }}>
      <ComposerBody />
    </CalendarDemoHarness>
  );
}

/**
 * Demonstrates the headless create-event write: the canned handler echoes a 201
 * event, so clicking "Create event" resolves to the created state. A real host
 * renders a form (title, start/end pickers, recurrence, invitees) and passes
 * the draft to `create`. Swap the handler for a `[400, {localizable_error: …}]`
 * tuple to exercise the error branch.
 */
export default defineDemo({
  id: "calendar.composer",
  title: "Event composer",
  description:
    "The headless EventComposer wraps the create-event mutation; on success the pair invalidates the calendar reads. Bring your own form UI — the component is renderless.",
  component: EventComposer,
  tokens: ["card-bg"],
  variants: {
    default: { render: () => <EventComposerDemo /> },
  },
});
