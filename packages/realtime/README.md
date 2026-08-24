# @stapel/realtime

The client half of [`stapel-realtime`](../../../stapel-realtime/MODULE.md): one
reconnect/resume WebSocket runtime for the whole fleet, so chat, notifications,
tasks, moderation and the video lobby stop each writing their own socket with
their own close-code table.

- **`@stapel/realtime`** — framework-free. Envelope v1, close codes, resume,
  backoff, multiplexing. No React, no design system, no query layer.
- **`@stapel/realtime/react`** — `<RealtimeProvider>`, `useStream`,
  `useRealtimeState`. The only file that touches `@stapel/core`.

Requires backend **`stapel-core >= 0.44.2`** (the WebSocket cookie branch and
its origin gate) and **`stapel-realtime >= 0.1`** (wire v1).

---

## Why this package exists

The pre-substrate client — `chat-react/src/realtime/chatSocket.ts` — was well
built for a protocol the backend no longer speaks, and it got four things wrong
that together put a whole product on polling for months:

| Defect | What it looked like | What this package does |
|---|---|---|
| 4401 treated as terminal | chat "worked", refreshing on a 15 s timer | 4401 → session refresh → ONE reconnect → a **visible** refusal |
| no `pong` | a reconnect + full replay every 35 s | answers every server `ping` immediately |
| one `seq` for two jobs | edits and tombstones silently dropped on resume | `envelopeSeq` (resume cursor) and `payloadSeq` (ordering key) are different fields |
| a six-attempt retry budget | fell back to polling and said nothing | no budget; `reconnecting` is a first-class state a skin must render |

---

## Quick start

```tsx
import { RealtimeProvider, useStream, useRealtimeState } from "@stapel/realtime/react";

// One socket per stream — the shipped v1 topology. `socket_path` comes off the
// module's own REST rows, so nothing here guesses at a module's routing.
<RealtimeProvider url={(stream) => `${wsOrigin}/ws/chat/${idOf(stream)}`}>
  <Thread />
</RealtimeProvider>;

function Thread(): ReactElement {
  const { status, send } = useStream("chat:conv:7ad1c0de", {
    // The highest ENVELOPE seq you hold — NEVER payload.seq.
    lastSeq: () => cache.cursor,
    onFrame: (frame) => {
      if (frame.type === "replay" || frame.type === "live") {
        cache.upsert(frame.payload);   // by message_id, sorted by payloadSeq
        cache.cursor = frame.envelopeSeq ?? cache.cursor;
      }
      if (frame.type === "resync") void refetchHistory();
    },
  });
  return <ThreadSkin state={status.state} refusal={status.refusal} reason={status.reason} />;
}
```

A shell indicator reads the aggregate:

```tsx
const { connected, reconnecting, refused, refusal, reason, cursors } = useRealtimeState();
```

`RealtimeProvider url="wss://host/ws/mux"` (a plain string) puts **every**
stream on ONE socket, routed by `envelope.stream`. Same code path; the shipped
server serves one stream per socket, so today you pass a resolver.

---

## The two sequences

`stapel-chat/MODULE.md`: *the envelope's `seq` is `rev_seq` — a resume cursor;
the payload's `seq` is the message's place in the thread — the sort key.*

They are two fields here, on purpose:

```ts
frame.envelopeSeq  // resume cursor → hello{last_seq}
frame.payloadSeq   // ordering key → sort, never resume
```

An edit or a tombstone re-arrives with its **existing** `payloadSeq` and a
**new** `envelopeSeq`. Resuming on the ordering key drops every one of them, and
upserting by position rather than by `message_id` renders a tombstone as an
empty bubble. Upsert by id; sort by `payloadSeq`; resume by `envelopeSeq`.

---

## Close codes, and the three answers

| Code | Disposition | Refusal kind |
|---|---|---|
| 4401 | `reauthenticate` — refresh, reconnect once | then `session` |
| 4403 **pre-accept** | one delayed retry, then hold | `origin` |
| 4403 **on an open socket** | terminal | `forbidden` |
| 4404 | terminal | `stream_unknown` |
| 4410 / `kick` frame | terminal | `revoked` |
| 4400 / 4408 / 4413 / 4503 / 1006 / 1012 | backoff + full jitter, forever | — |

