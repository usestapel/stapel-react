---
"@stapel/realtime": patch
---

Name the silence: `degradation`, `everConnected`, and `no_provider`.

A deployment can sit for months with a socket that is **configured and never
usable** — an origin allowlist nobody filled in, an ingress that does not
upgrade the connection, a firewall that swallows the handshake. The socket
opens, nothing answers, nothing ever closes, and the indicator says
"reconnecting…" until the tab is closed. That is true about the retry loop and
false about the product, and it is how a pair ends up on polling with no bug
report to show for it. `reconnecting` being a first-class state was not enough;
the state needed a NAME a person can be told out loud.

Additive on `RealtimeState` (and so on `useRealtimeState()`):

- **`degradation`** — `null` or `{ kind, since, attempts, reason? }` with
  `kind` one of `never_connected` (3 failed attempts **or** 30 s since the
  first attempt, having never opened), `reconnecting_long` (60 s down after
  having been open), `refused` (a server verdict, which outranks both — no
  countdown is held behind one). Thresholds are configurable per client
  (`degradation={{ … }}`) and `DEFAULT_NEVER_CONNECTED_ATTEMPTS`,
  `DEFAULT_NEVER_CONNECTED_MS`, `DEFAULT_RECONNECTING_LONG_MS` are exported.
- **`everConnected`**, **`firstAttemptAt`**, **`lastOpenAt`** — the raw facts
  under it, so a badge can say *since 14:02* instead of *for a while*.
  `reconnecting_long` is timed from the **drop**, never from `lastOpenAt`: an
  hour of healthy uptime must not report as an hour of outage the moment the
  socket blinks.
- **`now`** — an injectable clock, so a threshold is an assertion in a test
  rather than a wait.

The value is derived on read (`getState()` re-derives, keeping snapshot
identity while the answer is unchanged) and pushed to subscribers by a timer,
because the deployment this exists to name produces no events at all: a socket
that is opened and simply never answered would otherwise sit in `connecting`
forever. A client nobody subscribed to holds no timer.

Also: `useStream(key, { optional: true })` reports
`status.state === "no_provider"` when there is no `<RealtimeProvider>` above it
— nothing is retrying, nothing was refused, and no retry button will help, so a
skin must not render it as a socket problem. It is its own type
(`NoProviderStatus`, returned by an overload) rather than a new member of
`RealtimeStreamState`: sockets keep their own union, so every exhaustive
`switch` over `status.state` in the fleet still compiles, and the compiler
refuses to let a missing provider be passed off as a socket state. Without
`optional` the hook still throws, unchanged: a socket hook that silently does
nothing is the failure this package exists to end.

Everything above is additive — no existing type, field, hook or behaviour
changes.
