---
"@stapel/chat-react": patch
---

The inbox row shows the listing's thumbnail and price, not only its title.

`ConversationListPanel`'s row used to draw a conversation's subject
(stapel-chat 0.6.0) as a bare title line, even though the same card already
carries a price and a photo (`readSubjectCard`). The row now draws all three
on one line — thumbnail, title, price — while the avatar, unread badge and
timestamp behave exactly as before. A conversation with no subject, or one
whose card could not be built, renders exactly as it always did.

New export: `SubjectRowSummary` (`@stapel/chat-react/default`), for a host
composing its own inbox row who wants the same line.
