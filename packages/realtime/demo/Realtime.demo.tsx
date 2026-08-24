/**
 * The connection states, each reached by REAL frames on a scripted socket.
 *
 * The point of the demo is the middle two: `reconnecting` and `refused` are
 * states a skin must render. A socket that degrades invisibly looks exactly
 * like a working one — that is how a whole product ran on polling for months
 * while every dashboard said the sockets were fine.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import {
  DROP,
  KICK,
  REPLAY_1,
  REPLAY_2,
  REPLAY_DONE,
  RESYNC,
  REVOKE,
  RealtimeDemoHarness,
  WELCOME,
} from "./_harness.js";
import type { ServerStep } from "./_harness.js";
import { RealtimeProvider } from "../src/react/index.js";

/** Handshake accepted, nothing answered yet. */
const CONNECTING: readonly ServerStep[] = [];
/** welcome → replay ×2 → replay_done: the resume cursor lands on 2. */
const LIVE: readonly ServerStep[] = [WELCOME, REPLAY_1, REPLAY_2, REPLAY_DONE];
/** The socket died mid-stream. Backoff is running; the cursor is kept. */
const RECONNECTING: readonly ServerStep[] = [WELCOME, REPLAY_1, DROP];
/** A gap wider than the replay window: not an error, an instruction. */
const RESYNCING: readonly ServerStep[] = [WELCOME, RESYNC];
/** Rights withdrawn: the reason arrives in a frame, the 4410 follows. */
const REFUSED: readonly ServerStep[] = [WELCOME, REPLAY_DONE, KICK, REVOKE];

function Board(props: { script: readonly ServerStep[] }): ReactElement {
  return <RealtimeDemoHarness script={props.script} />;
}

export default defineDemo({
  id: "realtime.connection-states",
  title: "Realtime connection states",
  description:
    "One socket runtime, five states a skin has to be able to show: connecting, live after replay, reconnecting with the cursor kept, resync, and a refusal that carries the server's reason.",
  component: RealtimeProvider,
  covers: ["useStream", "useRealtimeState"],
  tokens: ["surface", "surface-raised", "border-subtle", "text", "text-muted"],
  variants: {
    connecting: {
      description: "The handshake is accepted; no welcome has arrived yet.",
      render: () => <Board script={CONNECTING} />,
    },
    live: {
      description:
        "welcome → replay → replay_done. The resume cursor is the ENVELOPE seq, not the message's place in the thread.",
      render: () => <Board script={LIVE} />,
    },
    reconnecting: {
      description:
        "The socket dropped. Backoff with full jitter is running, the cursor is held, and the state says so instead of falling silently back to polling.",
      render: () => <Board script={RECONNECTING} />,
    },
    resync: {
      description:
        "The gap is wider than the server's replay window. The socket stays open and the consumer re-hydrates over REST; the cursor is deliberately NOT advanced.",
      render: () => <Board script={RESYNCING} />,
    },
    refused: {
      description:
        "A kick frame carries the reason, and the 4410 that follows is terminal — retrying with the same credential would only hammer the host.",
      render: () => <Board script={REFUSED} />,
    },
  },
});
