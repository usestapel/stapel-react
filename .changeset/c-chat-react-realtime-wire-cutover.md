---
"@stapel/chat-react": minor
---

**The wire cutover: chat's realtime works again.** This pair's socket half
implemented stapel-chat's own pre-0.3.0 protocol, and stapel-chat 0.3.0 deleted
it. Run this pair's decoder against the frames a 0.6 server actually sends and
every one of them came back `null` — `live`, `replay`, `welcome`, `ping`,
`resync`. So no message ever arrived over the socket; the heartbeat was never
answered, so the server closed 4408 every 35 s; the retry budget drained; and
the pair fell to polling and stayed there, telling the person "Refreshing every
few seconds" while reporting that websockets were done. That is the defect the
owner met on a live product.

`src/realtime/chatSocket.ts`, `closePolicy.ts` and `credential.ts` — 715 lines
and ~50 socket tests — are **deleted**. The wire is now `@stapel/realtime`, one
reconnect/resume runtime for the fleet: the v1 envelope, resume by cursor, the
replay/live dedup, backoff with full jitter, the shared close-code table, and
the `pong` whose absence caused the 4408 loop.

**BREAKING (pre-1.0, so a minor).**

- **`@stapel/realtime >=0.1.0` is a required peer.** Install it.
- **`ChatRealtimeOptions` changes shape.** `credential` and `renewCredential`
  are gone: a browser cannot put a header on `new WebSocket()`, so the
  handshake is the cookie one (or `protocols` for a non-browser host), and a
  4401 goes to core's single-flight `SessionManager.refresh()`. `socketUrl` is
  now the socket ORIGIN (`wss://host`), not a `/ws/chat/` base — the paths are
  the streams'. Everything else the substrate's client takes (`webSocket`,
  `schedule`, `random`, `now`, `heartbeat`, `reconnect`, `protocols`,
  `session`, `degradation`) passes straight through.
- **The removed exports**, all of them the deleted client's:
  `createChatSocket`, `browserWebSocketFactory`, `canOpenWebSocket`,
  `chatClosePolicy` and the nine `CHAT_WS_CLOSE_*` constants,
  `chatSocketTarget` + `CHAT_WS_BEARER_SUBPROTOCOL` +
  `CHAT_WS_TOKEN_QUERY_PARAM`, `decodeServerFrame`, `parseServerFrame`,
  `CHAT_WS_REPLAY_LIMIT`, `CHAT_WS_RESYNC`, `deriveChatSocketBase`,
  `chatStreamId`, and the types around them (`ChatSocket*`, `Chat*Frame`,
  `ChatClosePolicy`/`ChatCloseAction`/`ChatCloseReason`, `ChatCredential*`,
  `ChatConnectionState`, `ChatReconnectOptions`, `ChatWebSocketFactory`,
  `ChatStreamKey`, `ChatConversationStream`, `ChatInboxStream`).
  The close codes, the frame decoder and the transport are
  `@stapel/realtime`'s now — one table, one implementation. What replaces the
  chat-specific half is `ChatStream` + `chatStreamForConversation` +
  `deriveChatSocketOrigin` + `chatSocketUrlForStreamKey`, and the payload
  readers `readChatMessageFrame` / `readChatMarkerFrame` /
  `readChatActivityFrame` / `readChatInboxFrame`.
- **`ChatDegradedReason` changes.** `renewing_credential` and `unreachable` are
  gone; `never_connected`, `reconnecting_long`, `revoked` and
  `origin_not_allowed` are new. Their i18n keys move with them, in en, ru and
  es.
- **The bags change.** `ConversationThreadBag.connection` is replaced by
  `status` (the substrate's `RealtimeStreamStatus`), and both bags gain
  `reconnect()`; the thread bag gains `socket`.

**The inbox has a socket now.** `ws/chat/inbox` (stream `chat:user:<id>`) has
existed since stapel-chat 0.4.0 while `streams.ts` declared, as a fact about
the backend, that the conversation list had none — so it polled forever, and a
chat that polls its inbox is a polling chat however live the open thread is.
`<ConversationList viewerId={me.id}>` subscribes to it. The id is required
rather than inferred: the route carries no user segment, the server derives the
key from the session, and a client that guessed would open a socket that
silently delivers nothing. Without it the list polls and says `no_socket`.

**The resume cursor is `rev_seq`, not `seq`.** The envelope's `seq` is the
journal cursor; the payload's `seq` is the message's place in the thread.
`hello{last_seq}` now carries `threadLastRevSeq()` — a max over the window,
because editing an old message gives it the newest `rev_seq` while it stays
where it is. Conflating them dropped every edit and every tombstone across a
resume; `applyRevision` folds those in where no anchored refetch can reach
them, over the fields both transports spell identically.

**Chat is the substrate's one documented socket-WRITE exception**, and
`createChatSocketWrites` types all six frames —
`send`/`edit`/`delete`/`read`/`delivered`/`activity` — each carrying a
`client_msg_id` the server echoes back, so a retry after a dropped socket is
one bubble and not two. It is a seam, not the default: `useSendMessage` still
POSTs, because a socket refusal is a protocol code with no i18n key while the
REST answer is the persisted row and a real error envelope.

**Degradation is named, including "configured but never connects".**
`RealtimeState.degradation` gives `never_connected` — the state a deployment
can sit in for months, and the state this pair was in — as a different sentence
from `reconnecting`. The substrate's version was verified against the built
package before being depended on, not assumed.

**The tests stopped lying.** Before `test/handshake.test.ts` was added, all
eighteen of this package's socket tests injected a fake factory standing
exactly where the only `new WebSocket()` call stands, so 100% of them bypassed
the line that decides whether a credential travels — which is how a green suite
coexisted with a chat that had never authenticated a socket, and the shape the
50 tests deleted here still mostly had. Nothing is injected in front of that
seam any more: the double stands at `globalThis.WebSocket` and speaks the real
wire —
`test/chatServer.ts` reproduces `ResumableStreamConsumer` (welcome, bounded
replay, `resync`, `seq` dedup) and `_heartbeat_loop` — including the 4408 it
closes with when no `pong` comes back. `test/wire.test.ts` proves the two
things that were false: a frame the server builds decodes to a message, and
thirty heartbeat windows later it is still the same socket, never reopened.

Also: the conversation list gained the transport tag the thread already had
(one `<TransportTag/>`, so a new degradation cannot be wired into one screen
and forgotten on the other), and the `i18n/ru` size budget rises to 4.5 KB for
the four new named degradations.
