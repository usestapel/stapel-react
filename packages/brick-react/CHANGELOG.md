# @stapel/brick-react

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
