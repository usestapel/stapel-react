---
"@stapel/search-react": minor
---

The popular-values band's heading is a pair of TABS, and both of them stay on screen.

The band drew a caption naming the axis with an «all of it» link beside it.
Pressing the link swapped the block for the full list and took the caption AND
the link away with it, so there was no way back to the busiest dozen at all —
the founder's read of the live site on 2026-09-13, against a reference that
draws the same control as two tabs which both stay visible.

`<PopularValuesTabs>` is that control: two tabs on one line, the selected one in
the page's own text colour and the other in the brand colour, both from the
design system's roles. `<PopularValues popularLabel>` turns the band's own
heading into it; `activeTab` says which half is on screen and `onShowPopular` is
the way back, beside the `onShowAll` this component already had. The component is
exported on its own because the SWAP belongs to the HOST — the expanded list is
frequently the host's own block — and tabs that stand over only one of the two
halves are the same defect on the other one.

**The roles are not decoration.** Two buttons that recolour each other are, to a
screen reader, two unrelated buttons: nothing says they are alternatives and
nothing says which one is in force. So it is a real `role="tablist"` — one tab
stop, a roving `tabIndex`, `aria-selected` as the state, `ArrowLeft`/`ArrowRight`
/`Home`/`End` with the selection following focus, and the values box named as the
`tabpanel` the selected tab controls.

**The first tab's label is a PROP and that is a boundary rather than a
preference.** The sentence needs the section noun in a grammatical form nothing
in the catalogue declares: a category carries a `name` and no plural, no case and
no gender, and on this fleet's own tree those names include bare imperatives
("I will buy", "I will rent") and bare adjectives with no noun at all. A pair
that glued a word in front of them would be writing another language's grammar in
TypeScript. The host routed the visitor to this leaf and knows what it is called
— the same boundary, and the same shape, as the listing pane's `questionTopic`.

A host that passes no `popularLabel` gets exactly the caption-and-link row it has
today.
