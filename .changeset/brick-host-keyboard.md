---
"@stapel/brick-react": minor
---

Who owns the keyboard, answered — four things a host found the first time it
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
