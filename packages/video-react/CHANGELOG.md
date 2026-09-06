# @stapel/video-react

## 0.3.3

### Patch Changes

- Five defects between a call connecting and a call working, all proven in jsdom against the storefront's own wiring.

  **A connected call published nothing.** `setMicrophoneEnabled`/`setCameraEnabled` were reached only from `<CallPanel>`'s two toggles, which OPENED drawn as "on" — so a connected call was silent in both directions while both controls said the opposite, and the first thing either person did was press mute (turning the microphone on for the first time) to be heard. The panel now publishes on mount (`autoPublish`, default `true`), microphone and camera requested SEPARATELY and in that order so a refused camera leaves a working voice call, an audio-only call never asks for a camera, and the toggles show what was actually granted. `false` for a host that publishes from its own device picker.

  **The other party's page could end your live call.** `<CallsProvider>` dropped the call for any id another tab said was `resolved`, in any state — so a dismissal arriving after acceptance unmounted a call mid-connect (the stand caught the media session torn down 9 ms after "signal connected"). A dismissal is about a RING and now only applies while the call is ringing, the same guard the `incoming` predicate already carried. And the cross-tab bus is per-ORIGIN, which is not per-person: `CallTabMessage` carries the sender's `user` id and a tab ignores a message about somebody else's call — two accounts on one browser stop dismissing each other. The field is optional, so an older tab's message is treated exactly as before.

  **The stage stranded itself under StrictMode.** Every step of the dial past an `await` is guarded now: unguarded, a development remount let the first run's room be created after the second run's, overwrite the ref with a room nobody is connected to, and leave the stage on "connecting" for the rest of the session — which is every developer's local call. A room created after its own effect was torn down is disconnected rather than left holding a socket.

  **A re-render aborted the connect.** The effect that dials also disconnects in its cleanup, so anything in its dependency list can abort a call that is dialling — and the loader prop was in it, which for a host passing an inline arrow (as every host did while the built-in one was broken) is a fresh identity on every parent render. The dependency list is primitives only now — the address, the token, and the retry counter — with the loader held in a ref, and there is a test for the storefront's own shape: five parent re-renders with fresh object props during a pending connect, one dial, no abort. What may legitimately re-dial is a new address, a new token, or a person pressing retry.

  **`<CallRoute loadPeer>`** is forwarded to the stage it mounts. The seam existed on a component no host mounts directly, so a build that must not see the `livekit-client` specifier could not reach it.

  Measured with dependencies held constant: the `default` bundle 17.74 → 17.91 KB and the main entry 11.16 → 11.24 KB, both inside their ceilings (20 KB / 13 KB).

## 0.3.2

### Patch Changes

- A call that cannot connect stops dialling, and says so with a way out.

  Measured on the stand (`PASS-17`): a misconfigured media URL answered 404, and ONE call issued **129** signalling requests back to back — `GET …/rtc/v1?access_token=`, no gap between them — on both parties' phones, behind a screen that said "connecting" and offered no control of any kind. The only exit was to close the tab, and the call stayed up on the server for both of them.

  - **The dial is bounded and spaced.** `CALL_DIAL_ATTEMPTS` (5) attempts, doubling from `CALL_DIAL_BACKOFF_MS` (0.4s, 0.8s, 1.6s, 3.2s), then the failed screen. Five is enough to ride out a media server restarting; the sixth is a fact about the deployment and belongs on screen rather than in the network log. A half-connected room is disconnected before the next attempt, so the attempts cannot stack sockets.
  - **A refusal that will refuse again is terminal.** 404 ("there is no media server at this address") and 403 ("this token is not welcome here") stop at the first answer — `isTerminalDialFailure` is exported so a host wiring its own stage classifies them the same way. Timeouts, dropped sockets and 5xx still get their attempts.
  - **The loop itself is closed.** `loadPeer` was a dependency of the dialling effect, an inline arrow is a new identity on every render, and every dial causes a render — which is how five attempts became a hundred and twenty-nine. The loader is held in a ref now; what re-dials is a new token, a new server, or a person pressing retry.
  - **Both stuck screens gained the way out.** The connecting state now carries hang up (it disconnects and reports to the host, which is what ends the call on the server), and the failed state carries it beside the retry — a retry is not an exit, and a call that cannot connect is still ringing somebody with the meter running.

  Measured with dependencies held constant: the `default` bundle 17.60 → 17.74 KB, inside its 20 KB ceiling.

