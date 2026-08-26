---
"@stapel/reviews-react": minor
---

The one interaction becomes a control, and a refused pane says so once.

**NC-GATEDNOISE.** `moderation-queue--not-a-moderator` rendered the full
moderation UI to a non-moderator: a live Reason input per row, two disabled
verdicts per row, and the same refusal sentence six times in three rows. The
queue is now wrapped in the substrate's `PaneGate`: not being a moderator is a
fact about the VIEWER, so it is stated once and nothing that invites an act the
viewer may not perform is drawn at all. When the pane IS available, identical
per-control reasons pool into one footnote the controls point at.

The reply composer gets the same treatment through a new `canWrite` gate on the
`ReviewResponseForm` bag — everything about the viewer and the review, with the
"you have not typed anything yet" check left to `canSubmit`. `seller-s-reply--
not-the-owner` was a live-looking textarea over a switched-off Send with the
refusal as a 12px caption; it is one sentence now, with the sign-in door beside
it when that is the reason.

**The star row.** The package's single interaction shipped at ~22px glyph on a
~33px pitch. The substrate's phone branch now gives `Rate` the touch floor; this
pair adds the measure that makes a 1–10 scale wrap 5 + 5 instead of a ragged
8 + 2, and a caption that says what the ends of the scale mean — a row of stars
alone says neither.

**NC-THEMESCOPE.** `SignInLink` shipped no `SkinTheme` of its own, so the only
door on three screens kept antd's LIGHT tokens under `data-theme="dark"` and
rendered dark grey on near-black. It self-themes now, and gains
`variant="primary"`: on a blocked review form, signing in is the only thing left
to do, and it was a 24px text link trailing a sentence with no punctuation
between them.

Also: one `StatusTag` family per moderation state instead of four chip
treatments; `reviews.status.unknown` stops printing the server's own token
("Unknown state: quarantined") at a moderator; the scope notice loses three
lines of spec prose; "Show more" and "That is all of them" no longer render
under an empty list; and a moderation row's Reason field is one line instead of
a label, an input and a hint repeated per row.
