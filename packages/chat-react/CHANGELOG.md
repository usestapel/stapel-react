# @stapel/chat-react

## 0.9.3

### Patch Changes

- 705ce7f: chat-react: the inbox row reaches the listing, and its thumbnail keeps its shape

  The inbox held zero links to a listing. A row carried the subject's title,
  price and photo — everything but a way to open the thing being asked about —
  so the one move a seller standing in their messages wants to make had to be
  made by searching for the listing again. And the photo behind that thumbnail
  is 120×160, drawn into a 24×24 square.

  The subject title is now a link. `href` defaults to the card's own `url`, the
  field the subject provider already serves, so a deployment that resolves
  subjects at all gets the link without wiring one; `<ConversationListPanel>`
  and `<ConversationSplitPanel>` gain `subjectHref` (an explicit resolver whose
  answer wins, `undefined` included) and `linkComponent` (the router's link, for
  a client-side navigation).

  Only the title, and outside the row's own control: the row opens the
  CONVERSATION and the title opens the LISTING, and neither may contain the
  other — an anchor inside an anchor is not a document, a link inside a
  `role="button"` is a control inside a control. The subject strip therefore
  sits beneath the row control as a sibling, indented to the same text column.

  The row thumbnail is now a 24×32 portrait frame off the token scale, drawn
  `object-fit: cover`, so a marketplace's photos are cropped to the frame rather
  than squeezed into a square that had nothing to do with them.

## 0.9.2

### Patch Changes

- 31dc54a: The pooled sign-in door is reachable from a hand-composed control

  `<StartChatButton refusal="pooled">` is not the only compact card control: a
  host with its own card geometry composes the headless `<StartDirectChat>` with
  the skin's `<GatedButton>` itself, and that pairing could not reach the door at
  all — the portal lived inside this pair's own skin component. Such a pane
  printed the pooled sentence with nothing to press, which is the half-answer
  pooling was fixed for. `usePooledRefusal(reason)` and `<PooledSignInDoor>` are
  now exported (the latter reading its scope from the ambient
  `GateReasonScopeContext` when none is passed), and they share one claim with
  this pair's own button: one door per pane and reason, whoever wrote the
  controls.

## 0.9.1

### Patch Changes

- `<StartChatButton refusal="pooled">` gets its sign-in door back.

  0.9.0 fixed the right defect — fourteen listing cards printing "Sign in to message the seller." fourteen times — by pooling the sentence into the enclosing `PaneGate`'s footnote. It also dropped the thing the inline arm has and this module's own rule requires: the door. A pooled pane stated the reason and left the visitor to find the header themselves, which is exactly the half-answer `SignInLink` was written to end (storefront Wave D, G-3): a reason whose next action is a link nobody can find is half an answer.

  The door now stands IN the pooled sentence, and there is one sentence, so there is one door — not one under each of fourteen cards, which is the noise pooling had just removed. It is rendered through the scope's own published address (`GateReasonScope.idFor`), so it lands inside the very element every button's `aria-describedby` points at: assistive tech reads the reason and its way out together. A claim elects one control per pane to render it and hands it on when that control unmounts, so a card scrolled out of a virtualised list cannot take the pane's only way out with it.

  The inline arm is untouched — one control, one sentence, its own door — and a pane whose host passes no `signIn` still gets the reason alone, as it always did.

  `react-dom` joins the declared peers (`>=19`) for the portal. It is not a new install for anyone: `antd`, already a peer here, requires it.

## 0.9.0

### Minor Changes

- bcc524b: One sentence, fourteen buttons: `<StartChatButton refusal>` decides where the
  "why is this off" line goes.

  Measured on the host's phone results page: fourteen cards, fourteen copies of
  "Sign in to message the seller" down one column — the same sentence, about the
  same session, printed once per listing. The rule this control has always
  followed ("a switched-off control says why") is right for ONE control and wrong
  for a list of them. The reason had not changed; only the number of places it was
  printed had.

  Every arm keeps the sentence reachable:

  - **`"inline"`** — the default, and what the control has always drawn: the
    sentence beside this button, with the sign-in door on it. Right for a listing
    page, where there is one of them. Nothing already on screen moves.
  - **`"pooled"`** — the button is drawn through `GatedButton`, so its reason is
    registered with the enclosing `PaneGate` and printed ONCE for the pane while
    every button's `aria-describedby` keeps pointing at that single copy. A screen
    reader still reads the reason WITH the control it belongs to: the sentence
    moves, it does not disappear, which is the difference between pooling and
    hiding. Outside a `PaneGate` it behaves exactly like the inline arm, so a host
    that asks for pooling and forgets the scope loses nothing.
  - **`"none"`** — this control says nothing because the HOST has said it (a
    banner over the list, its own sign-in bar). The one arm that can leave a
    switched-off control unexplained, which is why it is opt-in and named for what
    the caller is taking on. The gate itself is untouched; what is dropped is the
    copy.

  `StartChatRefusal` is exported. The pooled arm goes through the skin's
  `GatedButton` rather than hand-wiring a `GatedControl` binding, so the blocked
  paint and the reason's placement stay one decision made in `tokens-antd`.