## 0.3.1

### Patch Changes

- A call that can actually load its SDK, and an audio-only call you can hear.

  **The peer import is a literal again.** `<CallStage>` held the specifier in a `string`-typed constant so TypeScript would not resolve a package a host may not install. What it bought was a call that could never connect: `import(someString)` is invisible to every bundler, so no chunk was emitted and the browser was left to resolve a BARE specifier at runtime, which browsers do not do. Hosts that HAD `livekit-client` installed, and had done nothing wrong, got the designed absence screen — "video is not available" — on every call. The import is now written out, so bundlers split it into its own chunk fetched at the moment a token exists; `loadPeer` is the documented override for a host whose build must not see the specifier, and the `missing` arm still catches a load that fails at runtime. A test reads the module source, because every other test in that file injects `loadPeer` and therefore cannot see the loader that ships.

  **The audio-only arm mounts the host's remote media.** It drew a card with the caller's name INSTEAD of calling `renderRemote`, so on an audio-only call there was no element for the remote audio track to attach to — a silent call, on the one kind of call that is nothing but audio. `renderRemote` is now called in both arms and told which one is asking (`{ audioOnly }`, forwarded by `<CallRoute>` too); in the audio-only arm what comes back is mounted in a one-pixel sink behind the card, present in the layout rather than `display: none`, because a media element in a hidden subtree is exactly what a browser may stop feeding. The card is what a person sees; the sink is what they hear.

  Measured with dependencies held constant: the `default` bundle 17.35 → 17.60 KB, inside its 20 KB ceiling.

## 0.3.0

### Minor Changes