**4403 is two failures wearing one number.** Core's origin gate refuses the
handshake in ASGI middleware *before* `websocket.accept`, so the socket never
opens; `authorize()` refuses one stream on a socket that was accepted (and
sends `error{code=unauthorized}` first). "Did this socket ever open" is the one
honest signal, and it is what the client splits on. An `origin` refusal is a
deployment misconfiguration identical for every user — it never spends a session
refresh, and it retries once and then holds so an operator actually sees it.

---

## Deployment notes for the socket half

Two settings decide whether a browser can open the socket at all. Both live on
the backend; getting either wrong shows up here as a refusal, not as a bug in
this package.

- **`STAPEL_WS_ALLOWED_ORIGINS`** — exact origins **including the port**
  (`https://app.example.com`, `http://localhost:5173`). It **fails closed**: an
  empty or unset allowlist refuses every cookie-authenticated handshake with
  4403, which this client reports as `refusal: "origin"`. A cookie is ambient
  authority — the browser attaches it to a handshake started by any page on the
  internet, and WebSockets get neither same-origin protection nor CORS — so the
  allowlist is what stands between the deployment and Cross-Site WebSocket
  Hijacking. It is not optional and it is not a wildcard.
- **`JWT_COOKIE_SAMESITE`** — must be `None` **with `Secure`** when the socket
  host is cross-site from the page (an API on `api.example.com` serving a page
  on `app.example.com`). Under the default `Lax` the browser simply does not
  attach the cookie to that handshake, and every connection closes 4401 while
  the session is perfectly valid. Same-site deployments should stay on `Lax`.

**Token rotation is not this socket's job.** When core's cookie branch re-mints
an access token during the handshake it puts it in
`scope["stapel_refreshed_access_token"]`; `stapel-realtime` does not forward it
in any frame (checked against 0.4.x). The fresh cookie therefore arrives on the
next ordinary HTTP call, which the pair's REST traffic makes anyway. Nothing
here reads a token, and nothing here should start.

---

## Authentication, and the test that was missing

A browser cannot set a header on `new WebSocket()`. The default transport opens
the socket with the **URL and nothing else**: no `Authorization`, no `?token=`,
no subprotocol. Cookies ride the handshake because the browser puts them there.

A non-browser host that holds a token passes
`bearerSubprotocols(token)` as `protocols` — core's channel 2. A token in the
query string is supported by the server and deliberately not offered here:
query strings land in proxy access logs.

`test/handshake.test.ts` asserts the browser shape, because the smoke test that
sent an `Authorization` header proved nothing about the only path that mattered.

---

## Ephemeral vs journal

Frame kind is **structural**: `envelopeSeq` present ⇒ a journal frame
(`replay`/`live`); absent ⇒ ephemeral. There is no mode flag to get wrong, and
an ephemeral frame can never move a resume cursor — if a module ever attaches a
`seq` to a signal, it is delivered and the cursor is left alone.

A signal travels under the module's **own** type (`chat.read`,
`recordings.status`) and reaches `onFrame` verbatim.

Signals guarantee nothing: delivery only to sockets connected at emit time, no
history, no retry, no receipts. State that cannot be recovered by a REST request
must not travel on one.

---

## Writes

Writes go over REST. `useStream().send(type, payload)` exists for the one
documented legacy exception — chat's
`send`/`edit`/`delete`/`read`/`delivered`/`activity` — so a pair does not
hand-roll a second envelope beside this one.

---

## Testing against it

Inject a transport: `webSocket`, `schedule` and `random` are all injectable, and
`test/fakeServer.ts` in this package carries a fake that reproduces
`ResumableStreamConsumer` (welcome/replay/replay_done, the resync verdict, the
`seq` dedup, and the 4408 it closes with when no `pong` comes back).
