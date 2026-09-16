---
"@stapel/search-react": minor
---

A facet group fed by SEVERAL dictionaries is still a dictionary.

`facet_labels[slug].vocabulary` names the one dictionary a group's codes come
from, and the server nulls it in two different situations: an inline `select`
with no vocabulary at all, and a group fed by several, where there is
genuinely no single address. stapel-search 0.17.2 adds `vocabularies` — every
contributing dictionary, in the order the captions were resolved from — so the
two nulls can finally be told apart.

They could not be before, and it showed. `facetGroupIsVocabularyBacked` asks
the schema first and falls back to the answer when there is none — and a
parent page has no schema by construction. So the union case nulled the
singular field, the fallback concluded "not a dictionary", and the panel drew
a checkbox per value where the searchable sheet belongs — on exactly the pages
whose lists are longest. The measured shape is a pets root over a cat-breed
level and a dog-breed level.

`FacetGroup.vocabularies` carries the contributors whole rather than
collapsing to the first: "no single address" is a true and useful fact, and a
client that fetched from a first-of-many address would be reading one
catalogue for a group drawn from several. What it is enough for is the only
question the panel asks — which control to draw — and that does not depend on
how many.
