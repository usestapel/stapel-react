# @stapel/brick-react

**Something to do while you wait.** A 4-bit brick-game console — the pixel
handheld everybody had — as a frontend-only Stapel library: a tiny fixed-step
engine, six games as pure modules, a console skin drawn entirely in §68 design
tokens, a phone keypad, and local high scores.

It exists for the waits a product cannot shorten: a meeting product's *waiting to be
admitted to the room*, a recordings product's *uploading / analysing*. Those screens are a
spinner and a sentence today. This puts a console under the sentence, and takes
it away the moment the wait ends.

No backend module. No network. Nothing leaves the device.

```tsx
import { WaitingGame } from "@stapel/brick-react/default";

<WaitingGame reason="admission" active={!admitted} onDone={enterRoom} />;
```

## The two layers

| Import | What you get | React? |
| --- | --- | --- |
| `@stapel/brick-react` | the engine: loop, grid, input queue, seeded RNG, the six game modules, the high-score store, the i18n keys | no |
| `@stapel/brick-react/default` | `<BrickConsole/>`, `<WaitingGame/>`, `<Keypad/>`, `useBrickGame` | yes |
| `@stapel/brick-react/i18n/ru`, `…/es` | the opt-in locale bundles | no |

## The games, and how complete each one is

Stated honestly, because "six games" and "six finished games" are different
claims. Every one of them is playable, reproducible from a seed if you pin one,
a NEW game if you do not, and ends.

| Game | Panel | Completeness | What it has | What it does not have |
| --- | --- | --- | --- | --- |
| **Tetris** | 10×20 | **full** | seven tetrominoes, four rotations each, wall kicks off walls and stacks, line clears at 100/300/500/800 × level, a level per ten lines, next-piece preview, soft drop (held: ten times the fall), hard drop, game over on a blocked spawn. **Neither drop pays a point** — the score is the wall coming down | hold piece, T-spin scoring, lock delay |
| **Snake** | 20×20 | **full** | queued turns (no reversal into the neck), growth per pellet, death on wall and on self, a level per five pellets, bounded food placement, twice the speed while the key of its own direction is held | walls-wrap mode, obstacles |
| **Arkanoid** | 20×20 | minimal | 4-wide paddle, one ball, four rows of two-wide bricks dealt with their own gaps every game, wall/brick/paddle bounces, paddle-offset angle, clearing the wall ends the run | multi-hit bricks, power-ups, extra lives, second ball |
| **Racing** | 9×20 | minimal | **two** lanes, the handheld's four-row car with **blinking wheels**, oncoming traffic in the same shape, dashed verges that scroll, a held ↓ for the accelerator, 10 points a car passed, a level per ten, crash ends the run | more than one car shape, a crash sequence, gears |
| **Tanks** | 13×17 | minimal | the drawn 3×3 tank, turning with the direction it drives; enemies that **enter at the four corners**, patrol their band and shoot; shells twice a tank's speed; **three lives**, marked above the player's band; 20 points a kill | destructible terrain, a base to defend, more than one shell in the air |
| **Memory** | 12×12 | **full** | four 2×2 pads in a d-pad, each **growing to 4×4** as it lights; a sequence that grows by one every round; the starting level is how many blinks round one has; a wrong repeat ends the run; 20 points × the length of the round | a timer, a shrinking window to answer in |

## `<BrickConsole/>`

```tsx
import { BrickConsole } from "@stapel/brick-react/default";

<BrickConsole
  games={["tetris", "snake", "memory"]} // >1 draws a row of chips; 1 draws none
  defaultGame="snake"                   // the chips switch on click; see below for a controlled pair
  size="auto"                           // auto (default) | sm | md | lg
  onGameOver={(score, game) => track(game, score)}
/>;
```

**The host contract**, in one table:

