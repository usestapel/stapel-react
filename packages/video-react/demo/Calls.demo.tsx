/**
 * The 1:1 call, in the two states a person actually meets it in.
 *
 * The ring is the one screen in this package that arrives UNINVITED — over
 * whatever page the person was on — so the demo shows it as it is drawn: full
 * frame on a phone, a card on a desktop, and the caller's own "calling" state with
 * a cancel. The panel demo is the call itself, including the audio-only arm
 * that a bad connection lands in.
 */
import { defineDemo } from "@stapel/showcase";
import { CallPanel } from "../src/default/CallPanel.js";
import type { CallResponse } from "../src/index.js";
import { CallDemoFrame, DEMO_ROOM_MEDIA, ringingDemoCall } from "./_calls.js";

const ACCEPTED: CallResponse = ringingDemoCall({
  state: "accepted",
  answered_at: "2026-09-06T10:00:00+00:00",
  expires_at: null,
});

export default defineDemo({
  id: "video.call-panel",
  title: "The call",
  description:
    "One remote filling the frame, one local corner picture, and four controls — not a conference grid with two tiles in it. The timer is anchored on the SERVER's answered_at, so both people's screens agree and a reconnect does not restart the clock. There is no chat: messaging is stapel-chat, and the server denies can_publish_data in the grant so a data channel cannot be opened here at all.",
  component: CallPanel,
  tokens: ["surface-raised"],
  variants: {
    connected: {
      description:
        "A video call, three minutes in. Mute, camera, camera flip on a phone with two of them, hang up.",
      viewport: "phone",
      step: "connected",
      render: () => (
        <CallDemoFrame>
          <CallPanel
            room={DEMO_ROOM_MEDIA}
            call={ACCEPTED}
            peerName="Анна"
            now={() => Date.parse("2026-09-06T10:03:12+00:00")}
            cameras={[
              { deviceId: "front", label: "Front" },
              { deviceId: "back", label: "Back" },
            ]}
            onHangup={() => undefined}
          />
        </CallDemoFrame>
      ),
    },
    "audio-only": {
      description:
        "The fallback a bad connection lands in. A STATE, with the person's name and a clock — not an empty rectangle somebody reads as a failure. No camera control at all, because there is nothing for it to do.",
      viewport: "phone",
      step: "audio",
      render: () => (
        <CallDemoFrame>
          <CallPanel
            room={DEMO_ROOM_MEDIA}
            call={{ ...ACCEPTED, media: "audio" }}
            peerName="Анна"
            now={() => Date.parse("2026-09-06T10:00:41+00:00")}
            onHangup={() => undefined}
          />
        </CallDemoFrame>
      ),
    },
    reconnecting: {
      description:
        "The media session dropped. The pill says so and offers a reconnect that RE-MINTS the grant — a token is presented again on every full reconnect and nothing re-mints it automatically, so replaying the old one fails exactly when the call has been up long enough to matter.",
      viewport: "desktop",
      step: "reconnecting",
      render: () => (
        <CallDemoFrame>
          <CallPanel
            room={DEMO_ROOM_MEDIA}
            call={ACCEPTED}
            peerName="Анна"
            connection="reconnecting"
            now={() => Date.parse("2026-09-06T10:01:05+00:00")}
            onHangup={() => undefined}
            onReconnect={() => undefined}
          />
        </CallDemoFrame>
      ),
    },
  },
});
