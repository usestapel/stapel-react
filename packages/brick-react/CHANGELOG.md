# @stapel/brick-react

## 0.6.1

### Patch Changes

- 2141404: Two wording defects a host found running 0.6.0 live. No behaviour changes.

  **The level stepper's accessible name said something that is usually false.**
  `brick.button.levelup` / `brick.button.leveldown` read "Higher starting level" /
  "Lower starting level" in English and "Nivel inicial más alto / más bajo" in
  Spanish. Since 0.6.0 that button most often does NOT touch a starting level: over
  a run in progress it moves the LIVE run's level, and on an autostarting console
  (the one `<WaitingGame/>` mounts) that is the case from the first frame. A
  sighted player sees a plus and a number; a screen-reader player was told about a
  start that was not going to move. The names now say the level and nothing more —
  `"Higher level"` / `"Lower level"`, `"Nivel más alto"` / `"Nivel más bajo"` —
  which is true in both cases and matches the Russian bundle, which already read
  «Уровень выше» / «Уровень ниже». The keys are unchanged, so no host has to touch
  its overrides.

  **The 0.6.0 notes drew the in-progress line in the wrong place.** They described
  the fresh-deal arm as "ready, over, or a deal nobody has touched", which reads as
  though an untouched autostarted board is re-dealt. It is not: the whole test is
  `!over && (running || played)`, and `running` counts on its own, so an `autoStart`
  console is in progress before anybody presses anything and its board is moved
  rather than dealt again. The fresh deal is reachable only from the other side of
  that line — a run that is `over`, or a board whose loop is stopped and which has
  taken no tick and no press. That sentence sent one integrator's work at the wrong
  arm; it is corrected in the CHANGELOG, the README table, MODULE.md and the
  `setStartLevel` / `<BrickConsole/>` doc comments, all of which now quote the
  condition rather than paraphrase it.

## 0.6.0

### Minor Changes

- 8012b9a: A level change no longer costs a person their game.

  Through 0.5.0 the level stepper had exactly one behaviour — deal a fresh board
  at the new level — in every phase. In an autostarting console (which is every
  console `<WaitingGame/>` mounts) that meant a plus pressed four hundred points
  into a run deleted the board and the score silently, with no warning and no way
  back. The handheld this package imitates never does that: the level is picked
  before play, and during play it only ever rises.

  The stepper now reads the board it is pressed over:

  - **A run in progress** — the whole test is `!over && (running || played)`:
    the run itself moves. Tempo and score multiplier become the new level's; the
    board, the piece and the score are untouched, and whatever the run had already
    earned goes on counting from the level just picked. `running` counts on its
    own, so an `autoStart` console is in progress from its first frame and its
    board is moved rather than re-dealt, touched or not.
  - **Nothing in progress** — the rest, and only the rest: a run that is `over`,
    or a board whose loop is stopped and which has taken no tick and no press (a
    console waiting at Start, or one the host holds paused). That gets a fresh
    board at the new level, exactly as before. It then behaves the way the
    console was mounted; an `autoStart` console plays it, a manual one waits at
    Start.

  The stepper is visible and enabled in both cases. The single disabled arm is a
  GAME that says its own level cannot move mid-run: `Memory`, where the level IS
  the sequence being remembered (it is how many blinks round one had, and the
  sequence in front of the player was dealt at that length), states so with the
  new `levelLockedMidRun` on its definition, and the console renders that sentence
  as the stepper's `data-disabled-reason`. It is per game, not a console-wide
  policy, and a host that disagrees can say so: a custom `GameDefinition` sets or
  omits `levelLockedMidRun`, and the two behaviours are reachable directly through
  `BrickSession.setLevel(level)` (moves the live run) and `reset()` (deals again),
  with `BrickSession.played` telling the two boards apart.

  Also in this release:

  - `BrickSession` gains `setLevel(level)` and `played`; `startLevel` now means
    "the level a fresh deal opens at" and follows a mid-run pick. A game reads
    `GameContext.startLevel` live rather than once, which is what lets the level
    move under a board that stays.
  - `useBrickGame` returns `levelLockReason` and no longer rebuilds its session
    when the level changes — the dependency that made every level change a re-deal
    by construction.
  - Coverage on the coarse-pointer path: the keypad's own Start and Reset drive
    the console, and a pointer that CHANGES under a mounted console (a pad plugged
    into a tablet) swaps legend for keypad, moves `aria-describedby` with it and
    re-sizes the panel.

