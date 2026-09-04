---
"@stapel/search-react": minor
---

search: the sections a query reached are ONE line, drawn from the answer that drew the cards

A storefront's results page carried a block titled "Categories for «auto»":
one full-width row per section, fourteen of them under the results — and it
appeared a beat AFTER the results, because it came from a second request to
`/suggest`. So the page a person had already started reading moved under them,
for information that was not new. `/query` had answered with
`facet_meta.categories` — `{path, count}` for every section the candidate set
contains, the same list the block was printing — and the type-ahead had shown
the same sections a keystroke earlier.

**`<SearchPage otherCategories categoryName={...}>`** (and the same two props
on `<SearchResultsPane>`) draws it as a line above the results:

> Search in other categories: **Cars 12** · **Buses 3** · **Motorhomes 1** · 5 more

- **the rows come from the SEARCH response**, so the line is in the document in
  the same commit as the first card. With results on screen this feature makes
  no request at all — the test asserts zero `/suggest` calls on the wire, not
  merely that nothing is drawn twice;
- **the one exception is an empty result**, which by definition has no
  candidates and is the screen where the sections are worth the most. There
  `/suggest` is asked, into a slot whose height is reserved from the first
  frame, so the answer lands without moving anything — filled or empty;
- **the counts are the answer's own** and the line is capped at 8 with the tail
  folded behind "N more"; on the phone surface the cap halves to 4 and the
  collapsed line is clamped to two rows besides, because it is name LENGTH and
  not entry count that turns a line back into a block;
- **pressing an entry narrows the search on screen and keeps the query.** The
  count beside a name is the count for THIS query in that section; a link to
  the bare category feed would show a different, larger number one click later,
  so the caption would be a lie. Each entry is a real `<button>` whose
  accessible name says what it does.

Naming an id path stays the host's, the same seam `categoryLabel` fills for the
category chip: `categoryName` is tried first, then the server's own name (a
`/suggest` answer already in the query cache names the rows for free), then the
path's last segment when it is a slug. A row none of the three can name is
dropped rather than printed as `163`.

New: `useOtherCategories`, `OTHER_CATEGORIES_LIMIT`, `OTHER_CATEGORIES_PHONE_LIMIT`,
`otherCategoryLeaf` from the main entry; `<OtherCategoriesLine>`,
`otherCategoriesCss()`, `OTHER_CATEGORIES_CLASS`, `OTHER_CATEGORIES_STYLE_HREF`,
`OTHER_CATEGORIES_PHONE_ROWS`, `OTHER_CATEGORIES_SLOT_MIN_HEIGHT` from
`./default`. Opt-in: a page that passes neither prop is byte-for-byte what it
was.

Size limits raised with their reasons in the entry names: index 12.5 → 13 KB
(the headless read), default 26.25 → 27 KB (the line — a net deletion on the
page that mounts it), i18n/es 3.5 → 3.75 KB (three strings).
