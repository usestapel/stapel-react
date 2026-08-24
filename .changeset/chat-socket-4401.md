---
"@stapel/chat-react": minor
---

4401 is not terminal, and a closed socket no longer becomes a silent polling
loop.

The owner opened a chat in production: Enter did not send, and the screen said
it updates every few seconds. The pair read close code 4401 as a permanent
refusal and stopped retrying, then fell through to polling — quietly. A silent
fallback is what let "websockets are done" stand as a claim for months, because
nothing on screen and nothing in the bag ever said otherwise.

**The close code is read in one named place** (`realtime/closePolicy.ts`), and
it has three actions rather than two. 4401 now routes once through
`renewCredential` — core's `SessionManager.refresh()` seam — and keeps core's
three outcomes apart: renewed reconnects with the NEW credential, refused stops
and surfaces as `sign_in_required`, and refresh-unavailable is a FAULT and
backs off rather than signing anyone out. One renewal per socket, reset by a
successful handshake. 4400/4403/4404/4410 stop; 4408/4413/4503 and every
unknown code reconnect with backoff.

**Degradation is named and visible.** Both headless bags and `useChatFreshness`
return `degraded: {reason, attempt, messageKey} | null` beside `transport`,
over seven named reasons — including `no_socket`, so a deployment that will
poll forever now SAYS it polls forever instead of merely doing it. The default
thread panel renders it.

`ChatSocketRefusal.not_participant` is renamed `forbidden`: 4403 also means
"origin not allow-listed", and the old name asserted one of the two causes.
`CHAT_WS_CLOSE_NOT_PARTICIPANT` stays as a deprecated alias.

**And the tests now go through the credential channel.** Every one of the
package's 18 socket tests injected a factory that stands exactly where the only
code that calls `new WebSocket()` stands — so the credential channel was
bypassed in 100% of them, which is why nothing caught this. That is the mirror
image of the backend's own smoke test, which passed an `Authorization` header a
browser cannot set on a WebSocket. A new suite constructs through the real path
against a `globalThis.WebSocket` stand-in and asserts on what the client
BUILDS: the url, and the subprotocols.