## 0.5.0

### Minor Changes

- 6c05265: The level a person can actually pick, a veil that promises the key focus really has, focus given back, and a frame announced with its controls — four defects a host found using 0.4.0 for real.

  **The starting-level stepper was dead on arrival in the console everybody ships.**
  0.3.0 disabled it "while a run is under way", and `<WaitingGame>` autostarts — so
  in an autostarting console both buttons were `disabled` in the very first frame
  and the level could never be picked at all — the stated requirement, "the
  starting level can be chosen with a plus and a minus", going unmet everywhere it
  mattered. The lock now applies to a run **the person started**: an `autoStart`
  console keeps its stepper live, and changing the level there does what the
  stepper has always done — deals a fresh board at the new level — which then
  plays on, because that is what `autoStart` means. A console that starts on a
  gesture still locks, so a mis-aimed plus cannot throw away a board somebody was
  playing. The number the stepper steps from is now the level **on screen**, so a
  run that has levelled up past its start level still moves when the plus is
  pressed.

  **The paused veil promised Enter where the package itself declines it.** The hint
  was chosen from `captureKeys`, so `"claim"` and `"global"` always said "press
  Enter" — but the package's own guarantee is that a focused button or link keeps
  Space and Enter, and a console revealed by a host toggle leaves focus on that
  toggle. The promised Enter collapsed the host's panel instead of resuming; only
  a console that had taken page focus with `autoFocus` made the promise true. The
  hint is now chosen from **where focus actually is** — inside the frame it always
  reaches the console; outside it reaches only in a window mode, and only when the
  focused element is not one that keeps Enter for itself — and it follows focus
  while the veil is up. The click still works from wherever focus sits.

  **`autoFocus` took focus and never gave it back.** Hiding the console unmounted
  it and focus fell to `<body>`, dropping a keyboard-only person at the top of the
  document; a host could not add the other half of the disclosure pattern because
  the element focus came from is known only inside the package at unmount. Focus
  is now restored on unmount to the element it was taken from — only where
  `autoFocus` actually moved it, only if that element is still in the document,
  and never over a focus the person has since chosen themselves.

  **The frame was announced without its keys.** `role="group"` and a name read as
  "group, brick game console" and stopped, though a key legend is rendered on
  screen for a fine pointer. The frame now carries `aria-describedby` pointing at
  whichever control surface is rendered: the **legend** on a fine pointer, so the
  description is the key list itself, and the **keypad** on a coarse one, where
  the description is the pad's own name — the buttons are on screen and reachable
  by touch, and reciting seven of them before the game starts helps nobody.

  Prop and markup changes, all additive except one deliberate removal:

  - `<Keypad>` takes an optional **`id`** (new prop), so the console can point
    `aria-describedby` at it; it also carries `data-testid="brick-keypad"`.
  - `<BrickConsole>`'s frame carries **`aria-describedby`**.
  - The key legend **no longer carries an `aria-label`**: a described element's
    label stands in for its contents, so a legend named "Keys" would have
    described the console as "Keys" and the key list would never be read. The
    `brick.legend.label` i18n key stays declared and shipped in all three locales
    (it is public surface), it is simply no longer rendered.
  - `autoFocus` now has an unmount behaviour as well as a mount one — the same
    prop, one more half of the pattern.
  - No change to `captureKeys="claim"` semantics, `onPhaseChange`, `paused`,
    `resumeOnReturn`, the editable/focused-control guards, `defaultPrevented`
    outside a run, or the veil's click-to-resume.

  `default`'s size budget rises 11.35 → 11.65 KB (measured 11.55 KB).

## 0.4.0

### Minor Changes

