---
"@stapel/chat-react": minor
---

An inbox row says WHICH kind of attachment, not just "some".

`preview_reason: "attachment"` is one word that is true of every attachment and
descriptive of none, so a photo, a voice note and a PDF all drew the same
paperclip. `model/previews.ts` said so in its own doc comment and named the
missing upstream field as the thing that would make five marks possible.

**stapel-chat 0.10.0 ships it**, and the manifest moves `>=0.9 <0.10` →
`>=0.10 <0.11`: `LastMessageResponse.attachment_types` (the DISTINCT types the
last message carries, in order of appearance) and `attachment_count` (the
TOTAL), computed from the message's own stored descriptors inside the query the
list already runs. No CDN call per row — the same batch discipline that keeps
this pair from describing a bubble.

`inboxPreviewMarks(last)` is the new rule: one glyph per distinct kind —
image/gif → picture, video → film, audio → microphone, file → clip — capped at
three, plus the `+N` for whatever the marks do not already stand for
(`count - glyphs.length`, so six photos read "picture +5" and not "+6", which
would count the one the mark is showing twice). The registry is OPEN on both
sides, so the table is explicitly **not an enum**: a type this build has never
heard of draws the generic clip rather than vanishing off the row.
`inboxPreviewGlyph` is kept for hosts drawing their own row and now answers the
first of those marks.

A **captioned** photo draws its caption AND its mark, which is why the marks are
read off `attachment_types` rather than off `preview_reason` (that field only
ever spoke for the wordless case). In that arm — and only there — the strip
enters the accessibility tree as `role="img"` with the "Attachment" label,
because the sentence beside it no longer says so; where the sentence does say
it, the strip stays `aria-hidden` rather than making a reader hear the same fact
twice.

A **tombstone** draws its own mark and nothing else, and the rule checks
`preview_reason` rather than trusting the list to be empty: a withdrawn message
must not announce what it had, whichever half of the wire is answering.

A server OLDER than 0.10.0 sends neither field, and **absent is not empty**: the
row keeps the single generic clip it drew before, exactly where it drew it. A
blank strip there would be this pair reporting "nothing attached" about a
message it cannot see inside — a rollout lags its pair every day it runs.
