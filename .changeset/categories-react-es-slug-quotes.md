---
"@stapel/categories-react": patch
---

The Spanish refusals quote the slug, like the Russian ones already did.

Contract pin to stapel-categories `v0.21.7`, which fixed two es texts that
dropped `{slug}` into prose bare — a multi-word slug read as the sentence
continuing and losing its ending:

- `error.400.categories_duplicate_slug`: `Ya existe una característica con el slug {slug}` → `…con el slug «{slug}»`
- `error.404.categories_slug_not_found`: `No existe ninguna categoría con el slug {slug}` → `…con el slug «{slug}»`

`docs/errors.json`, `docs/flows.json` and `docs/schema.json` are byte-identical
across the span, so only the es locale bundle regenerates; nothing else in this
package moves.