## 0.8.1

### Patch Changes

- a9a0bed: The inbox row shows the listing's thumbnail and price, not only its title.

  `ConversationListPanel`'s row used to draw a conversation's subject
  (stapel-chat 0.6.0) as a bare title line, even though the same card already
  carries a price and a photo (`readSubjectCard`). The row now draws all three
  on one line — thumbnail, title, price — while the avatar, unread badge and
  timestamp behave exactly as before. A conversation with no subject, or one
  whose card could not be built, renders exactly as it always did.

  New export: `SubjectRowSummary` (`@stapel/chat-react/default`), for a host
  composing its own inbox row who wants the same line.

## 0.8.0

### Minor Changes

- 62901b7: Replace `<Space direction="vertical">` with `<Space orientation="vertical">` (antd 6's non-deprecated prop) in `StartChatButton`, `ConversationThreadPanel`, `ConversationListPanel` and `ChatNotificationsPrompt` — silences the antd 6 deprecation warning; spacing and alignment unchanged.

  This is a MINOR, not a patch: `Space orientation` does not exist in antd 5 — the prop is antd 6's, and a host on antd 5 would get an unstyled vertical stack from the same code. `peerDependencies.antd` therefore moves from `>=5.20.0 <7` to `>=6.0.0 <7`: this release requires antd 6.

## 0.7.3

### Patch Changes

- 9587386: The conversation row shows that it has focus

  D65 made the whole row the control by wrapping it in an element styled
  `color: inherit; text-decoration: none` — a hit area with no chrome of its
  own. What went with the chrome was the focus ring: a keyboard walk of a live
  inbox landed on this element and measured `outline-style: none` with no
  box-shadow, so a person tabbing their conversations could not see which one
  Enter would open. The largest focus target on the screen was the one with
  nothing to show for it.

  `conversationRowCss()` and `ROW_OPEN_CLASS` are exported so the rule is
  something a test can read.

## 0.7.2

### Patch Changes

- a9dbe3e: The message composer no longer refuses a box nobody has touched.

  Measured on a phone: the instant a message was sent, the now-empty "Write a
  message…" field drew a validation refusal — "Write something first." under a
  disabled send button — for something nobody had done. Same on first paint. The
  composer derived its validation state from "the value is empty", and an empty
  box is exactly what a freshly drawn and a just-sent composer both are.

  Validation state now comes from "the person has addressed this field", not from
  the value:

  - `MessageComposerBag` gains **`visibleAvailability`** (the same verdict as
    `availability`, withheld until the person has typed or pressed send) and
    **`pristine`**. `availability` is unchanged and stays the ENFORCEMENT gate —
    a disabled send button is not an error state.
  - `send()` over an empty box still posts nothing, and now marks the composer
    touched, so asking and being refused is what puts the reason on screen.
  - A successful send resets to PRISTINE rather than to "empty and therefore
    invalid"; the caption goes with the message.
  - `<ConversationThreadPanel>` draws its blocked caption from
    `visibleAvailability` and stamps `data-pristine` on the input, so neutrality
    is measurable rather than a colour. Enter over an empty draft sends nothing
    and now says why, exactly as pressing the button does.

  A skin that renders `availability` keeps its old behaviour; the new field is
  what a skin should print.

## 0.7.1

### Patch Changes

- 21e4cc5: The notification ask stops taking the screen hostage (D64), and the whole
  inbox row opens its thread (D65).

  - `<ChatNotificationsPrompt>` renders in the thread's own flow instead of a
    modal sheet. As a modal it opened over the open thread a second after the
    first message and its mask swallowed every click outside its own box — the
    composer, the message list, the other conversation in the split; a walker
    run sat at the input for 30s and failed. Nothing is gated behind the ask, so
    refusing to answer it must cost nothing. Same moment, same copy, same
    `usePermission` state machine, plus a denied arm that says where the switch
    is; new copy keys `chat.notify.allow` / `chat.notify.not_now`.
  - A conversation row is now one control rather than a 60×20 name button inside
    a 300×80 box: an `openHref` row is a real anchor over the whole row
    (right-clickable, in the browser's history), an `onOpen` row is a
    keyboard-operable button with the same hit area. Clicking the preview, the
    subject or the clock opens the thread.

## 0.7.0

### Minor Changes

- The selected-row axis and the desktop split inbox arrangement.

  Measured on a wide desktop viewport (1440×900) of a live classified
  deployment: the chat thread page was ONE full-width lane — the composer
  stretched to 1230px, a reader's own bubbles a screen away from the avatar
  that named them — and no conversation list beside the open thread, which
  lived on a separate screen. The reference design for a desktop inbox is two
  panes, and the pair had no two-pane arm to mount.

  - `<ConversationListPanel/>` gains `selectedId?: string | null`: the matching
    row is painted with the theme's selected-item background (token bag, never
    a literal) and carries `aria-current="page"` — the same fact stated once
    for the eye and once for the reader. Default undefined; existing hosts are
    untouched.
  - New `<ConversationSplitPanel/>` (exported from `./default`): the two
    existing panels on a `360px minmax(0, 1fr)` grid with a `colorSplit`
    divider — list left, thread right, and a quiet "Pick a conversation" empty
    state (new key `chat.split.empty`, en/ru/es) until something is selected.
    Thread pass-throughs (`limit`, `maxLength`, `notifications`) forward to the
    thread; `empty` lets a host bring its own right pane. The thread pane caps
    its reading measure at 48rem so a message lane never stretches across a
    wide pane — the cap lives in the split arrangement, not in
    `<ConversationThreadPanel/>`, whose solo behaviour is unchanged.
  - Mounting the split is the HOST's viewport decision (the `CategoryPage`
    rule): a phone host keeps the two screens and never mounts it.

