/**
 * THE TWO SENTENCES A THREAD HEADER MAY SAY, side by side — because for a
 * year it said one of them for both.
 *
 * `<PresenceLine/>` answers "is the OTHER person there", from the server,
 * about their own connections. `<TransportTag/>` answers "is MY connection
 * healthy", about this browser. The catalogue photographs them together
 * precisely so the difference is visible: presence is a whole sentence under
 * a name, and the transport tag is chrome that is ABSENT while nothing is
 * wrong.
 *
 * The defect being replaced: a tag reading "Live" that was on
 * whenever the reader's own socket was up, drawn next to the seller's name,
 * where every person read it as "the seller is online". Both halves of the
 * fix are here — the sentence that is really about them, and the silence
 * where the false tag used to be.
 *
 * `<ChatNotificationsPrompt/>` is the third surface: the ask, photographed
 * open, which is the only frame in which a pre-prompt has any visual evidence
 * at all.
 */
import { useEffect, useState } from "react";
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { Flex, Typography } from "antd";
import { PresenceLine } from "../src/default/PresenceLine.js";
import { TransportTag } from "../src/default/TransportTag.js";
import { ChatNotificationsPrompt } from "../src/default/ChatNotificationsPrompt.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import { ChatDemoHarness, DEMO_THREAD_CONVERSATION, DEMO_VIEWER } from "./_harness.js";
import type { Conversation } from "../src/api/types.js";
import type { PermissionBag } from "@stapel/core";

const SELLER = "u-seller";

/**
 * Demo CONTENT, not copy: the catalogue needs a name above the presence line
 * because the whole point is which of the two the sentence is about. Held in
 * constants so the fleet's hardcoded-text rule can tell a fixture from a
 * string a product would have to translate.
 */
const DEMO_NAME = "Anna";
const DEMO_ASIDE =
  "The thread carries on behind the sheet - nothing is gated on the answer.";

/** The same thread, with the seller's presence set to whatever a frame says. */
function withPresence(online: boolean, lastSeenAt: string | null): Conversation {
  return {
    ...DEMO_THREAD_CONVERSATION,
    participants: [
      { user_id: DEMO_VIEWER, role: "member", last_read_seq: 3, online: true, last_seen_at: null },
      {
        user_id: SELLER,
        role: "member",
        last_read_seq: 3,
        online,
        last_seen_at: lastSeenAt,
      },
    ],
  };
}

/** Long enough ago that the relative ladder reads in hours, not "now". */
const EARLIER = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

/** A header row exactly as `ConversationThreadPanel` composes it. */
function Header(props: {
  readonly conversation: Conversation;
  readonly tag: ReactElement | null;
}): ReactElement {
  return (
    <ChatDemoHarness socket="off">
      <ChatSkinTheme surface="raised">
        <Flex
          justify="space-between"
          align="center"
          wrap="wrap"
          gap={spacing[2]}
          style={{ padding: spacing[3] }}
        >
          <Flex vertical gap={0} style={{ minWidth: 0 }}>
            <Typography.Title level={4} style={{ margin: 0, minWidth: 0 }}>
              {DEMO_NAME}
            </Typography.Title>
            <PresenceLine conversation={props.conversation} viewerId={DEMO_VIEWER} />
          </Flex>
          {props.tag}
        </Flex>
      </ChatSkinTheme>
    </ChatDemoHarness>
  );
}

/**
 * A browser that has NOT been asked yet.
 *
 * The catalogue cannot photograph this state by standing in it: a headless
 * Chromium has already answered the notifications permission, and the
 * component correctly renders nothing once the browser has — which is the
 * behaviour, and a blank frame. So the bag is supplied, exactly as
 * `PermissionSheet` takes one, and the picture is of the arm the state names.
 */
const NOT_YET_ASKED: PermissionBag = {
  kind: "notifications",
  status: "prompt",
  supported: true,
  asking: false,
  request: async () => "prompt",
  refresh: () => undefined,
};

