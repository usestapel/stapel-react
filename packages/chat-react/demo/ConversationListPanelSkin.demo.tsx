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
import type { ReactElement, ReactNode } from "react";
import { defineDemo } from "@stapel/showcase";
import { spacing } from "@stapel/tokens";
import { ConversationListPanel } from "../src/default/ConversationListPanel.js";
import { CounterpartyAvatar } from "../src/default/people.js";
import { ChatSkinTheme } from "../src/default/theme.js";
import {
  ChatDemoHarness,
  DEMO_INBOX,
  DEMO_LEFT_LIST,
  DEMO_PHOTO,
  DEMO_THREAD_CONVERSATION,
  DEMO_VIEWER,
  inboxPage,
  seedAll,
  seedInbox,
  seedLeftList,
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

/**
 * THE OTHER TAB (stapel-chat 0.8.6) — and it takes two seeds and two handlers,
 * which is the fact being documented.
 *
 * `?left=true` is the exact complement of the inbox and is ordered by
 * `left_at`, so it is a different cache entry with a different anchor chain.
 * The handler for it is declared FIRST because `mockFetch` matches by suffix
 * in order and `left=true` is inside the same `/conversations` URL: declared
 * second, the inbox's handler would answer both and the catalogue would
 * photograph the inbox under the «Left» tab, which is exactly the
 * confusion the split cache entry exists to prevent.
 */
const LEFT: { seed: DemoSeed; handlers: DemoHandlers } = {
  seed: seedAll(seedInbox(DEMO_INBOX), seedLeftList(DEMO_LEFT_LIST)),
  handlers: {
    "left=true": inboxPage(DEMO_LEFT_LIST),
    "/conversations": inboxPage(DEMO_INBOX),
  },
};

function Panel(props: {
  demo: { seed: DemoSeed; handlers: DemoHandlers };
  view?: "inbox" | "left";
  renderSubject?: (conversation: Conversation) => ReactNode;
}): ReactElement {
  return (
    <ChatDemoHarness seed={props.demo.seed} handlers={props.demo.handlers}>
      {/* The reader is named, which is what lets a row name the OTHER person
          — and what lets the inbox open its own socket instead of polling and
          wearing the degradation sentence in every frame of the catalogue. */}
      <ConversationListPanel
        viewerId={DEMO_VIEWER}
        openHref={href}
        {...(props.view !== undefined ? { defaultView: props.view } : {})}
        {...(props.renderSubject !== undefined
          ? { renderSubject: props.renderSubject }
          : {})}
      />
    </ChatDemoHarness>
  );
}

/**
 * THE ROW A DEPLOYMENT WITHOUT A SUBJECT CARD GETS, and what it can do about
 * it.
 *
 * Every row of the inbox above is seeded with a card, because the provider in
 * these fixtures answers one. A deployment whose `card_function` is not
 * registered (or whose provider answered `missing`) sends the envelope's
 * opaque `(type, key)` and NOTHING else, and the strip is then absent — there
 * is no title to print and no url to link to. The host, which holds that
 * catalogue, can print one; this is the line it draws.
 *
 * Deliberately not a prettier card: what is being documented is that the slot
 * is handed the CONVERSATION, so the key on the wire is what reaches it.
 */
const NO_CARD: readonly Conversation[] = DEMO_INBOX.map((row) =>
  row.subject == null
    ? row
    : { ...row, subject: { ...row.subject, card: null, meta_status: "missing" } }
);

const KEYED = inboxDemo(NO_CARD);

function HostSubjectLine(props: { readonly row: Conversation }): ReactElement | null {
  const key = props.row.subject?.key;
  if (key === undefined || key === "") return null;
  return (
    <a href={`/l/${key}`} data-testid="demo-host-subject">
      {`Listing #${key} — resolved by the host`}
    </a>
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
    left: {
      description:
        "«Left» — the exact complement of the tab beside it (stapel-chat 0.8.6 `?left=true`), so a thread is on one of the two and never on both; that is why the pane offers a tab pair and not a switch that would imply a union the endpoint cannot produce. A left row says WHEN it was left, off the row's own top-level `left_at`, and it carries «Return to conversation» instead of the overflow menu whose one entry was the exit already taken. The way back does not ask first: it puts a thread back on one list and takes nothing from anybody, and a confirmation there would be a speed bump on the recovery from a mistake. Note the search field's placeholder: it drops the inbox's «or message», because a left thread's last line is the departure marker and an unlabelled marker draws nothing and is found by nothing.",
      viewport: "phone",
      step: "left",
      render: () => <Panel demo={LEFT} view="left" />,
    },
    "host-subject-line": {
      description:
        "`renderSubject` — the row's own seam, drawn over an inbox whose subject provider answered NO card at all. The default strip reads the conventional card stapel-chat inlines (title, price, photo, url); with no card there is nothing to read and the row went back to saying only who it is with, even though the envelope still carries the opaque `(subject_type, subject_key)` the thread was keyed by. A host holds that catalogue, so it is the one that can turn the key into a line — and the slot is asked about the CONVERSATION, not about a subject this pair could resolve, which is what puts the key within reach. Its answer replaces the default one, `null` included: `null` is «this thread has nothing to show», not an omission to paper over.",
      viewport: "phone",
      step: "host-subject",
      render: () => (
        <Panel
          demo={KEYED}
          renderSubject={(row) => <HostSubjectLine row={row} />}
        />
      ),
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
