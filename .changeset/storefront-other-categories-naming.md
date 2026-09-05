---
"@stapel/search-react": patch
---

"Search in other categories" no longer mounts late, or grows a row at a time

The line's rows come from the answer that drew the cards, but the NAMES are the
host's, and a host whose catalogue is a read of its own answers `undefined` for
every path until its request lands. A row nothing can name is dropped, so the
line was empty, then partly full, then full: 0.054 CLS for the late mount on a
phone SERP, and 0.148 where the names arrived one at a time and the line grew
onto a second row.

Two changes close it. The height of one line is reserved from the frame the
SECTIONS are known — not the frame the names are — whenever a line is actually
expected, and the drawn line carries the same floor, so the band and its
content are the same height by construction. And `categoryNamesPending`
(threaded through `<SearchPage>` and `<SearchResultsPane>`) lets the host say
its reads are still landing: while it is `true` the line draws nothing into the
reserved band, and when it turns `false` the line is drawn once, whole. Rows
nothing will ever name still reserve nothing.
