---
"@stapel/realtime": minor
---

New package: the client half of `stapel-realtime`, wire v1.

One reconnect/resume WebSocket runtime for the whole fleet, so chat,
notifications, tasks, moderation and the video lobby stop each writing their
own socket with their own close-code table. Framework-free at the root;
`@stapel/realtime/react` adds `<RealtimeProvider>`, `useStream` and
`useRealtimeState` and is the only file that touches `@stapel/core`.

What it fixes, relative to the pre-substrate client it supersedes
(`chat-react/src/realtime/chatSocket.ts`, built for a protocol the backend no
longer speaks):

- **4401 is no longer terminal.** In cookie mode it means the session is stale:
  single-flight refresh through core's `SessionManager` seam → ONE reconnect →
  `sessionLost()` and a refusal a person can SEE. A refresh that reached no
  verdict (`session:refresh-unavailable`) backs off instead of signing the user
  out.
- **The heartbeat is answered.** Every server `ping` gets an immediate `pong`,
  so 4408 stops firing every 35 seconds and taking a full replay with it.
- **The two sequences are two fields.** `envelopeSeq` is the resume cursor
  (`hello{last_seq}`), `payloadSeq` is the module's ordering key. Conflating
  them is what silently dropped every edit and every tombstone on resume.
- **4403 is split into the two failures it actually carries.** Pre-accept it is
  core's origin gate — a deployment misconfiguration, reported as
  `refusal: "origin"`, retried once and then held, and never charged to the
  session. On an accepted socket it is `authorize()`, reported as `forbidden`
  and terminal.
- **No attempt budget.** `reconnecting` is a first-class state a skin must
  render; a client that quietly gives up and lets the pair fall to polling is
  indistinguishable from a working one.

Also: multiplexing several module streams over one socket (routed by
`envelope.stream`, `hello` per stream) with the shipped socket-per-stream
topology as the same code path at group size one; `resync` as a state rather
than an error; ephemeral frames that can never move a resume cursor.

Requires backend `stapel-core >= 0.44.2` (the WebSocket cookie branch and its
origin gate) and `stapel-realtime >= 0.1`.