- 02519bb: Who owns the keyboard, answered — four things a host found the first time it
  embedded the console for real (a waiting screen opened by a toggle button
  outside the frame).

  **`captureKeys="claim"`.** `"global"` reads the window politely: it yields to
  any handler that called `preventDefault()` first, and window listeners fire in
  registration order — so a host shortcut surface that mounted before the console
  silently ate the arrows and the game got nothing. Whether a console worked was
  a matter of mount order. `"claim"` reads on the CAPTURE phase and stops the keys
  it takes, but only **while a run is actually running**: ready, paused and over
  are `"global"` again, because a board nobody is playing has no claim on the
  page's keyboard. Every existing guarantee holds — an editable target keeps its
  keystrokes, a focused button keeps Space and Enter, modifier chords are never
  taken. `"global"` is unchanged, and stays the right choice for a console that
  autostarts behind a toggle where the host's own shortcuts must still win.

  **`autoFocus` and `ref`.** A host that opens the console from a button had two
  options and neither was right: ask for a second gesture into the frame, or go
  page-wide with `captureKeys`. `autoFocus` focuses the frame on mount, so the
  keys arrive in the same click and `"focus"`'s narrow scope is kept; `ref` hands
  the frame element back for a host that wants to focus or blur it later.

  **The paused veil no longer promises a key it does not own.** It said "Click
  here or press Enter" in every mode — but in `"focus"` the console correctly
  leaves Enter to whatever the host focused, normally the toggle that opened the
  panel, so Enter collapsed the panel instead of resuming. The hint is now chosen
  from the capture mode (new key `brick.screen.hintclick`, en/ru/es); the click
  always works, from wherever focus happens to be.

  **`onPhaseChange`.** The phase was published only as `data-phase`, so a host
  that needed to know a run was under way had to scrape the DOM. `<BrickConsole/>`
  and `useBrickGame` now report `ready` / `running` / `paused` / `over` — once on
  mount, once per change, never twice for a re-render.

  `<WaitingGame/>` forwards `autoFocus`, `onPhaseChange` and `startLevel`
  alongside the props it already passed through.

## 0.3.0

### Minor Changes

- 04db01e: The games are the handheld's again, and a second play is a new game.

  **A new game is a NEW game.** The session's seed defaulted to the constant `1`,
  so every run on every stand opened Tetris with the same piece, met the same
  first enemy and was shown the same sequence. The default seed is now drawn per
  session — and per reset, so "play again" deals again — from the one
  `Math.random()` call in the package. A `seed` passed in still replays a run cell
  for cell, which is what the demos and the tests stand on.

  **Racing, Tanks and Memory are rebuilt.** Racing has TWO lanes on a 9×20 road
  and the handheld's four-row car whose wheels blink as the road runs, oncoming
  traffic in the same shape, and a held ↓ for the accelerator. Tanks is the 3×3
  tank that turns with the direction it drives, with enemies that enter at the
  four corners of a 13×17 field, patrol their band and shoot back, shells that
  outrun a tank, and three lives marked above the player's band. Memory is four
  2×2 pads in a d-pad that grow to 4×4 as they light, a sequence one longer every
  round, and a wrong repeat that ends the run.

  **A starting level, picked before the run.** The side column's Level row is a
  stepper — minus, number, plus — from 1 to `BRICK_MAX_LEVEL`. It sets the tempo,
  the score multiplier and the length of Memory's opening sequence, deals a fresh
  board on every change, and is disabled while a run is under way.

  **Tetris: no more farming the drop.** Soft and hard drops paid 1 and 2 points a
  row, which made leaning on ↓ the fastest way to score; only line clears score
  now. Level 1 falls at 360 ms a row instead of 500.

  **The key repeat is the console's, not the operating system's.** A held arrow
  used to wait on the OS's ~500 ms echo delay — the "big delay" Arkanoid's paddle
  answered with. `useBrickGame` now repeats off the hold itself
  (`BRICK_REPEAT_DELAY_MS` 130, then `BRICK_REPEAT_RATE_MS` 55) and drops the OS
  echo, for exactly the buttons each game names in its new `repeat` field.

  Also: Arkanoid deals its wall with its own gaps every game and gains a level
  ramp; `GameContext` gains `startLevel`; `BrickConsole` gains `startLevel`;
  `createBrickSession` gains `startLevel`; `clampLevel` and `BRICK_MAX_LEVEL` are
  exported; new i18n keys `brick.button.levelup`, `brick.button.leveldown`,
  `brick.key.pads` and `brick.key.drive` in en/ru/es (`brick.key.cursor` and
  `brick.key.flip` are gone with the old Memory).