## 0.6.2

### Patch Changes

- 6bf6f2d: Enter sends. The thread composer's textarea treated a hardware keyboard's
  Enter as a newline, so the draft sat in the field with a `\n` in it and only
  the button posted. Plain Enter now sends the draft through the same gate the
  button obeys (an empty or blocked composer still refuses), Shift+Enter keeps
  the newline, and an IME mid-composition is left alone — its Enter commits the
  candidate, never the message. Phone soft keyboards are untouched.

## 0.6.1

### Patch Changes

- b802daf: An "online" the header never took back.

  `chat.presence.changed` is announced from a **disconnect**. A lease running
  out announces nothing — nothing happens, so there is no event for the server
  to send — and the lease exists for exactly the case where no disconnect ever
  runs: a killed tab, a lost worker. So at the moment a peer vanishes most
  abruptly, a header told only `online: true` heard nothing more and kept saying
  it. Seen live on a stand: online ninety seconds after the peer was gone, while
  the server had already said offline.

  Against stapel-chat 0.7.3 (pin bumped), `online_until` — the deadline the
  server itself evaluates — reaches the client, on `participants[]` and in the
  presence frame:

  - `presenceExpired` / `presenceAt` / `presenceExpiryDelay` in the model;
  - `<PresenceLine/>` arms **one timer per rendered participant** for that
    deadline, fired once. No interval, no refetch, no traffic. When it fires the
    line re-renders and reads offline — the answer the server was already
    giving.

  A fix by data rather than by event: the reader is handed what the server
  evaluates instead of the server inventing a message for a non-happening.

  Degradation is unchanged in both directions that matter. A body with no
  deadline (an older server) arms nothing and behaves exactly as before, and an
  unparseable deadline is treated the same — blinking a participant offline
  because of a field their backend has never heard of would be a worse lie than
  the one this fixes. `last_seen_at` is left untouched when a deadline passes,
  because it is still the last time anybody saw them.

## 0.6.0

### Minor Changes

