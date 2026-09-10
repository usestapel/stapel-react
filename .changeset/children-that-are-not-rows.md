---
"@stapel/categories-react": minor
---

A child is not always a row: pointers and values (stapel-categories 0.22.0).

The pin moves to v0.22.0 and `GET /{id}/children/` stops answering an array of
`Category`. It answers `CategoryChild`, a union of three: a real subcategory; a
POINTER into another branch (`linked: true`, every other key the TARGET's, so
following it lands on the target's own page) inserted at the `order` its
operator gave it AMONG the real children; and, on a category that expands a
feature into its children (`children_expand_by`), a VALUE with no row at all —
`name`, `value` and a `{feature slug: value}` `filter`.

A pointer costs the pair no rendering path, and that is the contract's own
promise kept rather than a shortcut: `CategoryRowChild` is `Category` plus
`linked`, so every reader, tile and link already handles one. What the flag
buys is the two refusals — `catalog/wrapper.ts` will not read a pointer as a
one-rung import wrapper and will not collapse it for a target that happens to
be `children_as: "transparent"`, either of which would put the inside of a
branch where an operator drew its door. `hasChildren` answers `false` for a
value before consulting anything else, so a lone value is not mistaken for a
wrapper either. `browseChildren` therefore passes both new kinds through
untouched and in place, and a level with neither comes back as the very same
array it was handed.

A value's address is the host's, and the pair will not guess one — the same
rule `categoryIconSrc` keeps about a CDN base.
`categoryChildTileEntries(children, basePath, hrefForVirtual?)` maps a whole
level in the server's order: rows and pointers become the usual
`CarouselEntry`, values become a `VirtualTileEntry` that `<CategoryTileGrid>`
draws with the value's own caption and a monogram, linking wherever
`hrefForVirtual(filter, child)` says. Without the callback a value is dropped
and a development build says so. `<CategoryPage hrefForVirtual>` threads it
into the page's `"tiles"` arm.

Also on the wire and now on the types: `children_axis_tag` beside
`children_axis_label` — the source catalogue's own identifier for the field a
level enumerates, never shown, where the label is the translation key a person
reads — and `children_expand_by`. The staff paths `/{id}/links/` are generated
and deliberately not on `CategoriesApi`: a storefront renders the assembled
child list, it never authors a pointer.

The skin's size budget goes 17.8 -> 18.5 KB. 143 B of that was already owed
before this change and 266 B is a value getting drawn; both are written into
the budget entry's own note.
