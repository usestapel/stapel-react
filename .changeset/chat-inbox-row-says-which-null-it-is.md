---
"@stapel/chat-react": patch
---

**An inbox line with no words says WHICH kind of no words it is.** Pinned to
stapel-chat **v0.8.4**, which adds `LastMessageResponse.preview_reason`
(`services.last_line_reason`, decided over the same columns `drawn_last_line`
reads). `inboxPreviewLine` reads it and nothing else: `deleted` draws
`chat.list.preview_deleted` — the sentence this pair has carried the copy for
since it had an inbox and had no way to reach — `attachment` and `system` draw
theirs, and `null` means the line has words, which the row draws.

The guess is deleted rather than kept beside it. A tombstone and an
attachment-only message arrived as one `null` with `kind: "text"`, so the row
said "Attachment" over a message somebody had deleted: right for the common
case, and a lie about their words for the other. `kind` decides nothing about
this line any more. The one arm that still reads it is a 0.8.3 server, which is
inside the `>=0.8 <0.9` range this pair announces and sends no `preview_reason`
at all — there the previous reading stands, marked as the degradation it is,
because a blank line would say "nothing has been said here" and that is a
different row's sentence.

The schema declares no enum for the field (a bare nullable string), so the
union is narrowed at this pair's own edge as `LastMessagePreviewReason` — the
same documented correction `MessageKind` and `ConversationKind` already carry —
and `previewReason()` is exported beside `inboxPreviewLine` for a host drawing
its own row. The follow-up named in `MODULE.md` is met and marked closed.