## 0.2.0

### Minor Changes

- 166f118: The console becomes playable on a live lobby — the owner's session and two integrators' reports, in plain words:

  - **The game chips work.** `<WaitingGame/>` pinned `game="tetris"`, so the row of chips under the field was controlled with no handler and clicked to nothing. Selection is now the console's own by default (`defaultGame`, internal state, the chips switch on a click, each game keeps its own best score); `game` + `onGameChange` is the controlled pair, and a `game` given without `onGameChange` only seeds the choice.
  - **A press lands at once.** 0.1.x queued presses and drained them at the next gravity tick — at level 1 a Left could wait 620 ms. Now a press is applied the moment it arrives and gravity is the only thing on the step.
  - **Tetris controls and tempo.** ArrowDown / S is a soft drop (a row and a point per press; held, the fall runs ten times faster and pays a point a row until the piece locks), ArrowUp / W is a hard drop (straight to the landing shadow, two points a row), Space rotates. Level 1 falls one row per 500 ms (was 620) and every level is 15 % faster than the last — 425, 361, 307 … down to 60 — `LEVEL_SPEEDUP` and `stepMsForLevel` say so.
  - **Snake at speed.** Holding the key of the direction of travel doubles the speed; release, or turn, and it drops back.
  - **Start / Pause and Reset are buttons**, on desktop and on a phone, in one tight column to the right of the field with Score / Best / Level / Next — a mouse never needs the keyboard. A paused field wears a veil that says so and resumes on click.
  - **It comes back with the person.** The blur / hidden-tab pause never resumed, and a guest who switched tabs came back to a still field with no labelled way to restart it. `resumeOnReturn` (default true) restarts a run the blur stopped on focus / visible; a board the person paused, or the host holds, stays paused.
  - **A legend instead of a keypad on a fine pointer**, generated from each game's own `controls` (arrows / WASD, Space, Enter, R, with what each does in _this_ game). On a coarse pointer the keypad stays, compact and centred, the action button visibly larger than a d-pad key, and a button presses on pointer-down and holds until the thumb lifts.
  - **Layout.** The field is centred, the stats + buttons column sits tight against it, the chips go directly under, the keypad or legend under those; every gap is a token spacing step.
  - The 0.1.1 key contract stays: `captureKeys` (`"focus"` default, `"global"` opt-in), `enabled`, `paused`, editable and interactive targets keep their keys, an earlier `preventDefault()` wins.

  **For hosts that wrapped the console in a capture-phase key hook** to keep it from swallowing their own shortcuts: with `captureKeys` defaulting to `"focus"` that wrapper now stops the console's keys as well. Delete the wrapper, or pass `captureKeys="global"` to keep 0.1.0's window listener (with the editable-target guard).

  Engine surface (`@stapel/brick-react`): `Game` gains optional `hold(action, held)` and `speed()`; `GameDefinition` gains `controls`; `BrickSession` gains `hold`, `releaseAll` and `stepMs`, and `press` applies immediately; `LEVEL_SPEEDUP` is exported. No audio code; `useBrickGame`'s cleanup stops the session, which cancels the pending frame.

## 0.1.1

### Patch Changes