- f38c320: The thread header stops calling the reader's own socket "the other person".

  The tag beside the seller's name read "Live" ("На связи") whenever THIS
  browser's websocket was up. Everyone using the product read it as "the seller
  is online". It never meant that — it meant the reader's network could still
  reach the server, wearing somebody else's name.

  Against stapel-chat 0.7.0 (pin bumped), three things replace it:

  - **`<PresenceLine/>`** under the counterparty's name — "Online", or "Last
    seen 5 minutes ago" on core's own relative-time ladder (`useFormat`), from
    `participants[].online` / `.last_seen_at`. It takes no transport argument
    and cannot be built from one. It renders only for a single counterparty: in
    a group "online" names nobody, and an adjective about four people would be
    the same overreach.
  - **`chat.presence.changed`** — `readChatPresenceFrame` and a `presence`
    signal kind. `applyConversationPresence` writes the flip straight into the
    cached conversation rather than invalidating it: the frame carries both
    fields the header renders, so a refetch buys nothing and several peers
    arriving at once would be a refetch storm for a line of text.
  - **`<TransportTag/>` says nothing while the socket is healthy.** Every named
    degradation is untouched — that is the whole reason the control exists — but
    the expected state gets no chrome. A permanent label in a thread header is
    read as a fact about the person named next to it, which is how this began.

  `participantPresence` degrades to offline-with-nothing-to-say for a server too
  old to send the fields, for a participant not on the thread, and for a frame
  whose `online` is anything other than literally `true`. A false "online" is
  the defect, so that is the direction it fails in.

  **Notifications, on the shared permission substrate.**
  `<ChatNotificationsPrompt/>` asks via core's `usePermission("notifications")`
  and `PermissionSheet` from `@stapel/tokens-antd/skin` — no second permission
  component. It asks at the first message exchanged in the open thread, never
  on page load: `denied` is terminal, so an early prompt does not merely annoy,
  it spends the only chance the browser gives. "Not now" is a dismissal that
  never reaches the browser.

  `useChatNotifications` spends a granted permission and asks for nothing:
  one notification only while the tab is hidden, never for your own message,
  never for a tombstone or a system line, one `tag` per thread so a burst is one
  line of news rather than twenty alerts.

  `<ConversationThread onSignal>` is the new observer seam these use — every
  signal, already applied, for the facts a query cache cannot hold.

## 0.5.0

### Minor Changes

- 5c6126d: The inbox names people, and a thread says what it is about.

  A seller with ten conversations saw ten rows all titled "Личная переписка" —
  the row title was the conversation KIND — distinguishable only by timestamp.
  And a buyer writing "still available?" about one of five listings landed in
  the same thread as every other subject, so neither party could tell which.

  - Rows now carry the counterparty's avatar and name, the subject, a preview
    and an unread badge. Names come from a host seam on the runtime
    (`slots.people`), shaped like listings-react's `resolveImage`, because chat
    may not import profiles-react. It is a component rather than a function
    because the answer is a network read. `<PeopleScope>` resolves a whole
    screen in ONE batch, never per row, and the test counts the fetches rather
    than asserting the shape. With no seam wired a row reads "name unavailable"
    — never a fallback that looks deliberate.
  - `StartChatButton` / `useStartDirectChat` take `subjectType`/`subjectKey`,
    and the thread pins a subject card above the messages. Both halves or
    neither: a half pair is dropped rather than sent, because upstream answers
    `chat_incomplete_subject`.
  - The thread header gains report and block, both host slots, in a
    `SkinDialog` — a bottom sheet on a phone, a modal above it. With neither
    wired the control is not drawn.

  Two honest limits, both recorded in MODULE.md rather than papered over. The
  conversation contract carries no last message, so a row shows a preview only
  for threads this client already holds — a `last_message` projection upstream
  is what would let every row paint one on first load; a per-row
  `GET /messages?limit=1` was refused and a fabricated line is worse than a
  blank one. And widening `direct_key` means the first contact WITH a subject
  opens a new thread beside a pair's existing subjectless one: the skin makes
  the two visibly different rather than hiding it.

