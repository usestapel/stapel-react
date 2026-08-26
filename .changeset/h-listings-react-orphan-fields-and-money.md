---
"@stapel/listings-react": minor
---

The composer stops drawing labelled voids, and a price is money.

**NC-ORPHANFIELD.** `SlotPlaceholder` is nothing in a production build — but
the `Form.Item` around it still drew its label, so a production composer with
unfilled slots rendered "Category", "Currency" and "Where it is" over empty
space and a "Photos" heading over air. A label is a promise that a control
follows it: the new `SlotField` renders the whole field or none of it, and the
Photos section renders no heading when it has no body. `slotVisibility="visible"`
pins the development view on, so a production-built showcase can still
photograph the named placeholders (the `unwired` story does).

The price row stops asking the currency question twice: the `RUB` addon inside
Price now appears only when no `renderCurrencyPicker` is wired.

**Money.** `<ListingPrice>` renders every price through
`@stapel/currencies-react` — `formatMoney` when the host mounted no catalogue,
`useMoney().format` when it did (which is how a rouble price gets `₽` in a
locale that has no glyph for it). It was `` `${price} ${currency}` `` — an ISO
code, no grouping, a forced `.00`, and the same string in every language. The
dependency is an OPTIONAL peer: absent, only the pure arm ever mounts.

**Gated noise, pagers and plurals.**
- `my-listings` refuses as a PANE: a visitor got the blocked notice above a tab
  bar still advertising "Active 2 · Drafts 3". Now one state, no dashboard.
- "This app has no screen for editing a listing yet" is a fact about the BUILD;
  it was printed once per row. Said once by the pane, and the button it refuses
  is not drawn.
- The favourites pager rendered "Previous" twice — the keyset gates name the
  missing page with the button's OWN label key, so the blocked button printed
  the word and its "reason" printed it again. Each direction now renders only
  when its page exists, with a real page indicator (`pageNumber`, new on the
  bag) between them.
- "**1** of your listings **were** taken down" goes through `tPlural`.
- The publish gate said "Fix the highlighted fields first" while nothing was
  highlighted: the mirror reaches the fields only after a publish attempt. Before
  that it now says how many required details are still empty.
- `listings.compose.blocked.unsupported_type` no longer interpolates the editor
  type: `size_grid` is this build's vocabulary and a seller can do nothing with
  it.

The composer footer leads with its primary (`Publish`, large) and demotes
"Save draft" to a text button; the dashboard and favourites gain measures so a
1280px window stops stranding row actions across 560px of nothing.
