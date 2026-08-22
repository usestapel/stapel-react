# @stapel/chat-react — module guide

Headless React pair for **stapel-chat**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## The one thing to understand first: the transport seam

stapel-chat can deliver the same journal two ways — the REST history, and its
own resumable WebSocket protocol (`ws/chat/<uuid:conversation_id>`, exported by
`stapel_chat.routing` since 0.2.2). This pair wires **both**, behind one hook,
and no component above that hook can tell which is running:

```
useChatFreshness(streamKey, mapToQueryKeys, { fallbackRefetchInterval })
    ├── socket  → hello{last_seq} → welcome → replay… → replay_done → live
    │              frames, seq-deduped; error{resync} → re-hydrate
    └── polling → a visibility-aware tick, exponential backoff on failures
```

Both ends do the same thing with what they learn: **refetch the thread query**,
whose query function advances the window BY SEQ
(`GET …/messages?direction=prev&anchor=<tip>`). A socket frame does not carry
its payload into the cache — it says "there is something after your tip" and
the store goes and gets it. That is why the screens, and their tests, are
written once.

Writes never go over the socket. The `send` frame is typed (a mirror must be
complete) and never emitted: its refusals carry socket-local codes
(`empty`, `too_long`, …) that are not in the module's error registry, so they
have no i18n key and no remediation. `POST …/messages` answers with the
persisted row and a real error envelope.

**When `@stapel/realtime` phase 1 lands**, `src/flows/freshness.ts` is the whole
migration: `createChatSocket` goes away, `useSignalInvalidate` takes its place,
and this pair's tests must stay green with no edits. Nothing above that file
imports `realtime/`, so the blast radius is checkable rather than promised.

## Layers

- **api/** — `createChatApi(client)`; types alias the generated
  `components["schemas"]` from stapel-chat's own `docs/schema.json` (never
  parallel hand-written bodies). The support-operator half of the module
  (`/support/queue`, assign / resolve / reopen) is deliberately absent — it is
  an operator console, not the buyer-and-seller surface. `api/extensions.ts`
  records the one request field that is NOT exposed and why.
- **realtime/** — the protocol, typed (`frames.ts`), the resumable client
  (`chatSocket.ts`), and the stream keys plus the URL rule (`streams.ts`). No
  React, no `@stapel/core`: plain protocol the substrate can subsume.
- **model/** — `chatQueryKeys` (one factory, `["chat"]` namespace),
  `createChatRuntime` (which also resolves WHERE the socket is),
  `threadWindow.ts` (the merge rules — the store's real logic, pure and
  directly testable), `readMarker.ts`, queries and mutations.
- **flows/** — the transport seam (`freshness.ts`) and the error fold. The flow
  REGISTRY is a zero-flow shim: stapel-chat annotates no `@flow_step`, and its
  multi-step-ness lives in the transport, not in a server-declared funnel.
- **headless/** — render-prop components: `<ConversationList>`,
  `<ConversationThread>`, `<MessageComposer>`, `<StartDirectChat>`, plus
  `<ChatProvider>`. shadcn-copyable (frontend-standard §7).
- **default/** — the opt-in antd skin (`@stapel/chat-react/default`).
- **i18n/** — `CHAT_I18N_KEYS` + en bundle; the generated backend error bundle
  is merged in so every `error.*` code has a fallback. See "Localization" below
  for the one thing that is unusual here.
- **nav/** — one MEMBER entry (`chat.conversations`). The thread route is not a
  menu destination and is mounted by the container under its own `:id` child.

## The thread store, in three rules

1. **`seq` is the order.** Gapless and total; ordering by `created_at` is an
   upstream anti-pattern. Every merge sorts, dedupes and detects holes by seq.
2. **A window is contiguous or it is rebuilt.** A tail page that does not touch
   the tip (or that the paginator flags as truncated with `has_prev`) is a
   hole; the window is re-read from the newest page rather than stitched. That
   is the REST twin of the socket's `error{resync}`.
3. **The same row can arrive twice** — the sender's own REST answer and the
   socket's fan-out of it. `mergeMessage` drops a seq the window already holds,
   which is what makes both paths idempotent.

## Localization — the twelve keys this pair owns

stapel-chat ships **English only**: it has no `translations/` directory, so its
12 error keys cannot appear in any locale catalogue upstream. `gen:errors` runs
for this pair with `ERRORS_LOCALE_EXEMPT_OWNERS=stapel_chat` and
`ERRORS_CATALOG_DIR` pointed at stapel-core's catalogue: the 42 cross-cutting
keys come from core in ru/es (typed `Partial`, so the gap is visible to
TypeScript), and the pair authors the 12 chat-owned texts in
`src/i18n/{ru,es}.ts` beside its UI copy. `test/i18n.test.ts` proves every
registry code resolves to a sentence in all three locales. When upstream ships
`translations/errors.{ru,es}.json`, those twelve lines are deleted and the
generated bundle covers them — the keys and the texts do not move.

Unlike notifications-react, the `es` subpath here carries hand-written UI copy
too: a marketplace's buyer-to-seller chat is the surface where a half-translated
screen shows most.

## Extension seams (frontend-standard §7)

- The client is injected via `<ChatProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- The socket transport is injected: `createChatRuntime({ realtime: { webSocket } })`
  takes any factory with `send`/`close` plus four callbacks, which is how the
  tests drive the protocol frame by frame without a network.
- `realtime.socketUrl: null` turns the socket half off for a deployment that has
  no sockets (WSGI, no channel layer). Everything keeps working on the timer.
- The headless layer is fully replaceable (copy-and-own); the antd skin is a
  separate entry point nobody has to import.

## Not in this version

- **Attachments.** `SendMessageRequest.attachments` exists on the wire; wiring
  it means wiring CDN upload rights into chat, and a control that is visible
  but does nothing is worse than one that is absent.
- **The support console.** `/support/queue`, assign / resolve / reopen — an
  operator surface, not this one.
- **A thread scoped to a listing.** `CreateConversationRequest.scope_key` is
  ignored by the server (it resolves the scope itself), and a direct thread is
  keyed by the participant PAIR — so buyer↔seller is one conversation across
  every listing. A host that wants the listing named says so in the first
  message.