- 5c6126d: Auto-anonymous: a gated action can mint an identity instead of refusing.

  A marketplace visitor who has not registered could read the catalogue and do
  nothing with it. Saving a listing and writing to a seller are the two acts the
  product exists for, and both answered "sign in first". They no longer do: the
  press mints a guest account silently and then performs the act.

  - `@stapel/core` gains the elevation seam — `ElevationSource`,
    `<ElevationProvider>`, `useElevation(action)`. It is per-ACTION on purpose.
    The mandate axis is untouched by a mint, so a minted guest stays
    `"anonymous"` and every action a deployment did not name keeps its wall.
  - `@stapel/auth-react` gains `createAuthRuntime({ autoAnonymous: { actions } })`
    and `createAnonymousElevation`, implementing that seam over
    `POST /anonymous/`. It never mints on render, collapses concurrent presses
    onto one mint, and persists a `device_id` so a reload does not abandon the
    first guest along with what they saved.
  - `@stapel/listings-react` exports `LISTINGS_ELEVATION_ACTIONS` and
    `useElevatableMandateGate`; the favourite heart takes the named action.
    Publishing deliberately does not.
  - `@stapel/chat-react` exports `CHAT_ELEVATION_ACTIONS`; "message the seller"
    takes the named action.
  - `@stapel/reviews-react` exports `REVIEWS_ELEVATION_ACTIONS` and now refuses a
    mandate-less visitor BEFORE the click rather than after it. It also
    recognises `error.403.reviews_anonymous_not_allowed`: a signed-out visitor
    is refused with 401 and a minted guest with 403, and both mean "you need an
    account", so `isSignInRequired` reads both.

  `@stapel/auth-react` also gains `<AuthPanel showGuestEntry>`. With the axis
  open the backend advertises `registration.anonymous` and the panel would draw
  "Continue as a guest" — on a host that mints automatically that button mints a
  session and leaves the person on the sign-in screen, which is the silent
  control that got the capability switched off somewhere once already. The
  server's statement stays true; the host says whether it is obtained by
  pressing that.

  WHICH actions may mint is a host's list, not a library default. A host that
  wires nothing sees no change: every gated control refuses exactly as before.

## 0.4.0

### Minor Changes

- 2087398: The default skin becomes visible, and the pair is regenerated against
  stapel-chat 0.6.0.

  **Four skin demos, 4/4 under the strict default-skin gate.** `ConversationListPanel`,
  `ConversationThreadPanel`, `StartChatButton` and `SignInLink` each get a demo
  that imports the component from `src/default`, carries a `viewport: "phone"`
  variant and declares a distinct `step`. Every variant is SEEDED through the
  harness's new `seedInbox`/`seedThread`, so its first paint is the state it is
  named for — a shot runner keeps the first frame, and four spinners under four
  names is worse than one honest demo.

  `test/demos.test.tsx` now runs `assertVariantsRenderDistinctly`, the runtime
  half of the C-SAMESHOT guard this package was missing. It immediately caught a
  demo that declared `step: "sign_in"` and rendered the signed-in button:
  "signed out" is not derived from `viewerId`, it is read off core's mandate axis,
  so the demo now names its principal through `<MandateProvider>`.

  **Two accessibility/mobile defects fixed, both found by drawing the phone.**

  - The unread badge carried its sentence in `title=` — a browser hover, which
    does not exist on touch, cannot be reached by keyboard, and is announced
    inconsistently (some readers say it INSTEAD of the label). It is now the
    badge's accessible name: `role="img"` + `aria-label`, because an `aria-label`
    on a bare `<span>` names nothing.
  - The thread header was a nowrap row holding a title and the transport tag. The
    degradation copy is a full sentence, so at 390px the flex line could not
    shrink below its content and the one thing on the screen a person can act on
    went off the edge. The header wraps and the tag's text wraps inside it.

  **Regenerated against stapel-chat 0.6.0** (the released tag; 0.6.1 is in flight
  and not on PyPI). The typed surface gains `MessageResponse.rev_seq` — the
  journal cursor, required — plus `client_msg_id`, `edited`/`deleted` and their
  timestamps, `ConversationResponse.subject`/`stream_key`/`socket_path`, and the
  subject endpoints: 10 paths, 13 operations, 65 error keys (was 54).

  The 11 new stapel-chat-owned error codes are authored in `ru` and `es` — the
  module ships no `translations/` of its own, so a key the pair does not write is
  a key a Russian or Spanish host reads in English. `error.403.chat_send_refused`
  and `error.503.chat_blocks_unavailable` deliberately do not name the block:
  upstream refuses a send and a new direct thread with one and the same code so
  that a block cannot be detected from outside, and a translation that named it
  would leak what the contract is built to withhold.

  **Declares `@stapel/tokens-antd`.** `src/default/` imports it; the package
  never listed it, so the pair did not typecheck.

  **Not fixed here, and now stated at the top of MODULE.md**: `src/realtime/`
  speaks stapel-chat's pre-0.3.0 wire and cannot read a single frame a released
  backend sends — including `ping`, so the heartbeat is never answered. Tracked
  as CHAT-RT-CUTOVER against `@stapel/realtime`.

