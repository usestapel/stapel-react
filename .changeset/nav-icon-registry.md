---
"@stapel/shell-react": minor
---

The nav menu draws icons instead of empty squares, and stops reserving a
column for a menu that is not there.

`NavEntry.icon` is a name the registry in `default/icons.tsx` resolves to a
glyph, the registry knew four names, and the pairs in this monorepo declare
sixteen — so twelve of them fell to the generic square. On a public storefront
whose only public menu entry is the catalogue, the top navigation rendered a
literal "□" beside the word. The twelve missing glyphs are drawn (still inline
SVG, still no `@ant-design/icons` dependency), and a test derives the required
list from the generated nav manifest, so a pair adding a name the registry has
never heard of is now a failing test rather than a square on somebody's
navigation bar. The fallback stays for a name from outside this monorepo, where
it is the honest answer.

`<PublicShell>`'s browse row no longer lays out the menu's flex spacer when
there is no menu. A host can legitimately have a `categorySlot` and no nav tabs
— a storefront whose every menu entry duplicated a link in the strip beside it,
say — and the greedy `flex: 1 1 auto` on an empty div then ate the whole row
and shoved the categories against the right edge, under a header whose brand
sits at the left.
