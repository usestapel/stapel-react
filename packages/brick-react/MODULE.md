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
  (`tick` / `input` / `render` / `status`) and one registry. Tetris and Snake
  are complete; Arkanoid, Racing, Tanks and Memory are minimal and say so, in
  the README table and in each module's own header. A game declares its own
  panel size, so the console takes its shape from the game rather than the other
  way round.
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
- **`onGameOver` reports; it does not persist.** The store is a separate,
  injectable seam (`highScores`), so a demo can hand it one that remembers
  nothing and a host can hand it one backed by its own account.
- **The loop forgives debt beyond the cap.** Carrying a hidden tab's sixty
  seconds would either freeze the frame or fast-forward the game past
  everything the person wanted to see. Both are worse than losing the time.
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