- 9893527: **The wire cutover: chat's realtime works again.** This pair's socket half
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

- f452cfe: Stop showing the degradation sentence on healthy screens, and theme the default skin.

  **"Refreshing every few seconds" was a standing banner, and that is a
  regression of the defect it was written for.** `TransportTag` renders the named
  degradation when there is one and falls back to a TRANSPORT label when there is
  not. `transport` reads `"polling"` for every state that is not live — including
  the three healthy ones: a socket still connecting, a socket deliberately held
  back until the thread window loads (`socketEnabled: loaded`), and a `resync`
  catching up. The label for `"polling"` was "Refreshing every few seconds", so a
  perfectly healthy thread printed the pair's own complaint copy from its first
  frame until the socket opened, and a thread whose window was still loading
  printed it for as long as the read took. `chatDegradation` was right the whole
  time; the sentence was keyed on the polling timer being armed rather than on
  anything the seam could prove.

  The original defect was a true sentence nobody could act on. This was the same
  sentence shown when it was false, which leaves a person no way to tell a fixed
  chat from a broken one and teaches them to skip the one message that matters.

  `chat.transport.polling` is DELETED in all three locales rather than left
  unused — an unreachable key is a sentence waiting to be wired back up by the
  next person who needs "a polling label". The healthy fallback now says the true
  thing: `chat.transport.connecting` ("Connecting…"), and
  `chat.transport.catching_up` for a `resync`, which the tag can now tell apart
  because it takes the stream `status` the bag already carried. Every sentence
  about refreshing on a timer belongs to a named degradation — the only place the
  seam can prove it. `test/degradation.test.tsx` asserts a live socket renders
  the live label with no `data-degraded` and nothing matching /refreshing/, that a
  still-connecting socket says nothing about refreshing either, that a socket
  which really never connects still SAYS SO, and that no healthy-path label in
  en/ru/es mentions refreshing.

  **The default skin had no theme root.** `src/default/**` rendered antd
  `Card`/`Typography`/`Tag` with no `ConfigProvider` of its own, so in a dark
  document with none above it antd fell back to its LIGHT algorithm — tracker
  \#26's failure, and how six of this pair's stories were photographed as white
  text on a black field. New `ChatSkinTheme` delegates to
  `@stapel/tokens-antd/skin`'s `SkinTheme` (reactive `useThemeMode()`, painted
  surface, 44px phone control height) and every shipped surface wraps itself in
  it. A hand-painted background would not have fixed it: the Card, the tag's
  semantic colours and every border come from the algorithm.

  **The demos photographed the broken deployment as the normal one.** The harness
  turned the socket off for every variant, so every frame of the catalogue wore
  "Live messages are off here — refreshing every few seconds instead". It also
  meant the freshness seam POLLED, and a poll refetches with `type: "active"`,
  which walks straight through `staleTime` and replaces a seeded variant three
  seconds after anyone opens it. The harness now mounts a realtime client that is
  already live on its first synchronous read (`useStream` seeds its state from
  `client.streamStatus` during render, which is the only way a static shot can
  show a live chat at all), and `socket: "off"` is opt-in — used by one variant,
  `no-live-socket`, which is where the named degradation is photographed. A `dark`
  variant photographs the theme root.

- 45450c7: **`renewing_credential` comes back, as a question.** The wire cutover deleted
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

## 0.3.1

### Patch Changes

- The floor states what the imports already require: `@stapel/core >=0.16.0`

  `SignInCta` and `SignInCtaProp` first shipped in `@stapel/core@0.16.0`, and
  this package has imported them since. The declared peer floor still said
  `>=0.15.0`, which npm would have honoured — installing a core with no such
  exports, and failing the host's typecheck on symbols this package's own
  `.d.ts` references.

## 0.3.0

### Minor Changes

