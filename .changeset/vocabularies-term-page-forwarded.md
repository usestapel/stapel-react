---
"@stapel/vocabularies-react": minor
---

`search` answers with the PAGE, so the popular band survives the wire.

`stapel-vocabularies` 0.2.0 leads a term listing with a POPULAR BAND — the
short recommended set a level opens on instead of whatever the alphabet put
first. `@stapel/attributes-react` already draws it. It was getting nothing: the
client read the body as a page, projected each row to `{code, label,
has_children}` and returned a BARE ARRAY, so `band` was stripped from every row
and `popular_count` died with the envelope.

Now forwarded, untouched:

- **`band: "popular" | "all"`** on every `VocabularyTerm`, optional — a level
  nobody has ranked and a service older than 0.2.0 both send nothing, and an
  unrecognised literal is dropped rather than guessed.
- **`popular_count`** and **`total`** on the answer, which is now
  `VocabularyTermPage` — `{results, popular_count?, total?}`, the shape
  `@stapel/attributes-react`'s seam declares.

**The band is a SLICE at `popular_count`, never a filter on `band`.** The server
orders by `prefix_rank, popular_band, -popularity, sort, label`, so under a
query a page legitimately reads `[popular+prefix, all+prefix, popular, all]` —
two rows tagged `popular` of which only the first LEADS. A client that filtered
on the tag would lift row three over row two and destroy the typeahead ranking.
This client neither reorders nor re-tags; it hands the server's ranking on.

Widenings, not breaks:

- `VocabularyClient.search` returns `VocabularyTermAnswer =
  readonly VocabularyTerm[] | VocabularyTermPage`. A host backing the seam with
  an in-memory table keeps returning a bare array and keeps working; a caller
  that reads the concrete client's result now reads `.results`.
- `useTermSearch` gains **`popularCount`** on its state — the page's count, or
  the leading run of `band: "popular"` when a client answers with an array, and
  `0` (one plain list) when there is neither. It is `0` whenever `matched` is
  false: a list that does not answer the box has no band either.
- New exported types `VocabularyTermPage` and `VocabularyTermAnswer`.

`backend.contract` moves to `>=0.2 <0.3`: the generated wire types are now
`stapel-vocabularies` 0.2.0, which declares `band` and `popular_count`. The pair
still talks to a 0.1.x stand — the fields are optional on the seam and their
absence is one plain list — but that is runtime tolerance, not the contract this
surface was generated against.