- 218eee5: `<BrickConsole/>` stops taking keystrokes that are not its own, and both components gain the host controls an integrator asked for:

  - **An editable target keeps its keys.** The 0.1.0 window listener called `preventDefault()` on arrows, Space, Enter and `r` without looking at the target, so a form field beside a mounted game (an upload's title, typed while the game filled the wait) lost those characters. A key whose target is `input`, `textarea`, `select`, anything `contenteditable`, or anything inside one is no longer the game's.
  - **A focused button or link keeps Space and Enter.** The same listener made a keyboard-only person unable to activate any focused control on the page while a game ran — a lobby's "leave" button included. A target matching `button`, `a[href]` or `[role=button]` keeps Enter and Space (arrows are still the game's), inside the console and outside it; a test presses both on a focused button, a link and a `role="button"` beside a running game and asserts `defaultPrevented === false` and no pause.
  - **The host can decline a key, or all of them.** `captureKeys: "focus" | "global"` — `"focus"` is the new default: the frame is focusable and reads keys only while focus is inside it. `"global"` is the opt-in for the window-level behaviour 0.1.0 had; 0.1.0's listener sat on the same node and phase as a host's own shortcut hook and ignored `defaultPrevented`, so neither order nor `stopPropagation` could separate them. Now, in either mode, a handler that ran first and called `preventDefault()` keeps the key (a tour overlay stepping on ArrowLeft/Right) — tested with a window listener registered ahead of the console. `enabled={false}` detaches every key handler while the board stays on screen. The contract is written down in the README.
  - **Locale is documented and proven.** The package already registers with core's engine the fleet way (`registerBrickI18n`, `registerBrickI18nRu`/`Es` on the subpaths, `useOptionalI18n` in the components); the README now states the three things a host must mount for a locale to apply, and a test renders the console under a host engine switched to `ru`. The graceful English floor outside a provider is unchanged.
  - **`paused`** on `<WaitingGame/>` and `<BrickConsole/>` (and `useBrickGame`) holds the game without unmounting it: the tick stops, the board and score stay, Start is inert until the hold clears, and clearing it resumes only a run the hold itself stopped — a board the person paused stays paused.

  - **`size="auto"`** is the new default: `sm` on a coarse pointer, `md` otherwise — the question the keypad already asks, so a host stops reading `useCoarsePointer` itself to pick a phone size. Explicit `sm` / `md` / `lg` are kept on any pointer; on a fine pointer nothing changes.

  `<WaitingGame/>` forwards `size`, `captureKeys`, `enabled` and `paused` unchanged.

  Confirmed for two hosts, no change needed: the package has no audio code, and `useBrickGame`'s cleanup stops the session, which cancels the pending animation frame.

## 0.1.0

### Minor Changes

- 3342e96: New package: **stapel 4-bit games** — the pixel brick-game handheld as a
  frontend-only library, for the waits a product cannot shorten (a meeting product's
  "waiting to be admitted to the room", a recordings product's "uploading / analysing").

  - **The engine** (`@stapel/brick-react`, no React in it): `createLoop` — a
    fixed simulation step fed by accumulated frame deltas, so a 120Hz phone and a
    throttled background tab run the same game at the same speed, with catch-up
    capped at five steps and the rest of the debt forgiven rather than
    fast-forwarded; `createRng` (seeded mulberry32 — the reason a Tetris test can
    assert a line clear at all); a bounded input queue drained by the tick; the
    grid model; and `createBrickSession`, which wires them in the one correct
    order (drain, tick, render).
  - **Six games** behind one four-method interface, each declaring its own panel.
    **Tetris** (10×20) and **Snake** (20×20) are complete — rotation kicks, line
    clears and levels; queued turns, growth, wall and self collision.
    **Arkanoid**, **Racing**, **Tanks** and **Memory** are minimal, playable, and
    say exactly what they do and do not have in the README table.
  - **`<BrickConsole/>`** (`/default`): the LCD as a DOM grid in four token
    shades — the unlit segment ghost of a real panel up to the lit pixel — the
    side panel (score, best, level, next piece), keyboard controls, a game menu
    when more than one game is allowed, and the original handheld's keypad on a
    coarse pointer only, every target at the phone control height and every
    icon-only button carrying its name. Honours `prefers-reduced-motion`, pauses
    on blur and on a hidden tab, and never resumes by itself.
  - **`<WaitingGame/>`**: one caption, one console, controlled by the host's own
    `active` flag. On the falling edge it unmounts — loop, key listener and
    frames all gone — and calls `onDone` exactly once, however many times it is
    re-rendered afterwards.
  - **Local high scores** per game through `@stapel/core`'s
    `createRepository("brick-highscores", { scope: "app", storage: "local" })`,
    with every read and write wrapped: a browser that refuses to store anything
    degrades to "no high score yet" instead of taking down the page the console
    was embedded in.
  - en/ru/es for every string, including the four waiting captions.
