# @stapel/brick-react — module guide

A frontend-only library with no backend module behind it. Human companion to the
generated `llms.txt` (agent context) and `manifest.json` (machine catalog);
`README.md` is the usage entry point.

## What this package is for

One sentence: **a product cannot always shorten a wait, so it can at least stop
pretending the wait is a screen.**

Two waits in the fleet started this. a meeting product's *waiting to be admitted to the
room* — the host has been pinged, and there is nothing on screen but a spinner
and a name. a recordings product's *uploading / analysing* — two minutes for a
forty-minute call, and the only feedback is a bar. Both are places where a
person is held, told nothing actionable, and left with a browser tab. A brick
console is the smallest honest thing to put there: it costs nothing, it needs
no network, and everyone born before the smartphone already knows the controls.

## Layers

- **headless/** — the engine, and the whole of it: `createLoop` (fixed step
  with delta accumulation and a catch-up cap), `createRng` (mulberry32, seeded),
  `createInputQueue` (bounded, drained by the tick), the grid model, and
  `createBrickSession`, which wires those four to one game in the one order that
  is correct: drain, tick, render. No React, no DOM, no clock — which is why a
  game can be tested by *playing* it.
- **headless/games/** — six pure modules behind one four-method interface
  (`tick` / `input` / `render` / `status`, plus optional `hold` / `speed` for a
  game with a hold behaviour) and one registry. Tetris, Snake and Memory are
  complete; Arkanoid, Racing and Tanks are minimal and say so, in the README
  table and in each module's own header. A game declares its own panel size, its
  own `controls` (the legend is generated from them) and its own `repeat` (which
  buttons a held finger should echo), so the console takes its shape, its help
  and its feel from the game rather than the other way round.
- **headless/highscores.ts** — one number per game through core's
  `createRepository`, `scope: "app"`. Every call is wrapped: blocked storage is
  a normal outcome on the surfaces this package is aimed at.
- **default/** — `<BrickConsole/>` (the LCD, the side panel, the keyboard, the
  menu), `<Keypad/>` (the coarse-pointer controls), `<WaitingGame/>` (the host
  helper), and `useBrickGame` (the console's state without its markup). Opt-in
  on the `./default` subpath; the package root stays React-free.
- **i18n/** — `BRICK_I18N_KEYS` + en/ru/es. The English bundle doubles as the
  fallback floor for a console mounted outside an `<I18nProvider>`.

## Decisions worth not re-taking

- **DOM grid, not canvas.** A canvas would have to read the palette back out of
  `getComputedStyle` to follow `data-theme`, would paint nothing under jsdom
  (so every visual assertion would be a lie), and would be a single unlabelled
  rectangle to a screen reader. Four hundred `<span>`s cost one render pass at a
  few frames a second and are worth every byte of it.
- **The keypad is gated on `(pointer: coarse)`, never on width.** The question
  is "can this person press an arrow key", and a phone-sized browser window on
  a laptop answers yes.
- **Keys are read from the focused frame by default, the window only on
  opt-in — and never from an editable target.** 0.1.0 read the window
  unconditionally and took `r` and Space out of a form field beside the game;
  a host pays for `captureKeys="global"` with the guarantees in README "Keys".
- **A run in progress may claim its keys; a board nobody is playing may not.**
  `"global"` yields to whoever called `preventDefault()` first, and window
  listeners fire in registration order — so through 0.3.0 a host whose shortcut
  surface mounted before the console had a game that silently got no arrows,
  and one whose mounted after had a working game, for no reason either of them
  could see. `"claim"` reads on the capture phase and stops the keys it takes,
  but ONLY while `phase === "running"`: the scope of the claim is the run, not
  the mount.
- **`autoFocus` exists because the alternative was going page-wide — and it
  gives the focus back.** A host that opens the console from a toggle button
  could either ask for a second gesture into the frame or take the whole
  window's keyboard. Focusing the frame on mount is the third answer and keeps
  `"focus"`'s scope. Through 0.4.0 it was only the taking half: hiding the
  console unmounted it, focus fell to `<body>`, and a keyboard-only person was
  dropped at the top of the document. The host cannot fix that from outside —
  at unmount the element focus came from is known only in here — so the restore
  belongs to the package. It fires only where the package actually moved focus,
  only onto an element still in the document, and never over a focus the person
  has since chosen themselves.
- **The veil names a key by where FOCUS is, not by the capture mode.** 0.4.0
  read the mode: `"claim"` and `"global"` promised Enter. But the package's own
  guarantee is that a focused button or link keeps Space and Enter — and a
  console revealed by a host toggle leaves focus on that toggle, so the promise
  was false in exactly the arrangement it was written for: the Enter collapsed
  the host's panel. Only a console that had taken page focus with `autoFocus`
  made it true. The hint now asks whether Enter would reach the console right
  now, and follows focus while the veil is up; the click always works.
- **The phase is published, not scraped.** `data-phase` is for a stylesheet and
  a test; `onPhaseChange` is for a host. A host reduced to reading an attribute
  is a host we forgot to give an API to.
- **A press is applied at once; gravity is what runs on the step.** 0.1.x
  queued presses and drained them at the tick, so at level 1 a Left could wait
  620 ms to happen — most of what "unplayable" meant.
- **Game selection is the console's unless the host takes it.** 0.1.x's
  `<WaitingGame/>` pinned `game="tetris"` and the chips under it did nothing;
  now `defaultGame` + internal state is the default and `game`/`onGameChange`
  the controlled pair.
- **It comes back with the person.** 0.1.x paused on blur and offered no way
  back but an unlabelled Enter; `resumeOnReturn` (default true) restarts a run
  the blur stopped, and a paused field carries a clickable veil.
- **`onGameOver` reports; it does not persist.** The store is a separate,
  injectable seam (`highScores`), so a demo can hand it one that remembers
  nothing and a host can hand it one backed by its own account.
- **The loop forgives debt beyond the cap.** Carrying a hidden tab's sixty
  seconds would either freeze the frame or fast-forward the game past
  everything the person wanted to see. Both are worse than losing the time.
- **A new game is a NEW game.** 0.2.x defaulted the session seed to the
  constant `1`, so every player on every stand opened Tetris with the same
  piece, met the same first enemy and was shown the same sequence — a second
  play was the first play again. The default seed is now drawn per session (and
  per reset) from the one `Math.random` call in the package; a `seed` passed in
  still replays exactly, which is what demos and tests stand on.
- **The games are the handheld's, drawn cell by cell.** Racing has TWO lanes
  and a four-row car whose wheels blink; Tanks is the 3×3 tank turning with its
  barrel, with enemies entering at the corners and patrolling; Memory is four
  2×2 pads in a d-pad that grow as they light. 0.2.x had four lanes of 3×3
  blocks, enemies that fell straight down, and a 4×4 grid of tiles — three games
  that shared a name with the originals and nothing else.
- **A drop is not a way to score.** Soft and hard drops paid 1 and 2 points a
  row through 0.2.x, which made leaning on ↓ the fastest way to a high score and
  the lines beside the point. Only line clears score now.
- **The key repeat belongs to the console.** The OS's own repeat starts about
  half a second after the key goes down; a paddle that waits that long reads as
  broken. The console repeats off the hold on its own timer and drops the OS
  echo — see README "Keys".
- **A level change moves the RUN, and only an idle board is dealt again.** The
  stepper went through three shapes to get here. 0.3.0 disabled it mid-run,
  because its one behaviour was "deal a fresh board" and a mis-aimed plus would
  throw a game away; but `<WaitingGame>` autostarts, so every console the owner
  actually saw was `running` in its first frame and both buttons were dead the
  instant they appeared. 0.5.0 kept them live there — and thereby shipped the
  defect in the open: a plus pressed four hundred points into a run deleted the
  board and the score, silently, with no way back. 0.6.0 stops treating "change
  the level" as "start again". A board with nothing in progress (ready, over, or
  a deal nobody has touched) is still dealt afresh at the new level. A run in
  progress — running, or paused on a board that has been played — MOVES: the
  session re-bases the level the game counts up from, so the level on screen
  becomes the one asked for, the step is re-timed to it, what the run earned
  goes on counting from there, and the board, the piece and the score are never
  touched. That is what the handheld does: you pick before you play, and during
  play the level only rises.
- **The one game that cannot is the one that says so.** In five of the six games
  the level is a tempo and a multiplier, and moving it under a live board is
  meaningful. In Memory the level IS the sequence being remembered — it is how
  many blinks the first round had, and the sequence in front of the player was
  dealt at that length — so moving the number would either lie about the pads or
  re-deal the very thing being remembered. Memory therefore carries
  `levelLockedMidRun` with the sentence that says why, the session refuses the
  change (without touching the board), and the console disables the stepper
  mid-run with that sentence as its `data-disabled-reason`. Per game, from the
  game — not a console-wide policy that would have to guess.
- **The level stopped being a session dependency.** The React defect underneath
  0.5.0's was mechanical: `startLevel` was in the dependency array of the effect
  that builds the session, so ANY change to it re-mounted the session — which is
  a re-deal by construction, whatever the intent. The level now lives in a ref
  plus a deal counter: the counter going up is how the hook ASKS for a new
  board, and a live change never touches it.
- **The frame is described by its controls.** `role="group"` plus a name reads
  as "group, brick game console" and stops — no mention of the keys, though a
  legend of them is on screen for a fine pointer. `aria-describedby` now points
  at whichever surface is rendered: the legend (whose contents ARE the
  description, which is why it lost its own `aria-label` — a described
  element's label replaces its contents) or, on a coarse pointer, the keypad,
  whose name is the honest answer for a device with no keys to list.
- **No analytics.** Every clickable here is marked
  `data-analytics="none"` with a reason: a game input is not a product
  interaction, and a funnel of how many times somebody pressed left while
  waiting for a room is noise in every dashboard it reaches.

## Gates this package sits under

Frontend-only, so it declares **no contract pin** (`manifest.backend` is
`null`, and `check:contract-pins` skips it by design), **no nav manifest**, and
**no analytics events**. It does carry the demo completeness gate, the strict
default-skin gate (`BrickConsole`, `WaitingGame` and `Keypad` are each rendered
from `src/default` by a demo, with a phone variant and a seeded step),
`check:peer-floors`, size-limit ceilings on all three entry points, and the
en/ru/es parity test.
