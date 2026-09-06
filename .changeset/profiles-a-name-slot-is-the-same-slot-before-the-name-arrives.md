---
"@stapel/profiles-react": patch
---

profiles: a person's name as a page heading, with the heading's height reserved while the read is in flight (D453)

Measured on the stand: a seller page held a plain 24px line of muted loading
text above the results, and when the profile landed — 537ms after first paint —
that line was replaced by an `h4` with antd's heading margins, **86px in the same
slot**. The 46px difference pushed the line under it and the whole results grid
down the page. CLS **0.0281** at 1440 and **0.0396** at 1280: the only one of
four measured surfaces above 0.01, and one shift rather than many.

Neither state was wrong on its own. What was missing is that they are the SAME
SLOT, and only one side of the app knows how tall a heading is — this one. A
host cannot reserve a height it would have to compute out of antd's heading
tokens by hand, and a host that guessed would be back the next time the type
scale moved.

`<ProfileNameHeading name loading level>` is that slot. Loading does not render
a different element: it renders the same `<Typography.Title>` at the same level
holding a placeholder bar, so antd's margins apply identically and the line box
is one line in both states. The floor is stated as well — `profileNameCss()`
puts `min-block-size` on `PROFILE_NAME_CLASS`, read from a per-instance custom
property (`PROFILE_NAME_LINE_VAR`) that the component fills from the LEVEL's own
antd tokens, so a placeholder that shrank or a skin that retuned the heading
cannot quietly stop matching what it is reserving for. While it waits the
heading carries `aria-busy` and the pair's "loading the profile" sentence as its
accessible name, and the bar is `aria-hidden`; an empty `display_name` — routine
since stapel-profiles 0.15.0 provisions a row at registration — draws the pair's
word for a nameless profile rather than blank space. `data-state` publishes which
of the two is on screen.

Additive: no existing component changes, and `headingLineHeight()` is exported
for a host laying out beside the slot.
