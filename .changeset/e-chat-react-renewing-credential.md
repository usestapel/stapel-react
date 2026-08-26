---
"@stapel/chat-react": minor
---

**`renewing_credential` comes back, as a question.** The wire cutover deleted
this named degradation deliberately: `@stapel/realtime` reported a stream
mid-refresh as plain `reconnecting`, so the pair could not tell a credential
renewal from a network blip, and a module that cannot know a thing must not
print a sentence claiming it. The substrate publishes
`RealtimeState.refreshing: { since } | null` now — set when a 4401 enters
core's single-flight `SessionManager.refresh()`, cleared when it lands, for all
three outcomes alike — so the pair can, and does.

`ChatDegradedReason` gains `renewing_credential`, with
`chat.transport.degraded.renewing_credential` in **en, ru and es**. The copy is
a question ("Checking your session — live messages are waiting on the answer."),
because at the moment it is on screen nobody knows the answer and one of the
three things it can land on is being signed out.

**It renders off `refreshing`, never off a state.** The aggregate reads
`reconnecting` in this window, which is also what an ordinary drop reads;
`refreshing` is the only thing that knows which of the two is happening. The
seam's own `transport` flattens to `idle` there — no socket, no timer armed —
and `chat.transport.idle` is "Paused", which a person reads as "all is well" at
the exact moment their credential is being renewed. That is the trap, and
`test/refreshWindow.test.tsx` asserts explicitly that the tag says neither
"Paused" nor "Live".

**Debounced on `since`: `RENEWING_CREDENTIAL_DEBOUNCE_MS` = 750 ms**, one
exported constant with its reasoning beside it. A healthy refresh is one round
trip and lands well inside that; a sentence about someone's sign-in that
flashes for 80 ms is worse than saying nothing. 750 sits above a healthy
refresh even on a slow mobile link (where the round trip alone can be
300–500 ms, so 500 would still flash) and below the ~1 s at which a stalled
screen stops reading as latency and starts reading as broken. `useChatFreshness`
arms one timer, from the same constant, for the moment the window crosses it.

**It never becomes a promise.** `withRenewingCredential` (also exported, for a
host skin that replaces the tag) is pure and reads only the CURRENT field —
no latch, no "was refreshing". An answer outranks a question, so it cannot
speak over `sign_in_required`, `forbidden`, `revoked`, `origin_not_allowed`,
`unsupported` or `no_socket`; it only sharpens a silence already being reported
(`reconnecting`, `reconnecting_long`, `never_connected`). The instant the field
clears, the three landings read exactly as they did before: renewed reconnects
at once, no verdict backs off with the session intact, refused says
`sign_in_required` — each pinned by a test that puts the window on screen
first.

New exports: `RENEWING_CREDENTIAL_DEBOUNCE_MS`, `withRenewingCredential`.
