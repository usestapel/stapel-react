---
"@stapel/brick-react": minor
---

The games are the handheld's again, and a second play is a new game.

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
