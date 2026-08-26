# @stapel/chat-react — module guide

Headless React pair for **stapel-chat**. This is the human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog).

## The one thing to understand first: the transport seam

stapel-chat can deliver the same journal two ways — the REST history, and two
WebSocket streams on `stapel-realtime`'s wire. This pair wires **both**, behind
one hook, and no component above that hook can tell which is running:

```
useChatFreshness(stream, mapToQueryKeys, { fallbackRefetchInterval })
    ├── socket  → @stapel/realtime: hello{last_seq=rev_seq} → welcome →
    │              replay… → replay_done → live; resync → re-hydrate
    └── polling → a visibility-aware tick, exponential backoff on failures
```

Both ends do the same thing with what they learn: **refetch the thread query**,
whose query function advances the window BY SEQ
(`GET …/messages?direction=prev&anchor=<tip>`). A socket frame does not carry
its payload into the cache — it says "there is something after your tip" and
the store goes and gets it. That is why the screens, and their tests, are
written once.

There is exactly one exception, and it is forced by the wire: an edit or a
tombstone re-arrives with its EXISTING `seq` and a new `rev_seq`, so no
anchored refetch can reach it. Those are applied in place
(`threadWindow.applyRevision`) over the fields whose shape both transports
agree on — body, the edit/delete marks, `rev_seq`. Not `attachments`: REST
renders them (`attachment_to_dto`) and the socket sends the raw stored
descriptors, which is also why a new message still arrives over REST.

## The wire, and the cutover that got us onto it

> **This section used to be a warning.** It said, correctly, that the socket
> half did not work against any released backend: `src/realtime/` implemented
> stapel-chat's own pre-0.3.0 protocol (flat `{type:"message", seq}` frames, a
> bare `hello{last_seq}`, `error{resync}`), and **stapel-chat 0.3.0 deleted
> that protocol**. Run against the frames a 0.6.0 server actually sends, this
> pair's own decoder returned `null` for every one of them:
>
> ```
> live -> null   replay -> null   welcome -> null   ping -> null   resync -> null
> ```
>
> So no message ever arrived; `ping -> null` meant the heartbeat was never
> answered, the server closed 4408 every 35 s, the retry budget drained, and
> the pair polled forever while reporting "websockets are done". That is the
> defect the owner met in production.

The cutover is done. `src/realtime/chatSocket.ts`, `closePolicy.ts` and
`credential.ts` — 715 lines of client, and their ~50 socket tests — are
**deleted**. The wire is `@stapel/realtime`'s, one implementation for the
fleet, and what is left in `src/realtime/` is the part only chat can know:

| what | where | source of truth |
|---|---|---|
| the two stream keys and their mounts | `realtime/streams.ts` | `stapel_chat/realtime.py`, `routing.py` |
| chat's payloads and its six write frames | `realtime/frames.ts` | `stapel_chat/realtime.py::message_payload`, `consumers.py` |
| the named degradations a person is shown | `realtime/degradation.ts` | this pair |

### The two streams

| stream key | socket path | kind |
|---|---|---|
| `chat:conv:<conversation_id>` | `ws/chat/<conversation_id>` | journal — resumable by `rev_seq` |
| `chat:user:<user_id>` | `ws/chat/inbox` | ephemeral — nothing to resume |

The inbox socket has existed since stapel-chat 0.4.0 and `streams.ts` declared,
as a fact about the backend, that it did not. It is wired now:
`<ConversationList viewerId={me.id}>` subscribes to it. The id is a REQUIRED
argument rather than something inferred, because the route carries no user
segment — the consumer derives the key from the authenticated scope, and a
client that guessed would open a socket that silently delivers nothing. A list
with no `viewerId` polls and says `no_socket`.

### The two sequences, which are not the same number

