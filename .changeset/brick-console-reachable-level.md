---
"@stapel/brick-react": minor
---

The level a person can actually pick, a veil that promises the key focus really has, focus given back, and a frame announced with its controls — four defects a host found using 0.4.0 for real.

**The starting-level stepper was dead on arrival in the console everybody ships.**
0.3.0 disabled it "while a run is under way", and `<WaitingGame>` autostarts — so
in an autostarting console both buttons were `disabled` in the very first frame
and the level could never be picked at all — the stated requirement, "the
starting level can be chosen with a plus and a minus", going unmet everywhere it
mattered. The lock now applies to a run **the person started**: an `autoStart`
console keeps its stepper live, and changing the level there does what the
stepper has always done — deals a fresh board at the new level — which then
plays on, because that is what `autoStart` means. A console that starts on a
gesture still locks, so a mis-aimed plus cannot throw away a board somebody was
playing. The number the stepper steps from is now the level **on screen**, so a
run that has levelled up past its start level still moves when the plus is
pressed.

**The paused veil promised Enter where the package itself declines it.** The hint
was chosen from `captureKeys`, so `"claim"` and `"global"` always said "press
Enter" — but the package's own guarantee is that a focused button or link keeps
Space and Enter, and a console revealed by a host toggle leaves focus on that
toggle. The promised Enter collapsed the host's panel instead of resuming; only
a console that had taken page focus with `autoFocus` made the promise true. The
hint is now chosen from **where focus actually is** — inside the frame it always
reaches the console; outside it reaches only in a window mode, and only when the
focused element is not one that keeps Enter for itself — and it follows focus
while the veil is up. The click still works from wherever focus sits.

**`autoFocus` took focus and never gave it back.** Hiding the console unmounted
it and focus fell to `<body>`, dropping a keyboard-only person at the top of the
document; a host could not add the other half of the disclosure pattern because
the element focus came from is known only inside the package at unmount. Focus
is now restored on unmount to the element it was taken from — only where
`autoFocus` actually moved it, only if that element is still in the document,
and never over a focus the person has since chosen themselves.

**The frame was announced without its keys.** `role="group"` and a name read as
"group, brick game console" and stopped, though a key legend is rendered on
screen for a fine pointer. The frame now carries `aria-describedby` pointing at
whichever control surface is rendered: the **legend** on a fine pointer, so the
description is the key list itself, and the **keypad** on a coarse one, where
the description is the pad's own name — the buttons are on screen and reachable
by touch, and reciting seven of them before the game starts helps nobody.

Prop and markup changes, all additive except one deliberate removal:

- `<Keypad>` takes an optional **`id`** (new prop), so the console can point
  `aria-describedby` at it; it also carries `data-testid="brick-keypad"`.
- `<BrickConsole>`'s frame carries **`aria-describedby`**.
- The key legend **no longer carries an `aria-label`**: a described element's
  label stands in for its contents, so a legend named "Keys" would have
  described the console as "Keys" and the key list would never be read. The
  `brick.legend.label` i18n key stays declared and shipped in all three locales
  (it is public surface), it is simply no longer rendered.
- `autoFocus` now has an unmount behaviour as well as a mount one — the same
  prop, one more half of the pattern.
- No change to `captureKeys="claim"` semantics, `onPhaseChange`, `paused`,
  `resumeOnReturn`, the editable/focused-control guards, `defaultPrevented`
  outside a run, or the veil's click-to-resume.

`default`'s size budget rises 11.35 → 11.65 KB (measured 11.55 KB).
