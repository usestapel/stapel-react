/**
 * ONE THREAD AS IT SHIPS — and, deliberately, the screen where this pair's
 * transport honesty is visible.
 *
 * The tag in the header is the only place a person is told HOW freshness
 * arrives, and it is a label, never a behaviour: nothing else on this screen
 * branches on it. The demo harness turns the socket off (`socketUrl: null`),
 * which is not a convenience — it is one of the real deployments this pair
 * supports, and the one whose degradation used to be a silence. So the phone
 * variants below render the NAMED reason ("Live messages are off here —
 * refreshing every few seconds instead") rather than a bare "Refreshing every
 * few seconds", which is the label that let a broken handshake pass for a
 * design decision for months.
 *
 * That sentence is also why the header had to be fixed rather than photographed
 * around: at 390px a nowrap row could not hold a title and a full sentence, so
 * the degradation — the one thing on the screen a person might act on — was the
 * part that got crushed. The header wraps now.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { ConversationThreadPanel } from "../src/default/ConversationThreadPanel.js";
import {
  ChatDemoHarness,
  DEMO_THREAD_ID,
  DEMO_THREAD_MESSAGES,
  seedThread,
} from "./_harness.js";
import type { DemoSeed } from "./_harness.js";

/** The reader, so their own lines align to the trailing edge. */
const VIEWER = "u-buyer";

function Panel(props: { seed: DemoSeed }): ReactElement {
  return (
    <ChatDemoHarness seed={props.seed} handlers={{ "/read": { ok: true } }}>
      <ConversationThreadPanel conversationId={DEMO_THREAD_ID} viewerId={VIEWER} />
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.conversation-thread-panel",
  title: "Conversation (default skin)",
  description:
    "The shipped thread: replay plus live tail, the reader's own lines aligned to the trailing edge, a composer that states its own limit, and a transport tag that says WHY it is not live instead of only that it is refreshing. The same component renders a socket-fed thread and a polled one — that is the seam holding.",
  component: ConversationThreadPanel,
  tokens: ["surface-raised", "text", "text-muted", "border-subtle"],
  variants: {
    default: {
      description:
        "Phone width, a thread with a system line and both sides talking. The header carries the named degradation for a deployment with no socket, and it WRAPS onto its own line rather than squeezing the title — the sentence is the part a person may act on.",
      viewport: "phone",
      step: "ready",
      render: () => (
        <Panel seed={seedThread(DEMO_THREAD_ID, DEMO_THREAD_MESSAGES)} />
      ),
    },
    "earlier-history": {
      description:
        "The same thread with history behind it: the beginning-of-conversation sentence is replaced by the control that pages older messages onto the front.",
      viewport: "phone",
      step: "has-older",
      render: () => (
        <Panel
          seed={seedThread(DEMO_THREAD_ID, DEMO_THREAD_MESSAGES, {
            hasOlder: true,
          })}
        />
      ),
    },
    "no-messages-yet": {
      description:
        "A thread that exists but has nothing in it — the composer is the whole screen, at desk width.",
      viewport: "desktop",
      step: "empty",
      render: () => <Panel seed={seedThread(DEMO_THREAD_ID, [])} />,
    },
  },
});
