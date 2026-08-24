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

## The gate before the click, and the door beside the reason

`POST /conversations/` is `IsAuthenticated`. Until 0.3.0 `StartDirectChat`
blocked only on the two seller-shaped reasons (no seller on the listing; the
listing is your own), so a visitor pressed the button and got a 401 — a
refusal delivered at the one moment it is useless.

The mandate axis is now the FIRST arm of that `firstBlock`, read through core's
`MandateSource` seam and never derived here (a storefront's derivation is "is
there a session?", a tenant app's is `@stapel/workspaces-react`'s). Four of the
five `matchMandate` arms behave as expected; the fifth is a deliberate
exception:

| arm | outcome |
|---|---|
| `member` | available |
| `guest`, `anonymous` | blocked — `chat.start.blocked.sign_in` |
| `asking` | blocked — `chat.start.blocked.mandate_unknown` ("still asking", not "you may not") |
| `unavailable` | **available** |

`unavailable` is what core answers outside a `<MandateProvider>` too, so
refusing there would take the button away from every host that never wired the
axis — and "we could not ask" is not "you may not" (the storefront spec's own
§7.4 negative leg). If the guess is wrong, the module answers 401 exactly as it
did before.

`<StartChatButton signIn={…}>` renders the way out next to that sentence.
`SignInCta` is core's (`{href}` or `{onSignIn}`, never both) so the prop is
spelled identically in `@stapel/reviews-react` and `@stapel/listings-react`;
the LABEL is this pair's (`chat.start.sign_in`, in all three locales), because
core floors only `en` and `ru`.

## The credential channel, and why the socket has one at all

A browser cannot set an `Authorization` header on `new WebSocket()`. There is
no options bag and no interceptor: the constructor takes a URL and a
subprotocol list. So a pair whose REST calls carry a bearer token and whose
socket is opened with `new WebSocket(url)` is not sending a weaker credential
— it is sending none, and every handshake closes 4401. That is not
hypothetical; it is why this pair polled in production while its sockets were
reported done.

`realtime.credential` names what goes on the handshake, read afresh at every
connect (`realtime/credential.ts`), mirroring the four channels
`stapel_core.django.jwt.channels` reads:

| channel | what is constructed | notes |
|---|---|---|
| `cookie` (default) | `new WebSocket(url)` | the browser attaches its httpOnly JWT cookie itself. Ambient, so the backend admits it only from an allow-listed `Origin` (`STAPEL_WS_ALLOWED_ORIGINS`); an unlisted origin closes **4403**, not 4401 |
| `subprotocol` | `new WebSocket(url, ["bearer", token])` | preferred for a bearer host: not ambient, and not written to access logs |
| `query` | `…?token=<encoded>` | works everywhere, lands in every proxy log |
| header | — | **impossible from a browser.** Present in the backend for service-to-service clients |

## Close codes: three answers, one place

`realtime/closePolicy.ts` is the only file that reads a close code, and it
answers one of three things — `reconnect`, `renew-credential`, `stop`.

| code | action | what the person is told |
|---|---|---|
| 4400 protocol error | stop | `unsupported` — this build needs a deploy |
| **4401 unauthenticated** | **renew-credential** | `renewing_credential`, then `sign_in_required` if the renewal is refused |
| 4403 forbidden | stop | `forbidden` (rights, or an unlisted origin) |
| 4404 unknown stream | stop | `forbidden` |
| 4408 heartbeat / 4413 overflow / 4503 no data home | reconnect | `reconnecting` |
| 4410 revoked | stop | `forbidden` |
| anything else (1006, 1001, …) | reconnect | `reconnecting` |

4401 used to be terminal here. It is the load-bearing correction: 4401 is a
statement about the CREDENTIAL, and a credential can be renewed. Wire
`realtime.renewCredential` to core's `SessionManager.refresh()` and map its
three outcomes onto `renewed` / `refused` / `unavailable` — the third is a
FAULT, not a logout, for the same reason core split it out (a 502
mid-redeploy must not sign anyone out).

## A degraded transport is never silent

`useChatFreshness` (and both headless bags) returns `degraded: ChatDegraded |
null` beside `transport`. `transport: "polling"` alone was true and useless —
it read the same whether the deployment has no sockets, the credential was
refused, or the retry budget ran out, and "Refreshing every few seconds" was
read as a product decision for months. Every reason
(`reconnecting` / `renewing_credential` / `sign_in_required` / `forbidden` /
`unsupported` / `unreachable` / `no_socket`) carries its own i18n key in all
three locales, and `<ConversationThreadPanel>` renders it in place of the
plain transport label.

## Extension seams (frontend-standard §7)

- The client is injected via `<ChatProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- The socket transport is injected: `createChatRuntime({ realtime: { webSocket } })`
  takes any factory with `send`/`close` plus four callbacks, plus the
  subprotocol list. A wrapper that drops that list un-authenticates every
  handshake — it must refuse the socket rather than open an anonymous one.
  Injecting it in a TEST hides the credential channel entirely, which is what
  `test/handshake.test.ts` exists to stop.
- `realtime.socketUrl: null` turns the socket half off for a deployment that has
  no sockets (WSGI, no channel layer). Everything keeps working on the timer —
  and now SAYS so (`degraded.reason === "no_socket"`).
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
