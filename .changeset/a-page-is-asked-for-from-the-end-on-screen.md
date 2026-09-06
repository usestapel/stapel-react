---
"@stapel/attributes-react": patch
---

attributes: a vocabulary page is asked for from the end of the list on SCREEN

`useTermSearch`'s `more` closed over the current answer, so its identity
changed with every page that landed. The picker sheet installs its
end-of-list scroll listener in an effect keyed on exactly that identity
(`SkinPickerSheet`: `[onEndReached, sheetOpen]`), which means there is a real
window between the commit that PAINTS a page and the passive effect that
installs the matching listener — and a scroll landing inside it ran the
PREVIOUS closure. It asked for offset 50 a second time and appended the fifty
rows already on screen: a 120-term level went 50 → 100 → 150 with page two
duplicated and the last twenty terms unreachable by scrolling at all.

**The answer now lives in a ref written at the same moment as the state**, so
`more` is stable for the life of a level: the listener is installed once per
opening, there is no window to land in, and every request is measured from the
end of what is actually on screen. A page is applied only to the list it was
asked from — identity, not equality — so a reset or a landed first page drops
it rather than splicing rows measured against a different list.

Nothing about the paging contract changes: one page in flight at a time, a
response dropped unless its query still stands, the popular band still
extended only while everything held so far is inside it.

**How this was showing up.** `test/paging.test.tsx`'s first case failed
intermittently under CI load and blocked a Release publish once. It was a true
report of this defect, not a slow test: it asserted a row COUNT and then
scrolled again, and 50 → 100 is the same number whether page two is terms
50–99 or terms 50–99 twice. The suite no longer waits longer for it — it waits
for the SETTLED state (fresh list, nothing in flight, no row twice) after every
page, and drives `useTermSearch` directly with a deliberately stale `more`,
which is the exact call the gap used to let through and involves no timing at
all. The exhaustion probe's `setTimeout(30)` is gone with it.

Size: `dist/default/index.js` 19.25 KB holds — 19230 B, 8 B over the 19222 B
the same source measures without the fix.
