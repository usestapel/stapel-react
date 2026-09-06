---
"@stapel/listings-react": minor
---

A listing a moderator pulled has a tab, and a number (D407).

The desktop walk opened a cabinet holding one taken-down listing and read
three statements about it at once: the row itself, saying "taken down by a
moderator"; the counters over it, reading **"Active 0 · Drafts 0 ·
Archived 0"**; and the active tab's own empty state, saying nothing of the
seller's was live. The row was on the page, in no tab and in no number — and a
person reads the numbers. `blocked` is grouped by `my/counters` in none of the
three, so the pane fetched it separately and rendered it in a block above the
tab strip, which is exactly the half that was wrong: a row outside the tabs is
a row the counters do not describe.

**`removed` is the fourth tab.** `MY_LISTINGS_TABS` is the server's three plus
it; `MY_LISTINGS_COUNTED_TABS` and `countedTabOf()` are the three on their own,
for anything that has to line up with `MyCountersResponse`. Its rows are the
takedown read that already existed (`?status=blocked`, unpaged, running
whichever tab is open), so its **count is right while the seller is looking at
a different tab** — the state the defect was measured in. It is drawn only
where there is something in it, or where `?tab=removed` asks for it, and the
line above the tab strip stays as a LINE (`listings-mine-takedowns`, no rows),
so a takedown still cannot be missed without being printed twice on one screen.

Not folded into `archived`, which is the other shape this could take: that tab
reads the server's `archived` integer, which does not count takedowns, so the
badge would go on reading `0` for everyone not looking at it — and "I put this
away" and "a moderator took this down" are not one sentence.

**The gap this leaves, stated rather than papered over:** `my/counters` carries
three integers and no fourth, so the removed tab's number is the length of one
unpaged `?status=blocked` page. A seller with more takedowns than that page
holds would see the page and not the total, and there is no counter on the wire
to check it against.

`MyListingsTab` gains `"removed"`; `MyListingsSource` is deliberately **not**
widened — it stays typed `MyListingsCountedTab`, because the fourth tab never
goes through a host source and a source written before this release has no
answer for a tab it has not heard of.
