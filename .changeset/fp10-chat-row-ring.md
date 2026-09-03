---
"@stapel/chat-react": patch
---

The conversation row shows that it has focus

D65 made the whole row the control by wrapping it in an element styled
`color: inherit; text-decoration: none` — a hit area with no chrome of its
own. What went with the chrome was the focus ring: a keyboard walk of a live
inbox landed on this element and measured `outline-style: none` with no
box-shadow, so a person tabbing their conversations could not see which one
Enter would open. The largest focus target on the screen was the one with
nothing to show for it.

`conversationRowCss()` and `ROW_OPEN_CLASS` are exported so the rule is
something a test can read.
