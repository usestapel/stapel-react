---
"@stapel/listings-react": patch
---

The seller dashboard's tab is in the address, and a badge cannot contradict
the rows under it.

- **`?tab=`.** `/account/listings?tab=drafts` opened Active, a reload threw
  the tab away, and there was no address that meant "my drafts" — the tab was
  component state, which is the same as nowhere. It now reads and writes
  `?tab=` (new `model/tabAddress.ts`); `initialTab` (now a prop on
  `<MyListingsPane>` too) stays as the fallback for when the address names
  none, and an address outranks it because an address is the person's own
  statement about what they want to see. An unknown value falls back rather
  than opening an empty list. Every other parameter is preserved, and the
  write REPLACES: switching tab is a read of your own dashboard, and a push
  per tab makes Back walk Archive → Drafts → Active before it leaves the page.
  A host with a router passes its own `MyListingsAddress`; `NO_ADDRESS` opts
  out.
- **D407: never `0` while a row is visible.** The tab groupings live in two
  places — `my/counters` aggregates them server-side, `MY_LISTINGS_TAB_STATUSES`
  decides which statuses a tab asks for — and any disagreement (an older
  counter, a status added upstream) lands as a badge contradicting the list: a
  moderator-rejected listing sat in Drafts under a `0`. The new
  `MyListingsBag.tabCounts` raises the OPEN tab's number to the rows actually
  on screen. A floor, not a replacement — the rows are one keyset page and the
  counter is the whole set, so the larger number still wins — and it says
  nothing about the tabs a person is not looking at.
