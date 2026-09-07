---
"@stapel/brick-react": patch
---

Two wording defects a host found running 0.6.0 live. No behaviour changes.

**The level stepper's accessible name said something that is usually false.**
`brick.button.levelup` / `brick.button.leveldown` read "Higher starting level" /
"Lower starting level" in English and "Nivel inicial más alto / más bajo" in
Spanish. Since 0.6.0 that button most often does NOT touch a starting level: over
a run in progress it moves the LIVE run's level, and on an autostarting console
(the one `<WaitingGame/>` mounts) that is the case from the first frame. A
sighted player sees a plus and a number; a screen-reader player was told about a
start that was not going to move. The names now say the level and nothing more —
`"Higher level"` / `"Lower level"`, `"Nivel más alto"` / `"Nivel más bajo"` —
which is true in both cases and matches the Russian bundle, which already read
«Уровень выше» / «Уровень ниже». The keys are unchanged, so no host has to touch
its overrides.

**The 0.6.0 notes drew the in-progress line in the wrong place.** They described
the fresh-deal arm as "ready, over, or a deal nobody has touched", which reads as
though an untouched autostarted board is re-dealt. It is not: the whole test is
`!over && (running || played)`, and `running` counts on its own, so an `autoStart`
console is in progress before anybody presses anything and its board is moved
rather than dealt again. The fresh deal is reachable only from the other side of
that line — a run that is `over`, or a board whose loop is stopped and which has
taken no tick and no press. That sentence sent one integrator's work at the wrong
arm; it is corrected in the CHANGELOG, the README table, MODULE.md and the
`setStartLevel` / `<BrickConsole/>` doc comments, all of which now quote the
condition rather than paraphrase it.
