---
"@stapel/categories-react": minor
---

categories: the catalogue gets a desktop mega-menu, a browse-stage rule, and tiles that draw the picture the server already resolved

**`children_as`, and the two page shapes it decides.** Every category node now
carries a resolved presentation of its children. `tiles` means the children are
real subcategories and the page is a grid of them; `chips` means they are a
partition of ONE template — the same attribute set split by a value their name
expresses (new/used, buy/sell/rent, boys/girls) — so the parent's page is a
feed with a single-select chip row rather than a level of the tree. Nothing is
removed from the tree: the children keep their ids, paths and URLs and stay the
placement target of a listing. `browseStage(category)` folds it into the two
shapes a storefront actually renders, and reads a row's `tn_children_pks`
before a nested `children` array — a depth-capped tree read empties that array
on its last level, and taking that for "leaf" would give a whole level of the
catalogue the wrong page.

**`useCategoryTree(depth = 3)`** is `GET /tree/?depth=N`: active nodes, ordered,
nested, four fields plus `children_as` each, in one server-cached call. The
alternatives it replaces are one request per branch on the coldest page a
storefront has, or the whole catalogue table (1.4 MB, twenty seconds measured)
before the first name can be drawn.

**`<CategoryMegaMenu>`** draws it: roots with their icons on the left, the
chosen root's second-level headers on the right, five third-level links under
each and a tail link to the header past that — a column that grew to the length
of its longest branch would set the height of the whole panel from one crowded
category. Hover, focus and the arrow keys select a root, `ArrowRight` steps into
the pane and `ArrowLeft` comes back, and the rail is a real `menu` of
`menuitem`s with roving tabindex. Escape and a click outside CALL `onClose`
rather than hiding the panel: a panel that closed on its own and a trigger that
still reads "open" are two answers to one question. `minWidth` (default 1024) is
a guard, not a policy — below it the component renders nothing and asks for
nothing, and the phone keeps the tile grid with no drawer.

**A tile draws `catalog_icon` when it is already an address.** The rule was
never "no `<img>`", it was "never a GUESSED url" — and once a catalogue is
seeded, `catalog_icon` holds the uploaded asset's own URL, so refusing to draw
it was refusing to show art the server had already resolved. Three arms now, in
this order: the host's `renderIcon` (a storefront with hardcoded root glyphs
keeps them), then an address the row already carries, then the monogram. An
opaque reference like `catalog/electronics` is still never turned into a URL,
which is what `categoryIconSrc` decides on its own and under test.
