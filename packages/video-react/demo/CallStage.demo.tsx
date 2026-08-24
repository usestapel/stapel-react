/** The call stage, and the two states a host most often meets. */
import { defineDemo } from "@stapel/showcase";
import { CallStage } from "../src/default/CallStage.js";
import { MeetingFrame as Frame } from "./_meeting.js";

export default defineDemo({
  id: "video.call-stage",
  title: "The call stage",
  description:
    "The media session behind an OPTIONAL peer. livekit-client is loaded with import() at the moment a token exists; its absence is a designed screen naming the package and the slot, not a stack trace. A host replaces the whole surface through MeetingPane's renderCallStage.",
  component: CallStage,
  tokens: ["surface-raised"],
  variants: {
    "no-peer": {
      description:
        "The peer is not installed. The most likely state in any host that only wanted the usage report.",
      viewport: "phone",
      step: "missing",
      render: () => (
        <Frame>
          <CallStage
            token="demo-token"
            serverUrl="wss://sfu.demo.stapel.dev"
            loadPeer={() => Promise.resolve({})}
          />
        </Frame>
      ),
    },
    "no-token": {
      description:
        "Not admitted yet, so there is no token. A sentence, not a failure.",
      viewport: "desktop",
      step: "idle",
      render: () => (
        <Frame>
          <CallStage serverUrl="wss://sfu.demo.stapel.dev" />
        </Frame>
      ),
    },
  },
});
