---
"@stapel/chat-react": minor
---

The thread list can be searched, and can show only what is unread.

The two-pane inbox had neither. A seller with three hundred threads reached
the one they wanted by scrolling — the reference classified leads its message
list with a search field and an unread tab, and this pair shipped a list with
no way to narrow it at all.

`<ConversationListPanel/>` now draws a toolbar under the pane heading: a
search field over the three things a row actually shows — the counterpart's
name, the listing the thread is about, and the last line when this client
holds one — and an **Unread** chip over the server's own `unread_count`, the
same number the row's badge carries. One row that wraps, so a narrow phone
pane drops the chip onto a second line rather than squeezing the field to
nothing; the chip is antd's `Tag.CheckableTag`, which is `role="checkbox"`
with `tabIndex={0}` and answers Space, so the filter is operable without a
mouse. The search field carries an accessible NAME rather than only a
placeholder — a placeholder disappears exactly when somebody arriving on a
filled field needs to be told what it is.

**Both are controlled-or-not, and the storefront needs no change.** Passing
nothing gives a working toolbar; `search` + `onSearchChange` (and
`unreadOnly` + `onUnreadOnlyChange`) hand the value to a host that wants the
filter in its URL, and a panel handed one never moves it on its own.
`defaultSearch` / `defaultUnreadOnly` seed a self-managing toolbar, and
`filters={false}` hides the CONTROLS while keeping the filter, for a host
driving both from chrome of its own. `<ConversationSplitPanel/>` forwards all
seven, for the reason it forwards `renderHeaderActions`: it mounts the list
panel itself, so a host composing the panes by hand could keep the filter in
the URL and a host taking the arrangement could not.

**The filter is client-side, and the pane says so.** `GET /conversations`
takes `anchor`, `direction` and `limit` and nothing else — no search term, no
unread filter (stapel-chat 0.8.0, the contract pin this pair is generated
against) — so the toolbar narrows the pages already loaded. Rather than let
that pass unstated, the pane prints "Filtering among the conversations loaded
so far" whenever a filter is on **and** another page exists; with everything
loaded the filter really is total and the line is absent, because a standing
caveat nobody can act on is the sentence people learn to stop reading. Named
as an upstream ask in `MODULE.md`: a `search` parameter over those fields and
an `unread=true` filter on the list endpoint.

**The two empty states stayed two sentences.** "No conversations yet" is an
empty inbox and draws no toolbar at all; "Nothing found." is the filter
finding nothing in an inbox that has plenty, with the toolbar still on screen
so there is a way back out. Telling somebody with three hundred threads that
they have none is the shape of failure this pair has shipped before in other
clothes.

Two things are deliberately NOT searchable: a deleted message and a system
line. Both render as something other than their body — a tombstone, and the
word "System" — so matching the body would find rows by text that is nowhere
on the screen.

Ceilings raised deliberately, measured with dependencies held constant (src at
HEAD, then with the change): `default` 16.26 → 17.00 KB (16.5 → 17.3), the
`i18n/ru` bundle 5.02 → 5.17 KB (5.2 → 5.5) and `i18n/es` 4.14 → 4.25 KB (4.3
→ 4.5) for five keys, and the headless `index` 10.80 → 10.93 KB inside its
unchanged 11.25 KB — the toolbar is skin, only its English floor is not. Most
of the skin's 740 B is antd's: `Input` and `Tag.CheckableTag` are two
components this subpath did not import before. The field measured LARGER
without `allowClear` (17.04 KB, inside the rounding), so the clear button
costs nothing and stays.
