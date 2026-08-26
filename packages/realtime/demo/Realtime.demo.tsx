/**
 * The connection states, each reached by REAL frames on a scripted socket.
 *
 * The subject of the demo is `demo/LiveBadge.tsx` — the reference surface a
 * pair copies: a coloured dot, ONE human sentence, and a Reconnect button only
 * where retrying can change the answer. What the runtime returns (the stream
 * key, the `snake_case` refusal, the cursor table) is a developer's business
 * and sits behind the collapsed "Developer details" disclosure under it.
 *
 * The point of the demo is the middle group: `reconnecting`, `unavailable` and
 * `refused` are three states a spinner renders identically and a person must
 * be able to tell apart. A socket that degrades invisibly looks exactly like a
 * working one — that is how a whole product ran on polling for months while
 * every dashboard said the sockets were fine.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import {
  DROP,
  KICK,
  NEVER_OPENS,
  REPLAY_1,
  REPLAY_2,
  REPLAY_DONE,
  RESYNC,
  REVOKE,
  RealtimeDemoHarness,
  WELCOME,
} from "./_harness.js";
import type { ServerStep } from "./_harness.js";
import type { RealtimeDegradationThresholds } from "../src/index.js";
import { RealtimeProvider } from "../src/react/index.js";

/** Handshake accepted, nothing answered yet. */
const CONNECTING: readonly ServerStep[] = [];
/** welcome → replay ×2 → replay_done: the resume cursor lands on 2. */
const LIVE: readonly ServerStep[] = [WELCOME, REPLAY_1, REPLAY_2, REPLAY_DONE];
/** The socket died mid-stream. Backoff is running; the cursor is kept. */
const RECONNECTING: readonly ServerStep[] = [WELCOME, REPLAY_1, DROP];
/** Nothing ever answered the handshake: the state that hid for months. */
const UNAVAILABLE: readonly ServerStep[] = [NEVER_OPENS];
/** A gap wider than the replay window: not an error, an instruction. */
const RESYNCING: readonly ServerStep[] = [WELCOME, RESYNC];
/** Rights withdrawn: the reason arrives in a frame, the 4410 follows. */
const REFUSED: readonly ServerStep[] = [WELCOME, REPLAY_DONE, KICK, REVOKE];

/** A drop that is named the moment it happens, on the harness's fixed clock. */
const NAME_THE_DROP: RealtimeDegradationThresholds = { reconnectingLongMs: 0 };
/** One unanswered handshake is enough to name a socket that never worked. */
const NAME_THE_SILENCE: RealtimeDegradationThresholds = { neverConnectedAttempts: 1 };

function Board(props: {
  script: readonly ServerStep[];
  degradation?: RealtimeDegradationThresholds;
}): ReactElement {
  return (
    <RealtimeDemoHarness
      script={props.script}
      {...(props.degradation === undefined ? {} : { degradation: props.degradation })}
    />
  );
}

export default defineDemo({
  id: "realtime.connection-states",
  title: "Realtime connection states",
  description:
    "One socket runtime, six states a skin has to be able to show — and the badge that shows them. `demo/LiveBadge.tsx` is the component a pair copies: it reads `degradation.kind` and `status.refusal` off the runtime and turns them into a dot, one sentence, and a Reconnect button that is present only where retrying can change the answer. The wire envelope stays available to developers, one disclosure down.",
  component: RealtimeProvider,
  covers: ["useStream", "useRealtimeState"],
  tokens: [
    "surface",
    "border",
    "border-subtle",
    "text",
    "text-muted",
    "success",
    "success-bg",
    "info",
    "info-bg",
    "warning",
    "warning-bg",
    "error",
    "error-bg",
  ],
  variants: {
    connecting: {
      description:
        "The handshake is accepted; no welcome has arrived yet. Copy this pair for a first paint: the badge is present and honest before anything has happened, and offers no action, because nothing is stuck yet.",
      viewport: "phone",
      step: "connecting",
      render: () => <Board script={CONNECTING} />,
    },
    live: {
      description:
        "welcome → replay → replay_done. The resting state: a green dot and one sentence about the reader's messages — not about the socket. The resume cursor behind it is the ENVELOPE seq, and it is in the disclosure where a developer expects it.",
      viewport: "phone",
      step: "live",
      render: () => <Board script={LIVE} />,
    },
    reconnecting: {
      description:
        "The socket dropped after having worked. Backoff with full jitter is running and the cursor is held, so the sentence says waiting is reasonable and stamps WHEN it stopped — the pair to copy for any transient outage, Reconnect included because a retry can genuinely land.",
      viewport: "phone",
      step: "reconnecting_long",
      render: () => <Board script={RECONNECTING} degradation={NAME_THE_DROP} />,
    },
    unavailable: {
      description:
        "The handshake was never answered — an origin allowlist nobody filled in, an ingress that does not upgrade. Copy this pair to keep the state that hid for months out of the same spinner as a transient drop: it has never worked HERE, it says so, and it points at the deployment rather than at the network.",
      viewport: "phone",
      step: "never_connected",
      render: () => <Board script={UNAVAILABLE} degradation={NAME_THE_SILENCE} />,
    },
    resync: {
      description:
        "The gap is wider than the server's replay window. The socket stays open and the consumer re-hydrates over REST, so this is progress, not a fault: an informational tone, no action, and the cursor deliberately NOT advanced.",
      viewport: "phone",
      step: "resync",
      render: () => <Board script={RESYNCING} />,
    },
    refused: {
      description:
        "A kick frame carries the reason and the 4410 that follows is terminal. Copy this pair for every verdict: the refusal becomes a sentence about the reader's access — never the `revoked` enum or the `removed_from_conversation` payload — and there is NO Reconnect button, with the line beside it saying why retrying would not help.",
      viewport: "phone",
      step: "refused",
      render: () => <Board script={REFUSED} />,
    },
  },
});
