# @stapel/chat-react

Headless React pair for **stapel-chat** (frontend-standard §2). Business +
state only in the main entry, zero visual opinion — any design layers on top.
Built on `@stapel/core` (typed client + `StapelApiError` envelope, token
refresh, verification-403 interception, i18n engine, analytics seam, TanStack
Query).

Its backend delivers the same journal two ways — the REST history and its own
resumable WebSocket protocol — and this pair wires **both, behind one seam**, so
a deployment with sockets and one without run the same screens. See `MODULE.md`
for the layer map and the seam's replacement criterion.

## Install

```
pnpm add @stapel/chat-react @stapel/core @tanstack/react-query react
```

## Wire the app once

```tsx
import { createI18n, StapelProvider } from "@stapel/core";
import { ChatProvider, createChatRuntime, registerChatI18n } from "@stapel/chat-react";

const runtime = createChatRuntime({
  baseUrl: "/chat/api/v1",
  // Sockets are derived from baseUrl's origin (`/ws/chat/`, the module's
  // canonical mount). On a deployment that has none, say so — it goes
  // straight to polling instead of failing a handshake six times first:
  //   realtime: { socketUrl: null },
});
const i18n = createI18n({ locale: "en" });
registerChatI18n(i18n);

export function Root({ children }: { children: React.ReactNode }) {
  return (
    <StapelProvider client={runtime.client} i18n={i18n} cacheVersion="0.1.0">
      <ChatProvider runtime={runtime}>{children}</ChatProvider>
    </StapelProvider>
  );
}
```

## The inbox

```tsx
import { ConversationList } from "@stapel/chat-react";
import { matchList } from "@stapel/core";

<ConversationList>
  {({ state }) =>
    matchList(state, {
      loading: () => <Spinner />,
      failed: (error) => <ErrorPanel error={error} />,
      empty: () => <p>{t("chat.list.empty")}</p>,
      ready: (rows) => <List rows={rows} />, // rows carry `unread_count`
    })
  }
</ConversationList>;
```

## A thread

```tsx
import { ConversationThread, MessageComposer } from "@stapel/chat-react";

<ConversationThread conversationId={id}>
  {({ state, hasOlder, loadOlder, transport }) => (
    /* `transport` is "socket" | "polling" | "idle" — a LABEL. Nothing about
       the thread's behaviour depends on it; that is the seam's whole point. */
    ...
  )}
</ConversationThread>;

<MessageComposer conversationId={id}>
  {({ value, setValue, availability, send }) => (
    /* `availability` is blocked-with-a-reason or available — a disabled
       control here always has a sentence to show. */
    ...
  )}
</MessageComposer>;
```

The thread replays, then stays live; the read marker advances to the tip while
it is mounted and never moves backwards. Sending is REST — the persisted row
comes back with its `seq` and is folded into the window.

## "Message the seller"

```tsx
import { StartDirectChat } from "@stapel/chat-react";

<StartDirectChat sellerId={listing.seller_id} viewerId={me?.id} onOpened={(c) => navigate(`/account/chat/${c.id}`)}>
  {({ availability, start }) => ...}
</StartDirectChat>;
```

Get-or-create: a direct thread is keyed by the participant pair under a unique
constraint, so pressing twice — or writing to the same seller about a second
listing — lands in the same conversation.

## The antd skin (opt-in)

```tsx
import {
  ConversationListPanel,
  ConversationThreadPanel,
  StartChatButton,
} from "@stapel/chat-react/default";
```

Importing the subpath is the opt-in; consumers who bring their own visuals
never pull `antd` into their bundle.

## Locales

```tsx
import { registerChatI18nRu } from "@stapel/chat-react/i18n/ru";
import { registerChatI18nEs } from "@stapel/chat-react/i18n/es";
```

Opt-in subpaths, so a host that ships one language carries one language. Both
locales are complete over the pair's UI copy and over every backend error code
the module can raise — including the twelve stapel-chat owns and does not
localize upstream (see `MODULE.md`).
