---
"@stapel/brick-react": minor
---

The console becomes playable on a live lobby — the owner's session and two integrators' reports, in plain words:

- **The game chips work.** `<WaitingGame/>` pinned `game="tetris"`, so the row of chips under the field was controlled with no handler and clicked to nothing. Selection is now the console's own by default (`defaultGame`, internal state, the chips switch on a click, each game keeps its own best score); `game` + `onGameChange` is the controlled pair, and a `game` given without `onGameChange` only seeds the choice.
- **A press lands at once.** 0.1.x queued presses and drained them at the next gravity tick — at level 1 a Left could wait 620 ms. Now a press is applied the moment it arrives and gravity is the only thing on the step.
- **Tetris controls and tempo.** ArrowDown / S is a soft drop (a row and a point per press; held, the fall runs ten times faster and pays a point a row until the piece locks), ArrowUp / W is a hard drop (straight to the landing shadow, two points a row), Space rotates. Level 1 falls one row per 500 ms (was 620) and every level is 15 % faster than the last — 425, 361, 307 … down to 60 — `LEVEL_SPEEDUP` and `stepMsForLevel` say so.
- **Snake at speed.** Holding the key of the direction of travel doubles the speed; release, or turn, and it drops back.
- **Start / Pause and Reset are buttons**, on desktop and on a phone, in one tight column to the right of the field with Score / Best / Level / Next — a mouse never needs the keyboard. A paused field wears a veil that says so and resumes on click.
- **It comes back with the person.** The blur / hidden-tab pause never resumed, and a guest who switched tabs came back to a still field with no labelled way to restart it. `resumeOnReturn` (default true) restarts a run the blur stopped on focus / visible; a board the person paused, or the host holds, stays paused.
- **A legend instead of a keypad on a fine pointer**, generated from each game's own `controls` (arrows / WASD, Space, Enter, R, with what each does in *this* game). On a coarse pointer the keypad stays, compact and centred, the action button visibly larger than a d-pad key, and a button presses on pointer-down and holds until the thumb lifts.
- **Layout.** The field is centred, the stats + buttons column sits tight against it, the chips go directly under, the keypad or legend under those; every gap is a token spacing step.
- The 0.1.1 key contract stays: `captureKeys` (`"focus"` default, `"global"` opt-in), `enabled`, `paused`, editable and interactive targets keep their keys, an earlier `preventDefault()` wins.

**For hosts that wrapped the console in a capture-phase key hook** to keep it from swallowing their own shortcuts: with `captureKeys` defaulting to `"focus"` that wrapper now stops the console's keys as well. Delete the wrapper, or pass `captureKeys="global"` to keep 0.1.0's window listener (with the editable-target guard).

Engine surface (`@stapel/brick-react`): `Game` gains optional `hold(action, held)` and `speed()`; `GameDefinition` gains `controls`; `BrickSession` gains `hold`, `releaseAll` and `stepMs`, and `press` applies immediately; `LEVEL_SPEEDUP` is exported. No audio code; `useBrickGame`'s cleanup stops the session, which cancels the pending frame.
