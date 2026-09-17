---
"@stapel/search-react": patch
---

`FacetLabels.level` is nullable, like the `vocabulary` it belongs to.

The union case — a group fed by several dictionaries — nulls `vocabulary`
AND `level` in the same answer, and the generated member declares `level`
optional but not nullable. A fixture captured from that wire did not compile,
which is the type telling the truth about a shape the server does send.
Re-declared beside the other documented corrections; this pair reads no
`level` from here (only `vocabularies[].level` names one it can resolve
against), so nothing downstream changes.
