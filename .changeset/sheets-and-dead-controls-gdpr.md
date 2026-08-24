---
"@stapel/gdpr-react": minor
---

The account-closure confirm is a bottom sheet on a phone; four screens stop
offering what they cannot do or hiding what they must say.

The closure `Modal` now renders through `SkinDialog` with `maskClosable={false}`
— a destructive confirm should not be dismissible by a stray tap on the
backdrop.

"Request an archive" stayed enabled while one was already `pending` or
`processing`, reacting only after the server answered 429; the status was in
the same render all along. It is gated on the in-flight status now, with the
reason as visible text.

Three `Tooltip`s in `PendingDeletions` carried the ONLY copy of what the screen
exists to convey — what `timeout` means, which owners have not receipted, what
"fully erased by" measures. Hover-only, so on a phone a person reading about
their own deletion request got a bare tag and an unexplained column header.
That copy is text now.

`PendingDeletions` and `OwnersHealth` gained `scroll={{ x: true }}`, matching
`DsarQueue` one directory over. And DsarQueue's "Save note" no longer offers a
PATCH that writes the value already there.
