---
"@stapel/listings-react": patch
---

Fixed the seller cabinet stamping "a moderator is looking at this by hand"
on rows whose lifecycle had already moved past the verdict (D225). A
`needs_review` moderation verdict now gets the same three-way read as a
`pending` one: the live-edit sentence while the listing is published, the
first-review sentence while it is still awaiting its first publish, and the
"a review was requested but the listing is no longer for sale" sentence for
a sold/paused/archived/draft row carrying a stale verdict — instead of the
manual-review sentence printing unconditionally on all four.