| Prop | Default | What it does |
| --- | --- | --- |
| `games` | `[]` | The chips. More than one draws the row; the console picks the first as its opening game. |
| `defaultGame` | first of `games`, else `tetris` | Where an uncontrolled console opens. The chips switch games on click; each game keeps its own best. |
| `game` + `onGameChange` | — | The controlled pair: the click reports, the prop decides. A `game` given *without* `onGameChange` only seeds the choice, and the chips still switch. |
| `size` | `"auto"` | `sm` on a coarse pointer, `md` otherwise; `sm` / `md` / `lg` pin it. |
| `captureKeys` | `"focus"` | Where the keys are read from — [Keys](#keys). |
| `enabled` | `true` | `false` detaches every key handler while the board stays on screen. |
| `paused` | `false` | Hold the loop from outside; the board stays; clearing it resumes only a run the hold stopped. |
| `resumeOnReturn` | `true` | A run the blur or the hidden tab stopped starts again on focus / visible. A board the person paused never is. |
| `autoStart` | `false` (`true` in `<WaitingGame/>`) | Start on mount. |
| `startLevel` | `1` | The level the first run opens on. The person moves it with the stepper. |
| `autoFocus` | `false` | Focus the frame on mount — the keys, handed over in the same click that opened the console. |
| `ref` | — | The frame element, for a host that focuses it later. |
| `onPhaseChange` | — | `ready` / `running` / `paused` / `over`, once on mount and once per change. |
| `seed`, `highScores`, `onGameOver`, `ghostPixels` | — | Pin the deal (omit for a new game every run), the store, the report, the LCD ghost. |

## Layout

The field is centred; **Score / Best / Level / Next, Start-Pause and Reset**
sit in one tight column immediately to its right, so a mouse never needs the
keyboard; the game chips go directly under; and under those, the keypad on a
coarse pointer or the key legend on a fine one. Every gap is a step of the
token spacing scale. A **paused field wears a veil** — "Paused — click here or
press Enter" — and clicking it resumes.

The **Level** row is a stepper: a minus, the number, a plus. It picks the level
a run STARTS at — the tempo, the multiplier and (in Memory) the length of the
opening sequence all move with it — deals a fresh board on every change, and is
disabled the moment a run is under way, because changing it mid-run would mean
throwing that run away.

- **The LCD is DOM, not canvas.** Four hundred `<span>`s follow `data-theme`
  for free, are assertable in a test, and announce as one named image. A canvas
  would need the palette read back out of `getComputedStyle`, would paint
  nothing in jsdom, and would be invisible to a screen reader.
- **Four shades**, off to lit, all token roles: `border-subtle` (the unlit
  segment ghost of a real LCD), `text-subtle`, `text-muted`, `text`. Pass
  `ghostPixels={false}` for a panel whose off cells are truly blank.
- **The panel is the game's shape**, not a fixed one: Tetris is 10×20 and has a
  next-piece box; the others are 20×20 and have none. An empty preview box and
  "this game has no preview" are different facts and look different.
- **`size="auto"` is the default**: `sm` on a coarse pointer, `md` otherwise —
  the same `(pointer: coarse)` question the keypad asks, so a host no longer
  reads `useCoarsePointer` itself to pick a phone size. An explicit `sm` /
  `md` / `lg` is kept on any pointer.
- **Keyboard**: arrows or **WASD**, **Space** is OK (rotate / fire / turn a
  tile), **Enter** starts, pauses and resumes, **R** resets. Which element the
  keys are read from, and which keys are never the game's, is a contract — see
  [Keys](#keys) below. A held key is a *hold* the game can read: Tetris
  soft-drops while DOWN is held, Snake runs at double speed while the key of
  its own direction is held.
- **`paused`** holds the loop from outside: the tick stops, the board and
  score stay, and Start does nothing until the hold clears. Clearing it
  resumes only a run the hold itself stopped — a board the person paused is
  theirs to resume.
- **Keypad on a coarse pointer only** — `(pointer: coarse)`, not a narrow
  window: a phone-sized browser window on a laptop still has arrow keys. Every
  target is at least the phone control height from the token scale, the action
  button is visibly larger than a d-pad key, every icon-only button carries
  its own accessible name, and a button presses on pointer-down and holds until
  the thumb lifts. On a fine pointer the keypad's place is taken by a compact
  **legend**, generated from the game's own `controls`.
- **It pauses when nobody is looking** (window blur, tab hidden) and **comes
  back with the person** (`resumeOnReturn`, default true): a run the blur
  stopped starts again on focus / visible, the loop forgives the time away, so
  the piece is where they left it. A board the person paused stays paused.
- **`prefers-reduced-motion`** removes the cell transition. The game still
  runs — the request was about decoration.

## Keys

```tsx
<BrickConsole captureKeys="focus" />   // default: keys only while the frame has focus
<BrickConsole captureKeys="global" />  // the window: plays without ever being focused
<BrickConsole enabled={false} />       // no key handler at all; the game stays on screen
```

### The key map, per game

The console owns arrows / WASD, Space, Enter and R. What each does is the
game's to say — every module declares its `controls`, and the legend under
the field is generated from them, so this table and the screen cannot drift.

| Game | ← → / A D | ↑ / W | ↓ / S | Space | Enter | R |
| --- | --- | --- | --- | --- | --- | --- |
| **Tetris** | move | hard drop | soft drop — hold for ten times the fall, a point a row | rotate | start / pause | reset |
| **Snake** | turn | turn | turn | — | start / pause | reset |
| | *holding the key of the direction of travel doubles the speed; release, or turn, to drop back* | | | | | |
| **Arkanoid** | move the paddle | — | — | — | start / pause | reset |
| **Racing** | change lane | — | accelerate — hold | — | start / pause | reset |
| **Tanks** | drive and aim | drive and aim | drive and aim | fire | start / pause | reset |
| **Memory** | the left and right pads | the top pad | the bottom pad | — | start / pause | reset |

A press is applied the moment it lands, not at the next tick — gravity runs on
the level's step, hands do not.

**The repeat is the console's, not the operating system's.** A held arrow does
not reach a page as a stream of presses: the OS waits about half a second and
only then starts echoing, and that pause is what a paddle feels as lag. So the
console starts its own repeat off the HOLD — the first echo after 130 ms, then
one every 55 ms (`BRICK_REPEAT_DELAY_MS`, `BRICK_REPEAT_RATE_MS`) — and DROPS
the OS's echo, so one key down is never two moves. Which buttons repeat is the
game's to say: every module declares `repeat`, and a button whose hold means
something else (Tetris' soft drop, Snake's accelerator) is deliberately not in
it.

### Tempo

Tetris falls one row per **360 ms at level 1** and each level is **15 %
faster** than the last — 306, 260, 221, 188 … — down to the loop's 60 ms
floor (`stepMsForLevel`, `LEVEL_SPEEDUP`). Snake ticks every 180 ms, Arkanoid
150, Tanks 150, Racing 170, Memory 180; the same curve applies to each, from
whatever level the stepper was left on.

- **`captureKeys="focus"` is the default.** The frame is focusable
  (`tabIndex={0}`): a click or a Tab lands the keys on the console, and a
  keystroke anywhere else on the page is not the game's. A host that embeds a
  console next to a form gets the form's keys back for free.
- **`captureKeys="global"`** is the opt-in for a console that must play
  without ever being focused — the original waiting-screen case, and the right
  answer for a console that autostarts behind a host toggle, where `"focus"`
  would hand somebody a running board with dead keys. It reads the window
  POLITELY, so the guarantees below are what keeps it from swallowing the page.
- **`captureKeys="claim"`** is `"global"` plus one rule: **while a run is
  actually running**, the console reads on the CAPTURE phase and stops the keys
  it takes. `"global"` yields to any handler that called `preventDefault()`
  first, and window listeners fire in registration order — so a host shortcut
  surface that mounted before the console silently eats the arrows and the game
  gets nothing, which makes a working console a matter of mount order. `"claim"`
  removes the accident: the thing being played gets its own arrows first. The
  moment the run is not running — ready, paused, over — it is `"global"` again,
  because a board nobody is playing has no claim on the page's keyboard. Every
  guarantee below still holds in `"claim"`: an editable target, a focused
  button's Space and Enter, and the modifier chords are never taken.
- **`autoFocus` hands the console the keyboard in the gesture that opened it.**
  A host that reveals the console from a toggle button had two options and
  neither was right: a second gesture into the frame, or going page-wide. This
  is the third — the frame takes focus on mount and `"focus"`'s narrow scope is
  kept. `ref` gives the same frame element back for a host that wants to focus
  (or blur) it later.
- **An editable target keeps its keystrokes in both modes**: `input`,
  `textarea`, `select`, anything `contenteditable`, or anything inside one.
  Typing a title while an upload's game is mounted never loses an `r` or a
  Space.
- **A focused button or link keeps Space and Enter** (`button`, `a[href]`,
  `[role=button]`), so the console's own menu, and the host's "leave" next
  to it, stay reachable by a keyboard-only person while a game is running.
  Arrows are still the game's.
- **A handler that runs first and calls `preventDefault()` keeps the key.** A
  tour overlay stepping on ArrowLeft/Right can decline them; the console
  checks `defaultPrevented` before it acts. In `"global"` mode that handler
  must be registered before the console mounts (window listeners run in
  registration order); in `"focus"` mode a capture-phase handler on any
  ancestor runs first regardless. In `"claim"` mode this is true everywhere
  except during a run, which is the entire point of the mode — pick `"global"`
  if the host's shortcuts must always win.
- **`enabled={false}` detaches everything** — no window listener, no
  `tabIndex`, no `onKeyDown` — for a host that wants to hand the keyboard to
  something else while the board stays visible. Modifier chords (⌘/Ctrl/Alt)
  are never claimed.

- **The paused veil promises only what is true.** It is always clickable, from
  wherever the host left focus. It offers **Enter** only in `"global"` and
  `"claim"`, where Enter actually reaches the console; in `"focus"` it reads
  "Click here to carry on", because Enter belongs to whatever the host focused
  — typically the button that opened the panel, which would collapse it.

`<WaitingGame/>` forwards `captureKeys`, `autoFocus`, `enabled`, `paused`,
`startLevel` and `onPhaseChange` unchanged.

### Knowing what the console is doing

`data-phase` on the frame says `ready` / `running` / `paused` / `over`, and
**`onPhaseChange(phase)`** says the same thing to the host — once on mount and
once per change, never twice for a re-render. Reading the attribute is not the
supported way to find out whether a run is under way; this is. The same phase
is on `useBrickGame`'s bag for a host building its own skin.

## `<WaitingGame/>`

One caption and one console, controlled by the host's own flag.

```tsx
<WaitingGame
  reason="processing"   // admission | processing | upload | queue
  active={status !== "ready"}
  onDone={() => navigate(`/recordings/${id}`)}
  games={["snake", "tetris", "memory"]}
  size="sm"
/>
```

`active` is the host's state, not the component's. On the falling edge the
console unmounts — loop, key listener and frames all gone — and `onDone` fires
**exactly once**; a re-render that passes `active={false}` again fires nothing,
because a host that navigates away in `onDone` would otherwise do it twice. A
second wait arms it again.

`paused` is the other host flag: it holds the game **without** unmounting it
(a modal opened over the wait, a step of a tour), and the board is exactly
where it was when the hold clears.

## High scores

One number per game, on the device, through `@stapel/core`'s
`createRepository("brick-highscores", { scope: "app", storage: "local" })` —
the one sanctioned client-side store (`stapel/no-raw-storage` makes that
mechanical). `scope: "app"` because a score belongs to the browser someone
played in, not to a session, and it must survive a logout.

**Blocked storage is a normal outcome, not an error.** Safari in private mode,
a locked-down profile, a partitioned third-party iframe: `setItem` throws
*synchronously* there. Every read and write is wrapped; a shut store degrades
to "no high score yet" and the game plays exactly the same. A waiting-room game
that crashed the page it was embedded in to protect a high score would be the
worst possible trade.

## The engine, without React

```ts
import { createBrickSession, TETRIS, gridSignature } from "@stapel/brick-react";

// No seed: a new game. `seed: 7` instead, and the run replays cell for cell.
const session = createBrickSession({ definition: TETRIS, seed: 7, startLevel: 3 });
session.press("left");
session.step();              // drain inputs → tick → render, in that order
gridSignature(session.grid); // the frame, as a comparable string
```

- `createLoop` accumulates real elapsed milliseconds and runs whole fixed steps,
  so a 120Hz phone and a throttled background tab simulate at the same speed.
  Catch-up is capped at five steps a frame and the rest of the debt is
  **forgiven**: a tab that was away for a minute comes back where you left it,
  not thirty seconds into a piece you never saw.
- `createRng(seed)` is mulberry32. A session with no `seed` draws a fresh one
  per game (and per reset), which is why a second play is not the first play
  again; a session given one replays exactly, which is what makes a Tetris test
  able to assert a line clear at all. `Math.random` is called in exactly one
  place in the package — that first seed — and nowhere after it.
- A game is four methods (`tick` / `input` / `render` / `status`) and no clock
  of its own. Adding one is a file in `src/headless/games/` plus a line in that
  directory's registry.

## i18n

`BRICK_I18N_KEYS` + `registerBrickI18n(engine)`, with `ru` and `es` on opt-in
subpaths. The components resolve copy through core's engine when there is one
and fall back to this package's own English bundle when there is not — a
waiting screen is exactly the surface a host mounts before its providers are
up, and a keypad announcing itself as `brick.pad.left` is worse than one
reading "Left" in the wrong language.

**For a locale to apply, the host must do three things** — the same three
every `@stapel/*` pair asks for. A console inside a Russian page that still
reads in English is missing one of them:

```tsx
import { createI18n, I18nProvider } from "@stapel/core";
import { registerBrickI18n } from "@stapel/brick-react";
import { registerBrickI18nRu } from "@stapel/brick-react/i18n/ru";

const i18n = createI18n({ locale: "ru" });
registerBrickI18n(i18n);      // 1. the English floor, once at startup
registerBrickI18nRu(i18n);    // 2. the locale bundle, from its subpath
// 3. the engine on the tree above the console — the same provider the
//    rest of the page uses; the console reads it through useOptionalI18n
<I18nProvider i18n={i18n}>
  <WaitingGame reason="upload" />
</I18nProvider>;
```

Without the provider the console never sees an engine and reads its own
English floor; with the provider but without step 2 the engine has no `ru`
key to answer with and the floor shows through per key. Neither throws.

## Demos

`pnpm gen:demos` projects `demo/*.demo.tsx` into the showcase. Two demos, eleven
variants: every game at its opening frame from a fixed seed, the menu, the
keypad at phone width, and the waiting card in all three of its states.
