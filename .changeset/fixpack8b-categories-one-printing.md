---
"@stapel/categories-react": minor
---

categories: a tile caption breaks instead of hyphenating OR ellipsizing, and the cascade prints its path exactly once

Both halves of this are the same lesson from the same screenshot: the previous release fixed what was measured and broke the thing next to it.

**The tile caption.** Turning `hyphens: auto` off removed the invented hyphen, and turning `overflow-wrap: anywhere` down to `break-word` at the same time removed the BREAK — so a caption too wide for a 128px compact tile stopped wrapping and the clamp ellipsized it on its first line instead. Nine letters and a dot is not better than a hyphen. `anywhere` is back and `hyphens: manual` stays: the word breaks in the same place hyphenation would have chosen, the whole caption is readable, and nothing on screen is a character the catalogue author did not write.

**The cascade prints one path.** Removing the crumb tags took the chosen path from three printings to two, and the second was subtler than the first: every rung below the top was LABELLED with its parent's name, and a rung's parent is, by construction, the chosen value of the rung directly above it — visible, one control away, in a bigger type size. A three-level path therefore read "Electronics / Electronics / Phones / Phones / Mobile phones" on the phone's filter sheet, which is what the walker actually filed (D103; the composer's step 3 was the same shape, D89).

Only the FIRST rung of a ROOTED cascade keeps a visible heading now, because there the parent is the root the tiles handed over at — a category no rung is showing, so the word is information rather than an echo. Every other rung keeps its heading in `aria-label`, where it was never a duplicate: a select whose only name is its value still announces what it is a choice OF.

The regression test counts, rather than describing the shape — the shape kept changing while the count stayed at three.
