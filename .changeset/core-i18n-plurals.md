---
"@stapel/core": minor
---

`tPlural` / `useTPlural` — counted copy that is right in more than one language

The i18n engine did `{param}` substitution and nothing else, so every counted
sentence in the fleet was one string with one ending. On a live storefront that
reads as "Примерно 1 объявлений" — the estimate line above the results, correct
for 5–20 and wrong for every 1, 2, 3 and 4 a page actually shows. English hides
the defect (two forms, and `{count} results` is wrong only at 1); Russian has
four forms and shows it on the first page load.

**One mechanism, and it is the one the lint already speaks.** A plural message
is catalogued as one FLAT key per CLDR category —

```ts
"search.results.count_exact.one":   "{count} объявление",
"search.results.count_exact.few":   "{count} объявления",
"search.results.count_exact.many":  "{count} объявлений",
"search.results.count_exact.other": "{count} объявления",
```

— and rendered by naming the FAMILY:

```tsx
const tPlural = useTPlural();
<span>{tPlural("search.results.count_exact", { count })}</span>
```

`stapel/i18n-key-exists` has had `pluralFunctionNames: ["tPlural"]` since it
shipped: a `tPlural(…)` call's first argument is a family and the rule demands
`<key>.other` in the generated registry, where a `t(…)` call demands the key
verbatim. The runtime now spells it the same way, so a plural rendered through
the wrong function is a lint error rather than a page that prints a raw key.
The alternative — an object message `{one, few, many, other}` — was rejected on
purpose: it widens `I18nDictionary` for every consumer and every generated
catalogue, and the lint would still need teaching the shape, which is two
halves that can drift.

`pluralCategory(locale, count)` is exported for a skin that needs the category
itself. It is `Intl.PluralRules`, never a hand-rolled `n === 1 ? … : …`, and an
unusable locale tag degrades to English instead of throwing — a plural is copy,
and copy must not be able to crash a render.

**Nothing that exists moves.** `I18nDictionary` is still `Record<string,
string>`, `getBundle` is unchanged, and `tPlural` falls back `<key>.<category>`
→ `<key>.other` → `<key>` → the key, so a host bundle written before this
release still renders its single flat string instead of a raw key. Bundles gain
plural forms when they are ready to, one family at a time.
