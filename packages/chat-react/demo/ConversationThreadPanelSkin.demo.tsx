/**
 * ONE THREAD AS IT SHIPS — and, deliberately, the screen where this pair's
 * transport honesty is visible.
 *
 * The tag in the header is the only place a person is told HOW freshness
 * arrives, and it is a label, never a behaviour: nothing else on this screen
 * branches on it.
 *
 * Every variant here but the last one is LIVE, and that is a correction. The
 * harness used to switch the socket off for all of them (`socketUrl: null`),
 * on the reasoning that a no-socket deployment is real and its degradation had
 * once been a silence. Both true — and the result was that every frame of this
 * pair's catalogue carried "Live messages are off here — refreshing every few
 * seconds instead". A notice that is on in every picture cannot be read as a
 * notice, and that particular sentence is the one this product was reported
 * for: a person could not tell a fixed chat from a broken one. So the shipped
 * screen is photographed working, and `no-live-socket` below is where the
 * named degradation is photographed — once, deliberately, in the variant that
 * is about it.
 *
 * That sentence is also why the header had to be fixed rather than photographed
 * around: at 390px a nowrap row could not hold a title and a full sentence, so
 * the degradation — the one thing on the screen a person might act on — was the
 * part that got crushed. The header wraps now.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { ConversationThreadPanel } from "../src/default/ConversationThreadPanel.js";
import { SubjectCard } from "../src/default/subjectCard.js";
import { ThreadActionsMenu } from "../src/default/ThreadActionsMenu.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import {
  ChatDemoHarness,
  DEMO_SUBJECT,
  DEMO_SUBJECT_GONE,
  DEMO_THREAD_ACTIONS,
  DEMO_THREAD_CONVERSATION,
  DEMO_THREAD_ID,
  DEMO_THREAD_MESSAGES,
  messagePage,
  seedAll,
  seedConversation,
  seedThread,
} from "./_harness.js";
import type { ChatMessage } from "../src/api/types.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";

/** The reader, so their own lines align to the trailing edge. */
const VIEWER = "u-buyer";

/** The other side of this thread — who "block" would be about. */
const COUNTERPARTY = "u-seller";

/**
 * A variant's seed AND the wire behind it, built from the same rows.
 *
 * The three variants below used to share one handler map that declared `/read`
 * and nothing else, so the thread's own `GET …/messages` fell through to the
 * mock's catch-all. Whatever that answered, it was not a `MessagePage`, and the
 * pair's parser said so — every one of these variants photographed the ERROR
 * card while its seeded window sat in the cache underneath. A demo has to agree
 * with itself on both sides of the seam: the same messages in the store and on
 * the wire, so a refetch is a no-op instead of a contradiction.
 */
function threadDemo(
  messages: readonly ChatMessage[],
  options?: { readonly hasOlder?: boolean }
): { seed: DemoSeed; handlers: DemoHandlers } {
  return {
    // The conversation ROW travels with the messages. Without it the header
    // had nobody to name and nothing to be about, so every frame of this
    // pair's thread showed the plain list title and no subject card — the
    // exact screen the 0.6 work was done to replace. `/messages` and `/read`
    // are declared BEFORE the conversation path because the mock matches on
    // the first suffix that appears in the URL and `…/conversations/<id>/
    // messages` contains both.
    seed: seedAll(
      seedConversation(DEMO_THREAD_CONVERSATION),
      seedThread(DEMO_THREAD_ID, messages, options)
    ),
    handlers: {
      "/read": { ok: true },
      "/messages": messagePage(messages),
      "/conversations/": DEMO_THREAD_CONVERSATION,
    },
  };
}

const READY = threadDemo(DEMO_THREAD_MESSAGES);
const HAS_OLDER = threadDemo(DEMO_THREAD_MESSAGES, { hasOlder: true });
const EMPTY = threadDemo([]);

function Panel(props: {
  demo: { seed: DemoSeed; handlers: DemoHandlers };
  socket?: "live" | "off";
}): ReactElement {
  return (
    <ChatDemoHarness
      seed={props.demo.seed}
      handlers={props.demo.handlers}
      {...(props.socket !== undefined ? { socket: props.socket } : {})}
    >
      <ConversationThreadPanel conversationId={DEMO_THREAD_ID} viewerId={VIEWER} />
    </ChatDemoHarness>
  );
}

/**
 * The two surfaces above the messages, mounted BY HAND — which is what
 * `src/default/index.ts` exports them for: a host composing its own thread
 * screen keeps this pair's subject card and overflow menu rather than
 * re-deciding both. Drawn loose here so each has states of its own on the
 * catalogue, next to the variants where the shipped panel renders them in
 * place.
 */
