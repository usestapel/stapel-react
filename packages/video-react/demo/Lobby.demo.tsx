/** The lobby and the roster, as a host and as a participant who is not one. */
import { defineDemo } from "@stapel/showcase";
import { loadReady } from "@stapel/core";
import { LobbyPanel } from "../src/default/LobbyPanel.js";
import { ParticipantsList } from "../src/default/ParticipantsList.js";
import {
  staticLobbyBag,
  actionBlockedForDemo,
  DEMO_ROOM,
  DEMO_HOST,
  DEMO_WAITING,
  DEMO_GUEST,
  demoNameFor,
  MeetingFrame as Frame,
} from "./_meeting.js";

export default defineDemo({
  id: "video.lobby",
  title: "The lobby",
  description:
    "Who is knocking and the host's two answers. Turning someone away is sticky, so it asks first through SkinConfirm — a bottom sheet on a phone. A viewer who is not the host gets the list with the reason beside the controls, never a lit button the backend answers 403 to.",
  component: LobbyPanel,
  covers: ["ParticipantsList"],
  tokens: ["surface-raised"],
  variants: {
    queue: {
      description: "Two people waiting, one of them learned from the socket.",
      viewport: "phone",
      step: "waiting",
      render: () => (
        <Frame>
          <LobbyPanel
            joinCode={DEMO_ROOM.join_code}
            nameFor={demoNameFor}
            isHost
            lobby={staticLobbyBag([DEMO_WAITING, DEMO_HOST])}
          />
        </Frame>
      ),
    },
    empty: {
      description: "Nobody waiting — a designed zero state, not the digit 0.",
      viewport: "desktop",
      step: "empty",
      render: () => (
        <Frame>
          <LobbyPanel
            joinCode={DEMO_ROOM.join_code}
            nameFor={demoNameFor}
            isHost
            lobby={staticLobbyBag([DEMO_HOST])}
          />
        </Frame>
      ),
    },
    "not-host": {
      description:
        "A participant who is not the host. The verdicts are off and the sentence saying why is beside them.",
      viewport: "phone",
      step: "blocked",
      render: () => (
        <Frame>
          <LobbyPanel
            joinCode={DEMO_ROOM.join_code}
            nameFor={demoNameFor}
            isHost={false}
            lobby={staticLobbyBag([DEMO_WAITING], {
              verdictGate: actionBlockedForDemo(),
            })}
          />
        </Frame>
      ),
    },
    roster: {
      description:
        "The room's people with their state as a coloured tag — never the raw enum member the visual pass found across six packages.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <Frame>
          <ParticipantsList
            participants={loadReady([DEMO_HOST, DEMO_WAITING, DEMO_GUEST])}
            nameFor={demoNameFor}
            hasMore
          />
        </Frame>
      ),
    },
  },
});
