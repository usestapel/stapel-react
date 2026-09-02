---
"@stapel/tokens-antd": minor
---

`SkinPickerSheet` gains `onEndReached` — the sheet's half of paging through
a server-paged vocabulary. It fires when the end of the list is on screen
(from whichever ancestor actually scrolls, via a capture listener), and
fires again on every further scroll: the caller owns the fetch, the
de-duplication and knowing when the level is exhausted.