function ThreadTop(props: {
  subject: typeof DEMO_SUBJECT;
  actions: boolean;
}): ReactElement {
  return (
    <ChatDemoHarness
      seed={seedConversation(DEMO_THREAD_CONVERSATION)}
      handlers={{ "/conversations/": DEMO_THREAD_CONVERSATION }}
      {...(props.actions ? { slots: DEMO_THREAD_ACTIONS } : {})}
    >
      <ChatSkinTheme surface="raised">
        <div style={{ display: "flex", flexDirection: "column", gap: spacing["3"] }}>
          <ThreadActionsMenu
            conversationId={DEMO_THREAD_ID}
            counterpartyId={COUNTERPARTY}
            viewerId={VIEWER}
          />
          <SubjectCard subject={props.subject} conversationId={DEMO_THREAD_ID} />
        </div>
      </ChatSkinTheme>
    </ChatDemoHarness>
  );
}

export default defineDemo({
  id: "chat.conversation-thread-panel",
  title: "Conversation (default skin)",
  description:
    "The shipped thread: replay plus live tail, the reader's own lines aligned to the trailing edge, a composer that states its own limit, and a transport tag that says WHY it is not live instead of only that it is refreshing. The same component renders a socket-fed thread and a polled one — that is the seam holding.",
  component: ConversationThreadPanel,
  // `ChatSkinTheme` is not a component a host mounts by hand — every surface in
  // `src/default` wraps itself in it — so it has no demo of its own and would
  // otherwise sit permanently uncovered. It IS rendered here: it is the theme
  // root this panel opens with, and the reason the card is legible on a dark
  // page instead of inheriting antd's light tokens under it.
  covers: ["ChatSkinTheme", "SubjectCard", "ThreadActionsMenu"],
  tokens: ["surface-raised", "text", "text-muted", "border-subtle"],
  variants: {
    default: {
      description:
        "Phone width, a thread with a system line and both sides talking, on a working deployment: the header says Live and there is no banner, because there is nothing to report.",
      viewport: "phone",
      step: "ready",
      render: () => <Panel demo={READY} />,
    },
    "earlier-history": {
      description:
        "The same thread with history behind it: the beginning-of-conversation sentence is replaced by the control that pages older messages onto the front.",
      viewport: "phone",
      step: "has-older",
      render: () => <Panel demo={HAS_OLDER} />,
    },
    "no-messages-yet": {
      description:
        "A thread that exists but has nothing in it — the composer is the whole screen, at desk width.",
      viewport: "desktop",
      step: "empty",
      render: () => <Panel demo={EMPTY} />,
    },
    dark: {
      description:
        "The same thread under the skin's own theme root, pinned dark. The wrapper is not decoration: without it this card took whatever ConfigProvider happened to be above it, and in a dark document with none antd's default algorithm is the LIGHT one — which is how six of this pair's stories were photographed as white text on a black field. Pinning the mode is the one use the prop is FOR, and it is what makes that failure visible if it ever comes back.",
      viewport: "phone",
      step: "dark",
      render: () => (
        <ChatSkinTheme mode="dark" surface="raised">
          <Panel demo={READY} />
        </ChatSkinTheme>
      ),
    },
    "no-live-socket": {
      description:
        "A deployment with no sockets at all — a supported configuration, not a fault. The header carries the NAMED reason rather than a bare `Refreshing every few seconds`, and it WRAPS onto its own line instead of squeezing the title: at 390px the sentence is the part a person may act on, so it is the part that must survive. This is the only variant that wears the banner, which is what makes it readable.",
      viewport: "phone",
      step: "no_socket",
      render: () => <Panel demo={READY} socket="off" />,
    },
    "subject-gone": {
      description:
        "The two loose surfaces above the messages, on a deployment that wired NEITHER report nor block: there is no overflow control at all, because a menu that opens onto nothing promises an action this product does not have. The listing behind the thread has been removed, which the card says in its own sentence — the conversation about a deleted thing is the state a person is most confused by, so it is drawn rather than blanked.",
      viewport: "phone",
      step: "subject-gone",
      render: () => <ThreadTop subject={DEMO_SUBJECT_GONE} actions={false} />,
    },
    "thread-menu-open": {
      description:
        "The same parts with both verbs wired, photographed with the menu OPEN — at 390px the fleet dialog rule makes it a bottom sheet, and a sheet that is only ever shot closed has zero visual evidence. The step opens it after mount, so the picture is the sheet and not the button that summons it.",
      viewport: "phone",
      step: "menu-open",
      render: () => <ThreadTop subject={DEMO_SUBJECT} actions={true} />,
      play: async ({ click, find }) => {
        await click('[data-testid="chat-thread-menu-open"]');
        await find('[data-testid="chat-thread-menu"]', { portal: true });
      },
    },
  },
});
