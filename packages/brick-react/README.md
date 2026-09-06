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
claims. Every one of them is playable, deterministic from its seed, and ends.

| Game | Panel | Completeness | What it has | What it does not have |
| --- | --- | --- | --- | --- |
| **Tetris** | 10×20 | **full** | seven tetrominoes, four rotations each, wall kicks off walls and stacks, line clears at 100/300/500/800 × level, a level per ten lines, next-piece preview, soft drop, game over on a blocked spawn | hold piece, hard drop, T-spin scoring, lock delay |
| **Snake** | 20×20 | **full** | queued turns (no reversal into the neck), growth per pellet, death on wall and on self, a level per five pellets, bounded food placement | walls-wrap mode, obstacles |
| **Arkanoid** | 20×20 | minimal | 4-wide paddle, one ball, four rows of two-wide bricks, wall/brick/paddle bounces, paddle-offset angle, clearing the wall ends the run | multi-hit bricks, power-ups, extra lives, second ball |
| **Racing** | 20×20 | minimal | four lanes, oncoming traffic, dashed verges that scroll, a point per car passed, a level per ten, crash ends the run | acceleration curve, more than one car shape, a crash sequence |
| **Tanks** | 20×20 | minimal | player tank roaming a five-row home band, one bullet in flight, descending enemies, 20 points a kill, an enemy reaching you ends the run | enemies that shoot back, destructible terrain, lives |
| **Memory** | 20×20 | minimal | 4×4 board of eight pairs, D-pad cursor, OK to turn a tile, a mismatched pair turns back after three ticks, 50 points a pair, clearing the board ends the run | a timer, a miss penalty, more than one board size |

## `<BrickConsole/>`

```tsx
import { BrickConsole } from "@stapel/brick-react/default";

<BrickConsole
  game="tetris"
  games={["tetris", "snake", "memory"]} // >1 draws a menu; 1 draws none
  size="md"                             // sm | md | lg — the LCD pixel size
  onGameOver={(score, game) => track(game, score)}
/>;
```

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
- **Keyboard**: arrows move, **Space** is OK (rotate / fire / turn a tile),
  **Enter** starts, pauses and resumes, **R** resets. The listener is on the
  window rather than on the frame, because a console dropped into a waiting
  screen is never the focused element.
- **Keypad on a coarse pointer only** — `(pointer: coarse)`, not a narrow
  window: a phone-sized browser window on a laptop still has arrow keys. Every
  target is at least the phone control height from the token scale, and every
  icon-only button carries its own accessible name.
- **It pauses when nobody is looking** (window blur, tab hidden) and **never
  resumes by itself**: coming back to a paused board is a decision; coming back
  to a piece already three rows down is a bug report.
- **`prefers-reduced-motion`** removes the cell transition. The game still
  runs — the request was about decoration.

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

const session = createBrickSession({ definition: TETRIS, seed: 7 });
session.press("left");
session.step();              // drain inputs → tick → render, in that order
gridSignature(session.grid); // the frame, as a comparable string
```

- `createLoop` accumulates real elapsed milliseconds and runs whole fixed steps,
  so a 120Hz phone and a throttled background tab simulate at the same speed.
  Catch-up is capped at five steps a frame and the rest of the debt is
  **forgiven**: a tab that was away for a minute comes back where you left it,
  not thirty seconds into a piece you never saw.
- `createRng(seed)` is mulberry32. Same seed, same deal — which is what makes a
  Tetris test able to assert a line clear at all.
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

## Demos

`pnpm gen:demos` projects `demo/*.demo.tsx` into the showcase. Two demos, eleven
variants: every game at its opening frame from a fixed seed, the menu, the
keypad at phone width, and the waiting card in all three of its states.
