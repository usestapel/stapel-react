/**
 * The meeting client, in the states a person is actually in — every one of
 * them rendered from `src/default`, so the showcase photographs the PRODUCT
 * and not a card of `state.step` chips (§83).
 */
import { defineDemo } from "@stapel/showcase";
import { RoomsPane } from "../src/default/RoomsPane.js";
import { MeetingPane } from "../src/default/MeetingPane.js";
import { JoinGate } from "../src/default/JoinGate.js";
import {
  staticMeetingBag,
  DEMO_ROOM,
  DEMO_HOST,
  DEMO_GUEST,
  demoNameFor,
  MeetingFrame as Frame,
} from "./_meeting.js";

export default defineDemo({
  id: "video.meeting",
  title: "The meeting client",
  description:
    "Open a room or enter a code, wait in the lobby, and the call. Every screen is a default-skin component: RoomsPane is what the nav manifest mounts at video.rooms, MeetingPane is one room end to end, and the lobby's liveness is the substrate's connection state rendered as words rather than a hidden poll.",
  component: RoomsPane,
  covers: ["MeetingPane", "JoinGate"],
  tokens: ["surface-raised", "border-subtle", "text"],
  variants: {
    default: {
      description:
        "The front door. There is no room list on the wire, and the pane says so rather than drawing an empty one. One column and 44px controls at 390px — the same tree, so the viewer's width control is what shows it.",
      viewport: "phone",
      step: "idle",
      render: () => (
        <Frame>
          <RoomsPane nameFor={demoNameFor} />
        </Frame>
      ),
    },
    admitted: {
      description:
        "A host inside their own room: the code to share, the lobby queue, the roster, and the call surface.",
      viewport: "desktop",
      step: "admitted",
      render: () => (
        <Frame>
          <MeetingPane
            joinCode={DEMO_ROOM.join_code}
            nameFor={demoNameFor}
            viewerUserId={DEMO_ROOM.created_by_id}
            meeting={staticMeetingBag({
              kind: "admitted",
              room: DEMO_ROOM,
              participant: DEMO_HOST,
              token: undefined,
            })}
          />
        </Frame>
      ),
    },
    waiting: {
      description:
        "A guest parked in the lobby. The page says it is waiting AND whether it is still listening — the state chat used to hide behind a 15-second timer.",
      viewport: "phone",
      step: "waiting",
      render: () => (
        <Frame>
          <MeetingPane
            joinCode={DEMO_ROOM.join_code}
            nameFor={demoNameFor}
            meeting={staticMeetingBag({
              kind: "waiting",
              room: DEMO_ROOM,
              participant: DEMO_GUEST,
            })}
          />
        </Frame>
      ),
    },
    denied: {
      description:
        "The host said no. Sticky for the room, so there is no retry — the one arm a generic error surface would have got wrong.",
      viewport: "phone",
      step: "denied",
      render: () => (
        <Frame>
          <JoinGate
            meeting={staticMeetingBag({
              kind: "denied",
              room: DEMO_ROOM,
              participant: DEMO_GUEST,
            })}
            initialCode={DEMO_ROOM.join_code}
          />
        </Frame>
      ),
    },
  },
});

