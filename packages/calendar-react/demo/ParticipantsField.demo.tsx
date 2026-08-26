/**
 * The invitee list, in both of the modes it serves — and with the diff that
 * makes replace-set semantics survivable.
 *
 * `PUT /events/{id}/participants` takes the COMPLETE desired list: anyone
 * absent is removed. The interesting frame is therefore not "the list", it is
 * "the list plus what saving would change", which is a state a reader only
 * reaches after editing. Seeding it into the render closure is what lets the
 * catalogue photograph it at all.
 */
import { useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ParticipantsField } from "../src/default/index.js";
import type { Participant } from "../src/index.js";
import { CalendarDemoHarness } from "./_harness.js";

const EVENT_ID = "e-standalone";

/** Who the server currently has on the event. */
const ON_RECORD: readonly Participant[] = [
  { user_id: "u-2", rsvp: "accepted" },
  { user_id: "u-3", rsvp: "invited" },
  { user_id: "u-4", rsvp: "declined" },
];

/**
 * Managed mode: the replace-set editor for an event that already exists.
 *
 * The draft lives inside `<ParticipantsEditor>` and only a click moves it, so
 * the added/removed counters are honestly not photographable here — what the
 * variants vary is the set the SERVER has, which is what the editor opens on.
 */
function Managed(props: { readonly onRecord?: readonly string[] }): ReactElement {
  const { onRecord } = props;
  return (
    <CalendarDemoHarness>
      <ParticipantsField
        eventId={EVENT_ID}
        participants={
          onRecord === undefined
            ? ON_RECORD
            : ON_RECORD.filter((p) => onRecord.includes(p.user_id))
        }
      />
    </CalendarDemoHarness>
  );
}

/** Controlled mode: a plain list field inside the create form. */
function Controlled(props: { readonly initial: readonly string[] }): ReactElement {
  const [ids, setIds] = useState(props.initial);
  return (
    <CalendarDemoHarness>
      <ParticipantsField value={ids} onChange={setIds} />
    </CalendarDemoHarness>
  );
}

export default defineDemo({
  id: "calendar.participants-field",
  title: "Invitees",
  description:
    "The complete invitee set, shown whole before it is sent. The write is replace-set — anybody missing from the array is removed — so the surface is not an 'add invitee' button but 'here is exactly who will be invited after you save', with the warning stated and the save gated while nothing has changed.",
  component: ParticipantsField,
  covers: ["ParticipantsEditor"],
  tokens: ["surface-raised", "text-muted"],
  variants: {
    managed: {
      description: "The event's invitees as the server has them: nothing to save yet, and the save button says so instead of sitting lit.",
      viewport: "phone",
      step: "managed.unchanged",
      render: () => <Managed />,
    },
    "managed-one": {
      description: "The same editor on an event with a single invitee — the list is drawn whole either way, because the array IS the request.",
      viewport: "phone",
      step: "managed.one",
      render: () => <Managed onRecord={["u-2"]} />,
    },
    controlled: {
      description: "Create mode: the ids travel inside POST /events, so there is nothing to save separately and no save button is drawn.",
      viewport: "phone",
      step: "controlled",
      render: () => <Controlled initial={["u-2", "u-3"]} />,
    },
    nobody: {
      description: "An empty set, named — 'nobody is invited' is an answer, and a blank area is not.",
      viewport: "desktop",
      step: "controlled.empty",
      render: () => <Controlled initial={[]} />,
    },
  },
});
