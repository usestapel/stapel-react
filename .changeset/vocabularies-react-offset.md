---
"@stapel/vocabularies-react": minor
---

`createVocabularyClient` pages: `search` accepts the seam's new `offset`
parameter and sends it as `?offset=` (omitted at zero), so a picker sheet
can walk a level past the first page instead of showing 50 rows of a
10,000-term level with no way to reach the rest.
