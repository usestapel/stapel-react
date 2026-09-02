---
"@stapel/listings-react": minor
---

The edit screen speaks the edit's own language. On an already-published
listing the composer's primary read like first publication and "Save draft"
beside it silently parked the edit in the draft twin — a seller's first round
of edits was lost to that pair of labels. On the live-edit arm
(`bag.isLiveEdit`) the primary now reads "Save changes"
(`listings.compose.republish`, re-worded in en/ru/es), the quiet exit reads
"Stash as draft" (`listings.compose.save_live`, new), and its confirmation
names the fate: "Changes stashed as a draft — the published listing is
unchanged" (`listings.compose.saved_live`, new). A draft keeps the draft
words on both buttons.
