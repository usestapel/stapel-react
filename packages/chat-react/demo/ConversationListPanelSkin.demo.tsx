/**
 * THE INBOX AS IT SHIPS — the screen `chat.conversations` mounts, and until now
 * the one nothing in this repo had ever drawn.
 *
 * The three demos beside this one document the headless BAGS, which is the
 * layer a host replaces. This documents the layer a host gets: the antd panel
 * out of `src/default`, at the width most of its readers hold it at.
 *
 * Each variant is SEEDED (`seedInbox`), so its first paint is the state it is
 * named for rather than a spinner — a viewer's shot of `<Spin/>` proves
 * nothing, and four spinners under four names is worse than one honest demo.
 */
import type { ReactElement } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { ConversationListPanel } from "../src/default/ConversationListPanel.js";
import { CounterpartyAvatar } from "../src/default/people.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import {
  ChatDemoHarness,
  DEMO_INBOX,
  DEMO_PHOTO,
  DEMO_THREAD_CONVERSATION,
  DEMO_VIEWER,
  inboxPage,
  seedInbox,
} from "./_harness.js";
import { useT } from "@stapel/core";
import { CHAT_I18N_KEYS } from "../src/index.js";
import type { ChatPeopleDirectory, ChatPerson } from "../src/index.js";
import type { Conversation } from "../src/api/types.js";
import type { DemoHandlers, DemoSeed } from "./_harness.js";

/** Where a row leads. A storefront hands the panel real hrefs, so a thread is
 * right-clickable and lands in the browser's own history — the demo does the
 * same rather than showing the click-handler arm. */
function href(conversationId: string): string {
  return `/chat/${conversationId}`;
}

/**
 * A variant's seed AND the wire behind it, built from the same rows.
 *
 * All three variants used to share ONE handler map that answered
 * `/conversations` with an empty page, whatever the seed said. TanStack marks a
 * seeded query stale immediately, so the mount refetch fired, the empty page
 * won, and the catalogue photographed the EMPTY card three times under three
 * names — including the variant whose whole point is a busy inbox. Seeding the
 * cache is not enough on its own: the wire has to agree with it.
 */
function inboxDemo(
  rows: readonly Conversation[],
  options?: { readonly hasNext?: boolean }
): { seed: DemoSeed; handlers: DemoHandlers } {
  return {
    seed: seedInbox(rows, options),
    handlers: { "/conversations": inboxPage(rows, options) },
  };
}

const READY = inboxDemo(DEMO_INBOX);
const PAGED = inboxDemo(DEMO_INBOX, { hasNext: true });
const EMPTY = inboxDemo([]);

function Panel(props: { demo: { seed: DemoSeed; handlers: DemoHandlers } }): ReactElement {
  return (
    <ChatDemoHarness seed={props.demo.seed} handlers={props.demo.handlers}>
      {/* The reader is named, which is what lets a row name the OTHER person
          — and what lets the inbox open its own socket instead of polling and
          wearing the degradation sentence in every frame of the catalogue. */}
      <ConversationListPanel viewerId={DEMO_VIEWER} openHref={href} />
    </ChatDemoHarness>
  );
}

/**
 * THE THREE ANSWERS A ROW'S AVATAR CAN GET, side by side.
 *
 * Every row of the seeded inbox above renders one — but the demo people table
 * resolves a NAME and no picture, so the whole catalogue only ever showed the
 * middle case. The other two are the ones that go wrong in a deployment: a
 * host that wired avatars (a photo) and a host whose directory could not name
 * this person at all (a neutral glyph, never an initial invented from a user
 * id). They are drawn here because they are unreachable from any fixture the
 * panel variants can carry at once.
 */
function directoryOf(person: ChatPerson | null): ChatPeopleDirectory {
  return {
    pending: false,
    lookup: (userId) => (person !== null && person.userId === userId ? person : null),
  };
}

const SELLER = "u-seller";
const NAMED: ChatPerson = { userId: SELLER, displayName: "Marta Kovács" };

const AVATAR_CASES: readonly (readonly [string, ChatPeopleDirectory])[] = [
  ["initial", directoryOf(NAMED)],
  ["photo", directoryOf({ ...NAMED, avatarUrl: DEMO_PHOTO })],
  ["unknown", directoryOf(null)],
];

function AvatarStates(): ReactElement {
  const t = useT();
  return (
    <div style={{ display: "flex", gap: spacing["4"], alignItems: "center" }}>
      {AVATAR_CASES.map(([id, directory]) => (
        <CounterpartyAvatar
          key={id}
          conversation={DEMO_THREAD_CONVERSATION}
          viewerId={DEMO_VIEWER}
          directory={directory}
          label={t(CHAT_I18N_KEYS.listTitle)}
        />
      ))}
    </div>
  );
}

export default defineDemo({
  id: "chat.conversation-list-panel",
  title: "Inbox (default skin)",
  description:
    "The shipped inbox: threads newest-first, an unread count that carries its own accessible sentence rather than a hover, and a load-more control that becomes a stated end. A row with a subject carries TWO destinations and two hit areas — the row itself opens the thread, the subject title is a link to the listing, and neither contains the other because an anchor inside an anchor is not a document. The failed arm owns the failure on its own — an outage can never render here as `No conversations yet`.",
  component: ConversationListPanel,
  covers: ["CounterpartyAvatar"],
  tokens: ["surface-raised", "text", "text-muted", "border-subtle"],
  variants: {
    default: {
      description:
        "Phone width, the state almost every inbox is in: three threads, the top one with news — and with a subject, so its title is a link out to the listing and its photo sits in a 24×32 portrait frame rather than being cropped square. The unread badge is a number to the eye and a sentence to a screen reader — it names itself with `aria-label`, because a `title` tooltip is unreachable on the device this variant is drawn for.",
      viewport: "phone",
      step: "ready",
      render: () => <Panel demo={READY} />,
    },
    "more-to-load": {
      description:
        "A deeper inbox at desk width: the server says there is another page, so the end-of-list sentence is replaced by the control that fetches it.",
      viewport: "desktop",
      step: "paged",
      render: () => <Panel demo={PAGED} />,
    },
    empty: {
      description:
        "No conversations yet — reachable only when the read SUCCEEDED and returned nothing.",
      viewport: "phone",
      step: "empty",
      render: () => <Panel demo={EMPTY} />,
    },
    "row-identity": {
      description:
        "The row's identity glyph in all three answers the people seam can give: a resolved name (their initial), a resolved picture (the picture), and a directory that could not name this person (a neutral outline — never an initial invented from a user id, which is how a hole in a list gets mistaken for a design).",
      viewport: "phone",
      step: "avatars",
      render: () => (
        <ChatDemoHarness>
          <ChatSkinTheme surface="raised">
            <AvatarStates />
          </ChatSkinTheme>
        </ChatDemoHarness>
      ),
    },
  },
});
