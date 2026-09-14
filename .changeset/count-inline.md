---
"@stapel/search-react": patch
---

A popular value's count sits inline after the label, not at the column edge

The row was a flex with the count as a sibling, so a label that WRAPS filled
its column and pushed the number to the far right, level with the label's
first line — a three-line entry with an orphan count floating against the
column edge, nowhere near where the words end. Invisible while every value
was one word; the wrap fix that let long values fold is what made it appear.

The reference sets them inline ("Ford 33 008"), and inline is also the only
arrangement in which the number can follow the last word of a wrapped label:
a sibling box can only ever sit after the label's whole box, which for a
wrapped label is the full column width. So the count moves INSIDE the value,
in the design system's secondary ink read off the live token.

Pressing the number applies the same value as pressing the word, which is
what a reader expects of one entry.