- 3e2e2a3: A blocked control now carries the door, not just the reason: `signIn`

  `actionBlocked` ended the grey-rectangle incident by making every switched-off
  control state its reason. It did not end the next one. "Sign in to save this",
  "sign in to leave a review", "sign in to message the seller" are reasons whose
  next action is a LINK, and no pair took one — so the storefront had to put its
  own notice a screen away from each of the three controls it was about, and
  named it a gap rather than shipping it (Wave D, G-3).

  All three now take the same prop, core's `SignInCta`:

  ```tsx
  <ListingCard listing={row} signIn={{ href: `/login?next=${here}` }} />
  <ReviewsPanel target={target} signIn={{ href: `/login?next=${here}` }} />
  <StartChatButton sellerId={sellerId} signIn={{ onSignIn: () => openModal() }} />
  ```

  `{href}` **or** `{onSignIn}`, never both. Omit it and the reason renders alone,
  with no trailing whitespace where the link is not — a host with no sign-in
  route is a supported host.

  Two more things each pair had to fix to make the door reachable:

  - **listings**: the favourite's reason lived only in a `title` on a DISABLED
    button, which receives no pointer events in any browser — core's own
    `actionGate.ts` calls that "a reason nobody can read". It is now text beside
    the heart (`listings-card-favorite-blocked`), with the link inside it. The
    heart is still never hidden from a visitor.
  - **chat**: `StartDirectChat` had no mandate gate at all, so a visitor could
    press "message the seller" and collect a 401 — a refusal delivered at the one
    moment it is useless. The axis is now the first arm of its `firstBlock`, read
    through core's `MandateSource` seam. `member` may write; `guest`/`anonymous`
    are told to sign in; `asking` says we are still asking. `unavailable` stays
    AVAILABLE on purpose: that is what core answers outside a `<MandateProvider>`
    too, and a host that never wired the axis must not lose its button — "we
    could not ask" is not "you may not". This raises chat-react's `@stapel/core`
    floor to `>=0.15.0`, where `useMandate`/`matchMandate` shipped.

  The link's LABEL is each pair's own (`listings.card.sign_in`,
  `reviews.form.sign_in`, `chat.start.sign_in`), in all three locales — core
  floors `en` and `ru`, and these pairs also ship `es`.

## 0.2.0

### Minor Changes

- ca35e19: New pair: `@stapel/chat-react` — the React half of `stapel-chat`, wiring both
  of its transports behind one seam.

  The storefront spec ruled polling-only for chat v1, and it was right about the
  fleet it surveyed: the resumable consumer existed but `stapel_chat.routing`
  exported nothing, so no host could mount it. stapel-chat 0.2.2 ships that mount
  (`ws/chat/<uuid:conversation_id>`). So this pair carries **two transports and
  one seam** — `useChatFreshness(streamKey, mapToQueryKeys, { fallbackRefetchInterval })`,
  deliberately the signature the realtime substrate reserves for
  `useSignalInvalidate`:

  - a typed client for the module's own protocol — `hello{last_seq}` → `welcome`
    → replay → `replay_done` → live frames, seq-deduped on both ends, resume from
    the cursor the STORE holds (not the one the socket opened with), `error{resync}`
    forwarded verbatim, close codes 4401/4403 treated as answers rather than
    faults (no reconnect), everything else reconnected with jittered backoff;
  - polling by `seq`, visibility-aware, with exponential backoff on consecutive
    failures — used whenever the socket is not carrying the stream, and for the
    inbox, which has no socket at all (the module fans out per thread).

  Both ends do the same thing with what they learn: refetch the thread query,
  whose query function advances the window BY SEQ
  (`?direction=prev&anchor=<tip>`). The screens are written once and the tests
  run against both transports. Writes never go over the socket: the `send` frame
  is typed (a mirror must be complete) and never emitted, because its refusals
  carry socket-local codes with no i18n key and no remediation, while
  `POST …/messages` answers with the persisted row and a real error envelope.

  Surface: `<ConversationList>` (server-computed unread counts, as a LoadState so
  a badge cannot read "0" during an outage), `<ConversationThread>` (a contiguous
  seq-ordered window — a hole is re-read, never stitched — with backfill and an
  automatic, monotonic read marker), `<MessageComposer>` (code-point length
  counting, so an emoji is one character on both sides of the wire), and
  `<StartDirectChat>` — "message the seller", get-or-create over the module's own
  participant-pair idempotency. An opt-in antd skin at `@stapel/chat-react/default`
  and a member-surface nav entry.

  Two contract facts recorded rather than papered over:
  `CreateConversationRequest.scope_key` is ignored by the server, so a direct
  thread cannot be scoped to a listing and the pair exposes no argument that
  pretends otherwise; and stapel-chat ships no `translations/` directory, so the
  pair authors ru/es for the twelve error keys the module owns (the
  stapel-forms/stapel_attributes precedent) while the cross-cutting keys come from
  stapel-core's catalogue.
