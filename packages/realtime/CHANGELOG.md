# @stapel/realtime

## 0.1.1

### Patch Changes

- ba990ff: Publish a session refresh that is in flight as `refreshing: { since } | null` on `RealtimeState` (and through `useRealtimeState()`).

  A 4401 sends the session through core's single-flight `refresh()`, and for the moment that takes, a shell had nothing to render but a socket that looks broken. The field is set when the 4401 path enters the refresh and cleared when it lands — for renewed, no verdict and refused alike, so it names the question and never an outcome; those three stay where they already live, in `state`/`refusal`. `since` comes from the injectable clock, and the README's debounce advice is to render "renewing your session" only after a threshold has passed, because a healthy refresh answers in well under a second.

  The aggregate `state` follows it: while `refreshing` is non-null it is never `idle`, it is `reconnecting`. The transport is genuinely at rest in that window — socket gone, no retry armed yet — and `idle` is what every consumer renders as "all is well", so the state is derived where `degradation` is derived and `getState()` and subscribers can never disagree about it. A verdict (`refused`) and a torn-down client (`closed`) still win.

  Additive: the `RealtimeConnectionState` union is deliberately untouched, so no exhaustive `switch` over it changes — `reconnecting` is a member it already had.

- f9d8b66: Replace the demos' raw state dump with `demo/LiveBadge.tsx`, the README's connection surface built for real: a coloured dot, one human sentence per state, a labelled Reconnect button only where retrying can change the answer, and the wire envelope moved into a collapsed developer disclosure.

## 0.1.0

### Minor Changes

- 350f61f: New package: the client half of `stapel-realtime`, wire v1.

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

### Patch Changes

- 308e3d6: Name the silence: `degradation`, `everConnected`, and `no_provider`.

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
    under it, so a badge can say _since 14:02_ instead of _for a while_.
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
