---
"@stapel/listings-react": minor
---

The list card fills its text column, with the description's opening

Measured at 1440: the card is 1088px, the photo takes 260 and the actions rail
179, leaving a ~600px text column holding a price, a title, an 81px spec line
and a place. The column was allocated and empty, which reads as a card that
stops halfway.

`descriptionSnippet` is the host's string and arrives ALREADY CUT — the search
projection carries `description_snippet`: plain text, ~160 characters, ended on
a whole word, with nothing appended. This card never re-cuts it, because the
second cut is the one that lands mid-word. It is drawn under the title in the
secondary tone, carrying the same shared clamp the title does, so one module
still answers "how does this card cut text" for every string on it.
