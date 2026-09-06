# @stapel/brick-react

## 0.1.0

### Minor Changes

- 3342e96: New package: **stapel 4-bit games** — the pixel brick-game handheld as a
  frontend-only library, for the waits a product cannot shorten (meettoday's
  "waiting to be admitted to the room", ironmemo's "uploading / analysing").

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