- 1:1 calls: the ring, mounted once, for the whole app.

  Generated against stapel-video **0.11.0** — seven paths under `/video/api/v1/calls` and six `video_call_*` codes, whose ru/es texts this pair authors because the module ships no `translations/` of its own.

  **`<CallsProvider>` goes at the app root, not in a thread.** A call arrives while the person is doing something else; that is the only case there is. `<LiveCallsProvider>` (from `/default`) is the same provider with the realtime subscription attached, `<IncomingCallOverlay>` draws the ring over whatever page is underneath — full frame on a phone, a card on a desktop — and `useCalls()` / `useIncomingCall()` are there for a host that draws its own.

  **Three numbers come from the server and are never recomputed here.** `duration_seconds` (subtracting two ISO strings in a browser disagrees with the thread's own call line the moment a clock is off), `expires_at` (the countdown runs against the server's deadline, not against a fresh 45 seconds started when the frame arrived), and the call row itself (an `incoming` frame carries six fields against the row's thirteen, so a frame triggers a re-read rather than a synthesised state).

  **`GET /calls/active` on mount and on every realtime reconnect.** The ring stream is best-effort by contract, so a lost `call.incoming` is a call that never rang and a lost `call.ended` a ring that never stops. The re-read is what makes both a two-second wrongness instead of a permanent one.

  **Cross-tab arbitration.** Every tab shows the overlay; exactly one makes a sound, and accepting or declining anywhere dismisses the rest — `BroadcastChannel`, with a `storage` fallback, and a browser that has neither rings in every tab, stated rather than guarded against.

  **`<CallPanel>`** is the 1:1 `renderMedia` for `<CallStage>`: one remote filling the frame, one corner picture, mute / camera / camera-flip-by-device-cycling / hang up, a timer anchored on the server's `answered_at`, a connection pill whose reconnect RE-MINTS the grant (`POST /calls/{id}/token`), and an audio-only arm that is a state rather than an empty rectangle. No chat, no screen share, no participant list — and the server denies `can_publish_data` in the grant, so the absence of a data channel is enforced rather than agreed.

  **Three phone hooks ported from the meettoday client**, each a fix for an observed failure: `useMediaSession` (livekit-client registers a `freeze` listener unconditionally, so an Android screen-lock DISCONNECTS the call), `useWakeLock` (playing remote media does not keep a screen on, and a sleeping screen drops the audio), `useAudioKeepAlive` (preventing `freeze` still leaves background timer throttling to starve ICE). Porting them surfaced one bug worth naming: `play()` does not return a promise on the older engines the wake-lock fallback exists for, so `.catch` threw on exactly the platforms it was written to support.

  Size budgets raised deliberately — index 10 → 13 KB, default 14 → 20 KB — for a second lifecycle, with the argument recorded in `package.json`. The main entry still carries no antd and no socket.

## 0.2.1

### Patch Changes

- f952306: Visual pass VISUAL3: the call stage stops handing an end user an npm install
  command, the lobby says its one sentence once, and nothing on the usage screen
  is a raw wire value.

  **M-7 — the empty call stage was written for the integrator.** "Install
  livekit-client, or fill the callStage slot with your own" is advice a person in
  a meeting cannot act on. The screen now says what is true for them and what to
  do about it: "Video is not available on this device — you are in the room and
  everyone can see you here, but the picture and sound cannot start." In `en`,
  `ru` and `es`; the test asserts the package name is NOT on screen.

  **N-3 + M-4, one cause.** The lobby's liveness tag held a whole sentence, and
  the same string was printed again as muted text under the button — so "Not live
  — this list updates when you press Check again" appeared twice on five stories,
  and, because an antd tag is one unbreakable line with a trailing margin, it also
  made the document 392px wide on a 390px viewport. The tag now carries the STATE
  ("Not live"); the advice is a separate hint key rendered once.

  **M-2 — ids and a month key as user-facing text.** stapel-video stores no name
  for a user by design, and each skin takes a `nameFor` seam for it, but the demos
  left it unfilled: the lobby's waiting person was `u-4c02` and every row of the
  usage report was titled `u-9a1f`. The seam is wired in the demos. The month
  selector offered the wire's `2026-08`; `usageMonthLabel` puts it through `Intl`
  against `useFormat()`'s locale, so it reads "August 2026" beside the formatted
  dates it sits next to.

  **M-6.** `the-meeting-client` and `scope-usage` each declared a `phone` variant
  that rendered the identical tree as `default` — the responsive switch here is
  measured on the pane's own box, and the shot runner already shoots every story
  at 390 and 1280. Dropped, with `viewport: "phone"` moved onto the surviving
  variant, and `assertVariantsRenderDistinctly` added to `test/demos.test.tsx`
  (jsdom renderer: the "turn away" question is a portal-rendered confirm).

## 0.2.0

### Minor Changes

- 80617e9: The meeting client, not just the report about it.

  Six browser-callable operations had no frontend at all: `POST /rooms`,
  `GET /rooms/{join_code}`, `POST …/join`, `POST …/lobby/{admit,deny}` and
  `GET …/participants`. The pair shipped the workspace-admin usage table and
  nothing else — a package named `@stapel/video-react` that could not join a call.

  **Added.** `useMeeting` (open a room / ask to join, holding the three-armed
  outcome), `useLobby` (the queue, the two verdicts, and the live overlay merged
  onto the REST page), `useRoom`, the lobby's frame vocabulary
  (`decodeLobbyEvent`, `lobbyStreamKey`, `lobbySocketPath`, `lobbyLiveness`) and
  the model that folds a `200 {status}` body and a `403 video_join_denied` throw
  into ONE `JoinOutcome` — so a host's sticky refusal never renders as a generic
  failure with a retry beside it. Default skins for all of it: `<RoomsPane>` (new
  top-level nav entry `video.rooms`), `<MeetingPane>`, `<JoinGate>`,
  `<LobbyPanel>`, `<ParticipantsList>`, `<CallStage>`.

  The lobby socket is consumed through `@stapel/realtime` (new OPTIONAL peer), so
  the 4401/4403 close-code table is the fleet's one reviewed copy. With no
  provider or no `wsOrigin` the lobby renders a visible `offline` state and a
  "Check again" — never the silent poll §83.1 records. `livekit-client` is a new
  OPTIONAL peer loaded by `import()`; its absence is a designed screen naming the
  package, and `<MeetingPane renderCallStage>` replaces the surface outright.

  **Breaking (pre-1.0 ⇒ minor).** `src/default/theme.tsx` and
  `src/default/ErrorAlert.tsx` are deleted: `VideoSkinTheme` and the pair's local
  `ErrorAlert` are no longer exported from `/default`. Use `SkinTheme` /
  `ErrorAlert` from `@stapel/tokens-antd/skin`. Peer floors raised to
  `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`.

  **Fixed.** The `attendances` explanation is visible text instead of a `<Tooltip>`
  (keyboard- and touch-unreachable); the four-column usage table becomes one card
  per person below the tablet edge, measured on the pane's own box rather than the
  viewport, so a narrow sidebar on a desktop is handled too; `months` is clamped to
  the 1..36 the view accepts and the clamp is stated, with an `invalid period` arm
  on the table — both predicates existed since 0.1.0 and reached no screen; counted
  copy goes through `useTPlural` (`{count} people` was not a plural); `src/i18n/es.ts`
  and the `./i18n/es` subpath ship, and the eight `video_*` error codes are authored
  in all three locales instead of only ru, closing the locale-parity gap.

### Patch Changes

- 350f61f: Generated artifacts these pairs were entitled to and never asked for.

  `gen:errors` pinned `ERRORS_LOCALES=ru` for gdpr-react and video-react while every other
  pair on that line used `ru,es`, so no Spanish bundle was ever emitted — even though
  `stapel-gdpr/translations/errors.es.json` already carried all 15 module keys and
  video's core-owned keys were sitting in stapel-core's catalog. One word per pair;
  `src/i18n/generated/errors.es.gen.ts` now exists in both (gdpr: 57 codes, complete over
  the registry; video: 51, `Partial` because stapel-video ships no catalog of its own and its
  keys stay the pair's to author). Reaching them needs an `./i18n/es` subpath, which is the
  pairs' own `package.json` to add.

  docs-react is enrolled in the root gen drivers for the first time — `gen:api`,
  `gen:errors` (ru+es), `gen:events`, `gen:flows`, `gen:manifest`. It was the only package in
  the monorepo that appeared in none of them, so everything the pipeline gives the other 16
  pairs was hand-written and ungated, and had drifted: `manifest.json` claimed
  `backend.contract ">=0.1 <0.2"` against stapel-docs 0.3.0 and invented two operationIds the
  backend has never had. The manifest and llms.txt are generated now (27 operations, 74 error
  codes with ru and es texts) and stand under the drift gate. The pair's own source said in
  three files that the backend emitted no contract artifacts; it does, and has for a while.
  `gen:nav` and `gen:demos` still wait on a `src/nav/manifest.ts` and a `demo/` directory.

## 0.1.0

### Minor Changes

- 6fdc83f: New pair: `@stapel/video-react` — the workspace admin's "who talked how much",
  built on the read stapel-video 0.7.0 added, with the two things that contract
  makes easy to get wrong refused once, here, instead of being rediscovered per
  host.

  - **The 404 is not an empty table.** `error.404.video_scope_not_found` is
    returned for THREE different situations — the scope does not exist, it holds
    no calls, and the caller holds no `USAGE_MANDATE` in it — deliberately,
    because a 403 would confirm to someone guessing tenant ids that the one they
    guessed is real. A table that drew zero rows there would manufacture a claim
    about the workspace out of a refusal to answer. `isScopeUnavailable()` reads
    the CODE (never the status: the module has three other 404s), and
    `<ScopeUsageTable>` renders that arm as "call usage is not available for this
    workspace" — a separate arm from loading, from a genuine error, and from a
    month that succeeded and holds nobody. Same class as `data ?? []`, one status
    code further out.
  - **`months` and `users` are optional on the wire.** Neither is in the schema's
    `required` list, so the generated types make them `?`. `normalizeScopeUsage`
    is the one place allowed to decide that absent means "no months" / "no rows";
    everywhere else both arrays are non-optional and a reader cannot reach for
    `?? []` at its own call site.

  What ships:

  - `useScopeUsage(scopeKey, { months, month, tz })` — TWO queries, on purpose.
    The window read (`?months=N`) feeds the month selector and stays cached while
    a person clicks through months; the month read (`?month=YYYY-MM`) feeds the
    rows. One query could not do both: `?month=` answers a one-element `months`
    list, so a selector fed from it collapses to the month already chosen. Gated
    on `useActiveSessionReady()`, because a read racing a bootstrapping session
    answers the SAME 404 that means "not available", and the screen would blame
    the workspace for a race.
  - `usageQueryKeys` — `window`/`month` under `["video","usage",scope,tz,…]`. The
    zone is in the key because `?tz=` decides where the buckets are CUT: the same
    `2026-08` is genuinely different numbers in `UTC` and `Europe/Berlin`, and a
    DST month is 743 or 745 hours. Nothing here re-derives a boundary —
    `period_start`/`period_end` come off the wire.
  - `/default`: `<ScopeUsageTable rows nameFor month months onMonthChange
onRefresh/>` and `<ScopeUsagePane>`, the prop-free screen the nav manifest's
    `admin.usage` entry mounts (scope from the prop, else from
    `createVideoRuntime({ scopeKey })`; with neither it NAMES the wiring gap
    rather than drawing an empty workspace). The person column is a slot: the
    wire carries `user_id` and never a name — stapel-video keeps no FK to a user
    so erasure can pseudonymize it — so the host passes `nameFor`, and a person
    the roster does not know still appears, by id, rather than being dropped from
    a report about individuals. The footer calls the room sum **attendances**,
    because three people in one meeting make three and no scope-wide distinct-call
    number exists on the wire.
  - en + ru. The 9 error keys stapel-video owns are authored in `./i18n/ru`
    because the module ships no `translations/` directory at all — the generated
    ru bundle is a `Partial` covering only the 42 cross-cutting keys core owns
    (`ERRORS_LOCALE_EXEMPT_OWNERS`, the forms/reviews precedent). A test asserts
    the split in both directions, and that the 404's copy is the SAME string in
    the error bundle and on the screen so the two arms cannot drift.

  Out of scope, and not by omission: the other seven paths in stapel-video's
  contract (rooms, the lobby verdicts, the join grant, the participant list, the
  provider webhook) belong to a media-server client, not a React data pair —
  `manifest.json` still lists the whole contract. The nav entry is
  `admin.usage`, not `video.usage`: nobody looks for their team's call time under
  "Video", and `admin.root` is a container-owned parent this pair does not
  declare (`resolveNav` drops an orphaned submenu entry rather than throwing).

  84 tests in 8 files (+4 in `test:pack`). Sizes: index 3.29 KB, default 3.71 KB,
  i18n/ru 1.99 KB — all under their limits. Contract pinned at stapel-video
  v0.7.0 (9441461). Not published: the first publish of a new pair is a one-time
  manual bootstrap by the owner.

## 0.0.0

- Scaffolded by `stapel-new-react-lib` from the auth-react etalon
  (frontend-standard §9, frontend-core-architecture §4 checklist). Layers
  api → model → flows → headless → i18n; drift-gated generated surfaces
  (flows registry, backend error map, manifest + llms.txt) via the shared
  monorepo `gen:*` drivers.
