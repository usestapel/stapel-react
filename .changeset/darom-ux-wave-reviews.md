---
"@stapel/reviews-react": patch
---

The rating's absence and the review list's absence are no longer the same
sentence.

`reviews.rating.none` and `reviews.list.empty` both read "No reviews yet" in
every catalogue, and both render on any page that mounts the aggregate above
the list — the darom storefront's listing page printed the identical words
twice, forty pixels apart, which reads as a rendering bug rather than as two
facts. The aggregate now says "No rating yet" / «Оценок пока нет» /
"Todavía no hay valoración".
