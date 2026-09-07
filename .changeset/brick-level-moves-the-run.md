---
"@stapel/brick-react": minor
---

A level change no longer costs a person their game.

Through 0.5.0 the level stepper had exactly one behaviour — deal a fresh board
at the new level — in every phase. In an autostarting console (which is every
console `<WaitingGame/>` mounts) that meant a plus pressed four hundred points
into a run deleted the board and the score silently, with no warning and no way
back. The handheld this package imitates never does that: the level is picked
before play, and during play it only ever rises.

The stepper now reads the board it is pressed over:

- **Nothing in progress** — ready, over, or a deal nobody has touched: a fresh
  board at the new level, exactly as before. That board then behaves the way the
  console was mounted; an `autoStart` console plays it, a manual one waits at
  Start.
- **A run in progress** — running, or paused on a board that has been played:
  the run itself moves. Tempo and score multiplier become the new level's; the
  board, the piece and the score are untouched, and whatever the run had already
  earned goes on counting from the level just picked.

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