/** The prompt, driven past its value moment so the sheet is actually open. */
function Prompt(): ReactElement {
  const [lastSeq, setLastSeq] = useState(3);
  useEffect(() => {
    // The moment: a message lands after the thread has loaded. Before this
    // tick the component renders nothing at all, which IS the page-load
    // behaviour and is why the ask cannot be photographed on mount.
    const handle = setTimeout(() => {
      setLastSeq(4);
    }, 0);
    return () => {
      clearTimeout(handle);
    };
  }, []);
  return (
    <ChatDemoHarness socket="off">
      <ChatSkinTheme surface="raised">
        <div style={{ minHeight: 320, padding: spacing[3] }}>
          <Typography.Paragraph type="secondary">{DEMO_ASIDE}</Typography.Paragraph>
          <ChatNotificationsPrompt
            lastSeq={lastSeq}
            ready
            permission={NOT_YET_ASKED}
          />
        </div>
      </ChatSkinTheme>
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.presence",
  title: "Presence and transport (default skin)",
  description:
    "Who is actually there, and whether this browser's own connection is healthy — two different facts, in two different controls. Presence is a server-side fact about the OTHER participant's connections; the transport tag talks about this client and says nothing at all while nothing is wrong.",
  component: PresenceLine,
  covers: ["TransportTag", "ChatNotificationsPrompt"],
  tokens: ["surface-raised", "text", "text-muted"],
  variants: {
    default: {
      description:
        "The counterparty is connected, and this client's socket is live. The header carries ONE claim — 'Online', about them — and no transport chrome, because a working connection is the expected state and needs none. This is the frame where the old build drew its 'Live' tag from the reader's own socket and every person read it as the seller being there.",
      viewport: "phone",
      step: "online",
      render: () => (
        <Header
          conversation={withPresence(true, new Date().toISOString())}
          tag={
            <TransportTag
              transport="socket"
              degraded={null}
              status={{
                stream: "chat:conv:demo",
                state: "live",
                refusal: undefined,
                reason: undefined,
                attempt: 0,
                cursor: 4,
                gap: undefined,
                serverSeq: 4,
              }}
            />
          }
        />
      ),
    },
    "last-seen": {
      description:
        "The load-bearing case, and the one the old header got exactly backwards: this client's socket is perfectly live while the OTHER person is gone. The line says when they were last here, on core's relative-time ladder, so it reads in the visitor's own language without a key per unit.",
      viewport: "phone",
      step: "last-seen",
      render: () => (
        <Header
          conversation={withPresence(false, EARLIER)}
          tag={
            <TransportTag
              transport="socket"
              degraded={null}
              status={{
                stream: "chat:conv:demo",
                state: "live",
                refusal: undefined,
                reason: undefined,
                attempt: 0,
                cursor: 4,
                gap: undefined,
                serverSeq: 4,
              }}
            />
          }
        />
      ),
    },
    "never-seen": {
      description:
        "A participant this deployment has never seen connect. 'Seen long ago' and 'never seen' are different facts, so the line says the plain thing rather than inventing a date — and a server too old to send the fields lands here too, offline and quiet, never on a fabricated 'online'.",
      viewport: "desktop",
      step: "unknown",
      render: () => <Header conversation={withPresence(false, null)} tag={null} />,
    },
    "my-connection-is-the-problem": {
      description:
        "Desk width, and the one case the tag is FOR: this browser cannot hold a socket. The named reason is chrome that appears because something is wrong — and the presence line beside it is untouched, because the other person's whereabouts are not a function of this laptop's wifi.",
      viewport: "desktop",
      step: "degraded",
      render: () => (
        <Header
          conversation={withPresence(true, new Date().toISOString())}
          tag={
            <TransportTag
              transport="polling"
              degraded={{
                reason: "never_connected",
                attempt: 4,
                since: Date.now() - 60_000,
                messageKey: "chat.transport.degraded.never_connected",
              }}
            />
          }
        />
      ),
    },
    "notifications-ask": {
      description:
        "The ask, at the first message exchanged — never on page load, because `denied` is terminal and an early prompt spends the only chance the browser gives. 'Not now' is a dismissal and not a refusal: it never reaches the browser, so the offer survives to be made again.",
      viewport: "phone",
      step: "ask",
      render: () => <Prompt />,
    },
  },
});