`envelope.seq` is the message's `rev_seq` — the RESUME CURSOR, bumped by every
edit and every delete. `payload.seq` is its place in the thread — the SORT KEY,
immutable. The old client sent `threadLastSeq()` as `hello{last_seq}`, which
asked the server to replay from a revision number that had nothing to do with
what the client held. The cursor is now `threadLastRevSeq()` — a MAX over the
window, not the last element, because editing an old message gives it the
newest `rev_seq` while it stays where it is.

### Writes: the substrate's one documented exception

The fleet rule is that writes go over REST. Chat is the exception, deliberately
(`stapel_chat/consumers.py`: *"a compose box whose Enter key takes a different
transport than the messages it produces is the seam where 'realtime was built'
stops being true"*). `model/socketWrites.ts` types all six frames —
`send`/`edit`/`delete`/`read`/`delivered`/`activity` — each carrying a
`client_msg_id` the server echoes back, so a retry after a dropped socket
reconciles into one bubble instead of two.

It is a seam, not the default. `useSendMessage` still POSTs, because a socket
refusal is a socket-local code (`empty`, `too_long`, `send_refused`, …) that is
not in the module's error registry and therefore has no i18n key and no
remediation, while `POST …/messages` answers with the persisted row and a real
error envelope.

### What the substrate owns now, and what that bought

Everything that used to live in this package's 715 deleted lines: the v1
envelope, resume-by-cursor, the replay/live dedup, exponential backoff with
full jitter, the fleet close-code table, and — the one that mattered most —
**the `pong`**. Plus three things this pair did not have:

- **4403 is split.** Core's origin gate refuses BEFORE `websocket.accept`;
  `authorize()` refuses a stream on a socket that was accepted. They are
  different failures with the same number, and now different words: an
  operator's `STAPEL_WS_ALLOWED_ORIGINS` versus a person's rights.
- **No attempt budget.** The old client stopped after six tries and reported
  `unreachable`. `reconnecting_long` replaces it: still trying, and saying so.
- **`degradation`.** See below.

## The credential channel — now the substrate's, and still the same fact

A browser cannot set an `Authorization` header on `new WebSocket()`. There is
no options bag and no interceptor: the constructor takes a URL and a
subprotocol list. So a pair whose REST calls carry a bearer token and whose
socket is opened with `new WebSocket(url)` is not sending a weaker credential —
it is sending none, and every handshake closes 4401. That is not hypothetical;
it is why this pair polled in production while its sockets were reported done.

`@stapel/realtime`'s transport opens with **one argument**, and the browser
attaches its httpOnly JWT cookie itself (core's channel 4, admitted only from
an allow-listed `Origin`; an unlisted one closes 4403, not 4401). A non-browser
host passes `protocols: bearerSubprotocols(token)`. The `?token=` channel core
also accepts is deliberately NOT offered: query strings land in every proxy
access log.

`realtime.credential` and `realtime.renewCredential` are gone from
`ChatRealtimeOptions` with the client that needed them.

## 4401 is not terminal — three outcomes, kept apart

4401 is a statement about the CREDENTIAL, and a credential can be renewed. The
substrate reads it as `closeDisposition === "reauthenticate"` and hands it to
core's ACTIVE `SessionManager` (adopted by `<RealtimeProvider>`), which is the
same single-flight refresh the HTTP client already coalesces its 401s into —
N sockets that all see 4401 in one second produce ONE refresh. The three
outcomes stay three (`test/session.test.tsx`):

| core's `RefreshOutcome` | what the socket does | what the person sees |
|---|---|---|
| a status (renewed) | reconnect at once, no backoff | nothing — it comes back |
| `REFRESH_UNAVAILABLE` (no verdict) | back off and retry; session untouched | `reconnecting` |
| `null` (the server answered) | stop | `sign_in_required` |

The one-shot renewal is re-armed on `welcome`, so a token that expires an hour
into a live socket renews again; a second 4401 with no `welcome` between them
is the verdict, not a renewal loop.

The WINDOW before any of those three lands has a name of its own now —
`renewing_credential`, debounced so a healthy refresh never shows it, and
outranked by every one of the three the moment it arrives. It is a question,
not a fourth outcome; see below and `test/refreshWindow.test.tsx`.

## A degraded transport is never silent

`useChatFreshness` (and both headless bags) returns `degraded: ChatDegraded |
null` beside `transport`. `transport: "polling"` alone was true and useless —
it read the same whether the deployment has no sockets, the credential was
refused, or the retry budget ran out, and "Refreshing every few seconds" was
read as a product decision for months.

| reason | what it means | who acts |
|---|---|---|
| `reconnecting` | it dropped; a retry is scheduled | nobody — wait |
| **`renewing_credential`** | a 4401 is inside core's single-flight refresh, and the answer has not landed | nobody yet — it is a question |
| `reconnecting_long` | it worked, went away, and stayed away | nobody, but say so |
| **`never_connected`** | configured, tried, and never once open | an operator |
| `sign_in_required` | 4401 survived a session refresh | the person |
| `forbidden` | `authorize()` said no for this stream | the owner |
| `revoked` | access withdrawn mid-socket (`kick` → 4410) | the owner |
| `origin_not_allowed` | 4403 before accept — the origin allowlist | an operator |
| `unsupported` | 4404, or no `WebSocket` in this environment | a developer |
| `no_socket` | no socket for this stream in this build | the host |

`never_connected` is the state this pair was IN, and it is the reason to take
the substrate's `RealtimeState.degradation` rather than keep a local one: it
distinguishes "your network went away" from "this was never wired up here",
which no amount of watching a spinner can. It was verified against the built
substrate before being depended on (`test/degradation.test.tsx` drives a socket
that never opens, and the substrate's own suite covers it in 11 cases).

One reason from the old vocabulary is gone: `unreachable` meant "the retry
budget is spent", and there is no budget any more.

### `renewing_credential` is back, and this time it is honest

The cutover **dropped** this name, and was right to. The substrate reported a
stream mid-refresh as plain `reconnecting`, so the pair had no way to tell a
credential renewal from a network blip, and a module that cannot know a thing
must not print a sentence claiming it.

`@stapel/realtime` publishes **`RealtimeState.refreshing: { since } | null`**
now — set when a 4401 enters core's single-flight `refresh()`, cleared when it
lands, **for all three outcomes alike**. So the pair reads it, and the name is
back with three properties that keep it truthful:

- **It renders off `refreshing`, never off a state.** The aggregate reads
  `reconnecting` in this window — the substrate makes sure it is never `idle`
  — but `reconnecting` is also what an ordinary drop reads, and those two
  deserve different words. `refreshing` is the only thing that knows which one
  is happening.
- **It is debounced on `since`.** `RENEWING_CREDENTIAL_DEBOUNCE_MS` is **750
  ms**, in one constant in `realtime/degradation.ts` with the reasoning beside
  it: a healthy refresh answers well inside that, and flashing a sentence
  about someone's sign-in for 80 ms is worse than saying nothing. Below the
  threshold the rendering is byte-for-byte what it was before. The hook arms
  ONE timer, from the same constant, for the moment the window crosses it.
- **It never implies an outcome.** `withRenewingCredential` is pure and reads
  only the CURRENT field — no latch, no "was refreshing". An ANSWER outranks
  the question, so it can never speak over `sign_in_required`, `forbidden`,
  `revoked`, `origin_not_allowed`, `unsupported` or `no_socket`; it can only
  sharpen a silence that is already being reported (`reconnecting`,
  `reconnecting_long`, `never_connected`). The moment the field clears, the
  three landings below read exactly as they did before this existed.

The copy is a QUESTION in all three locales — "Checking your session — live
messages are waiting on the answer." — because at the moment it is on screen
nobody knows, and one of the three things it can land on is being signed out.
`test/refreshWindow.test.tsx` pins all of it, including the trap: during the
window there is no socket and no timer, so the seam's own `transport` is
`idle`, whose copy is "Paused" — a person reads that as "all is well" at the
exact moment their credential is being renewed, and the test asserts the tag
says neither that nor "Live".

## Upstream notes (reported, not worked around)

- **`ConversationResponse.stream_key` / `socket_path` are not in the schema's
  `required` list**, though the server populates both on every conversation it
  serves. The generated type therefore makes them optional and every consumer
  must handle an absence the server never produces.
  `chatStreamForConversation` reads them when present and derives when not.
- ~~**A session refresh is invisible to a consumer.**~~ **Fixed upstream.**
  It was true: `@stapel/realtime` reported a stream as `reconnecting` while
  core's refresh was in flight, so a pair could not tell "renewing your
  session" from "the network blipped", and this pair dropped
  `renewing_credential` over it. The substrate now publishes
  `RealtimeState.refreshing: { since } | null` — the question, never an
  outcome — and the name is back, debounced. See above.

## Layers

- **api/** — `createChatApi(client)`; types alias the generated
  `components["schemas"]` from stapel-chat's own `docs/schema.json` (never
  parallel hand-written bodies). The support-operator half of the module
  (`/support/queue`, assign / resolve / reopen) is deliberately absent — it is
  an operator console, not the buyer-and-seller surface. `api/extensions.ts`
  records the one request field that is NOT exposed and why.
- **realtime/** — what only chat can know: the two stream keys and their
  mounts (`streams.ts`), chat's payloads and its six write frames
  (`frames.ts`), and the named degradations (`degradation.ts`). No React and
  no socket — the wire is `@stapel/realtime`'s.
- **model/** — `chatQueryKeys` (one factory, `["chat"]` namespace),
  `createChatRuntime` (which also resolves WHERE the sockets are),
  `socketWrites.ts` (the documented socket-WRITE seam),
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

## The thread store, in four rules

1. **`seq` is the order.** Gapless and total; ordering by `created_at` is an
   upstream anti-pattern. Every merge sorts, dedupes and detects holes by seq.
2. **A window is contiguous or it is rebuilt.** A tail page that does not touch
   the tip (or that the paginator flags as truncated with `has_prev`) is a
   hole; the window is re-read from the newest page rather than stitched. That
   is the REST twin of the socket's `resync` frame.
3. **The same row can arrive twice** — the sender's own REST answer and the
   socket's fan-out of it. `mergeMessage` drops a seq the window already holds,
   which is what makes both paths idempotent.
4. **`rev_seq` is the CURSOR, never the order.** `threadLastRevSeq` is what a
   resume hands back; `applyRevision` is the only thing that may rewrite a row
   already in the window, and it moves nothing. An edit that reordered the
   thread would be the two sequences confused, on screen.

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

## Extension seams (frontend-standard §7)

- The client is injected via `<ChatProvider>` / core's `StapelConfigProvider`
  (per-module override) — pairs never hard-import a client.
- The socket runtime is the host's if it has one: `<ChatProvider>` reuses a
  `<RealtimeProvider>` above it and mounts its own only when there is none, so
  a page that already runs the substrate for notifications or the video lobby
  does not gain a second socket stack. Chat passes its own URL per stream, so
  the host's resolver needs no chat knowledge.
- `ChatRealtimeOptions` is the substrate's client options minus `url` and
  `onState` — `webSocket`, `schedule`, `random`, `now`, `heartbeat`,
  `reconnect`, `protocols`, `session`, `degradation` — so an injected
  transport (React Native, instrumentation) is one seam for the whole fleet
  rather than a per-pair invention.
  **Do not inject `webSocket` in a test that means to cover the handshake.**
  A fake standing exactly where `new WebSocket()` stands cannot see whether a
  credential travelled; eighteen green tests once proved precisely that.
  `test/chatServer.ts` stands at the ENVIRONMENT edge instead, and
  `test/wire.test.ts` drives the real constructor.
- `realtime.socketUrl: null` turns the socket half off for a deployment that has
  no sockets (WSGI, no channel layer). Everything keeps working on the timer —
  and SAYS so (`degraded.reason === "no_socket"`).
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
