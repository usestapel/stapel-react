---
"@stapel/chat-react": patch
---

The desktop inbox's empty right pane is a pane, and the divider between the two
runs the full height.

Measured by the reviewers at 1440: the thread pane was roughly 950 by 700 of
nothing with a caption floating near its top, and the rule between the panes was
a 130px stub stopping in mid-air while the list beside it ran about 330px
further down.

Both come from one declaration each. The grid is `align-items: start` — which is
right, and stays: a short list must not stretch a long thread's card. But the
divider is the thread pane's own border, so with nothing selected the pane was
as tall as one `<Empty>` and the line was as long as the empty state rather than
as long as the screen it divides. Only that pane now takes the row's height
(`align-self: stretch`); the list beside it is untouched. And the empty state
carried a top margin and nothing else, which in a pane that tall reads as a
stray caption: it now stands in a box that centres it on both axes over the
pane's whole height, with a half-viewport floor so the invitation is still in
the middle of something when the list beside it is short.

A host's own `empty` node is centred by the same box: where the right pane's one
piece of content sits is a decision about this arrangement's layout, and this
component is the one that makes those.
