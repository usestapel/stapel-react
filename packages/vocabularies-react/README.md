# @stapel/vocabularies-react

Reference vocabularies too large to inline into a category schema: term
typeahead and code-to-label resolve behind the `VocabularyClient` seam, plus the
antd term controls — an inline select and a picker-sheet field.

## Why this package exists

A category's feature schema carries its own options — except when it cannot. A
phone's `Vendor` is 529 rows and its `Model` is 14 962; a car's `Modification`
is 107 049. `stapel-attributes` 0.5 therefore added two value types,
`ref_select` and `ref_hierarchical_select`, whose config carries a **pointer**
(`optionsRef {vocabulary, level, parentFeature?}`) instead of a list, and
`GET /categories/{id}/features` sends the pointer as-is.

The terms then arrive over a second wire — `stapel-vocabularies` — and this
package is the client for it.

## The seam

`@stapel/attributes-react` **declares** the interface; this package
**implements** it, structurally, and neither imports the other. Two L2 pairs do
not depend on each other, so both stay independently releasable; the container
is what joins them:

```tsx
import { createVocabularyClient } from "@stapel/vocabularies-react";
import { VocabularyClientProvider } from "@stapel/attributes-react";

const vocabularies = createVocabularyClient({ baseUrl: "/vocabularies/api/v1/" });

<VocabularyClientProvider value={vocabularies}>
  <ListingComposerPage … />
</VocabularyClientProvider>;
```

`test/clientShape.test.ts` holds a hand-transcribed copy of the upstream
interface and assigns this client to it, so a drift on either side is a red
build here rather than a hole a storefront finds.

The interface is two functions and nothing else — no query client, no auth
runtime, no provider — which is what lets a host with no vocabularies module at
all supply its own two functions (an in-memory table, an existing search
endpoint) and keep every ref editor working.

```ts
search(vocabulary, level, query, parent?, signal?): Promise<readonly VocabularyTerm[]>
resolve(vocabulary, level, codes): Promise<Readonly<Record<string, string>>>
```

`search` is `GET vocabularies/{slug}/terms/?level=&parent=&q=&limit=` —
`parent` is OMITTED, never sent empty, because `parent=` asks for the children
of a term whose code is the empty string. `resolve` is
`GET vocabularies/{slug}/terms/resolve/?level=&codes=`, split into batches of
200 because the server ignores the tail of a longer list rather than refusing
it.

## Hooks

```tsx
const { terms, loading, search, open } = useTermSearch(client, {
  vocabulary: "phone-models",
  level: "Model",
  parent: vendorCode,          // undefined = the whole level
});

const labels = useTermLabels(client, { vocabulary, level, codes });
termLabel(labels, "iphone-15-pro"); // "iPhone 15 Pro", or the code
```

`useTermSearch` debounces 250 ms, aborts the request it supersedes, fetches the
first page immediately on open (once per level and parent), and empties itself
when the parent moves — what is listed belongs to the previous parent's
children. It is deliberately NOT a query: a search is superseded per keystroke
and scoped to a dropdown that is about to close.

`useTermLabels` is the opposite and IS a query, keyed through
`vocabulariesQueryKeys.termLabels` — the same codes give the same labels until
the vocabulary's revision moves, and several controls on one page routinely ask
for the same set. It hands out a `LoadState`, not a bare map: `{}` would say
"these codes have no labels" in the same words as "nobody has asked yet".

## The controls

Two of them over one level, and the choice between them is the SURFACE, not the
data: both hold the same value (a list of codes, single-select included), read
the same seam and share the same query layer.

```tsx
import { VocabularyTermSelect } from "@stapel/vocabularies-react/default";
import { registerVocabulariesI18nRu } from "@stapel/vocabularies-react/i18n/ru";

<VocabularyTermSelect
  client={vocabularies}
  vocabulary="phone-models"
  level="Vendor"
  value={codes}
  onChange={setCodes}
/>;
```

The same control `attributes-react`'s `ref_select` editor draws, shipped on its
own for the places a composer is not — a facet filter, an admin form, a
bulk-edit row. `filterOption={false}`: the options ARE the answer to the current
query, and letting antd filter them again would hide rows the server
deliberately ranked. A code the control already holds is resolved to its label
and stays pickable even when the current page does not contain it. **No client
is a loud state** — the notice, not an empty dropdown: a control that cannot
reach its terms and looks like one that found none is how a person is left
unable to answer a question nobody told them was broken.

`<VocabularyTermPicker/>` is the same level as a FIELD: a trigger saying what is
chosen — the resolved label for one term, the count for several — that opens
`SkinPickerSheet` (a bottom sheet on a phone, a modal above it), with the search
box at the top, the codes picked most recently on top of the list
(`useRecents` from `@stapel/core`, scoped per vocabulary and level, and a
remembered code the vocabulary can no longer name is dropped rather than shown
as a slug), and — in `multiple` — a commit button carrying the count it is about
to keep.

```tsx
import { VocabularyTermPicker } from "@stapel/vocabularies-react/default";

<VocabularyTermPicker
  client={vocabularies}
  vocabulary="phone-models"
  level="Model"
  parent={vendor}
  title={fieldLabel}
  value={codes}
  onChange={setCodes}
/>;
```

The two coexist on purpose. The select is EMBEDDED — a filter rail, an admin
row, a bulk-edit cell hand it a width and expect the inline control beside the
others — so widening it into a sheet would change those layouts without anyone
asking. The picker is what a phone form wants, where a 250px dropdown under the
on-screen keyboard is the wrong shape. In both, `matched === false` (the answer
in flight is not the answer on screen) makes the list untappable — dimmed here,
blank there — which is the whole of defect C23.

`./default` is themed through `SkinTheme` from `@stapel/tokens-antd/skin` (one
bridge for the whole fleet — a pair never mounts its own `ConfigProvider` and
never defaults a theme mode). Importing the subpath is the opt-in that pulls
`antd`; a host with its own design system keeps importing the root entry and
draws its own control over the hooks.

Locales ship as subpaths (`./i18n/ru`, `./i18n/es`) so a host carries only the
ones it registers; `test/i18nParity.test.ts` fails the build if a key exists in
en and not in ru/es.

This pair contributes **no nav entry**: it ships a control other pairs' forms
mount, not a screen of its own (the `@stapel/attributes-react` precedent).

## Install

```
pnpm add @stapel/vocabularies-react @stapel/core @tanstack/react-query react
```

The `VocabulariesProvider` / `createVocabulariesRuntime` pair is the standard
runtime wiring, needed only if you reach the module's other endpoints (the
vocabulary catalogue) through this pair's `StapelClient`. The seam client above
needs none of it.

## Layers

```
src/
  client.ts   createVocabularyClient — the seam, a bare fetch client
  api/        typed aliases over this pair's own generated `components`
  model/      query keys, useTermSearch, useTermLabels, runtime wiring
  flows/      toFlowError + zero-flow registry shim (the module annotates none)
  headless/   VocabulariesProvider
  default/    VocabularyTermSelect + VocabularyTermPicker (antd, opt-in subpath)
  i18n/       translation keys + generated backend error map (en/ru/es)
demo/         first-class demos (compiled, product-linted, smoke-rendered)
```

## Generated surfaces (drift-gated)

| Surface | Path | Gate |
|---|---|---|
| Typed API schema | `src/api/generated/schema.ts`, from stapel-vocabularies's own `docs/schema.json` | `pnpm gen:api:check` |
| Flow registry | none — zero-flow module (`src/flows/registry.ts` shim) | `pnpm gen:flows:check` |
| Backend error map + en/ru/es bundles | `src/i18n/generated/` | `pnpm gen:errors:check` |
| Typed-event registry | `src/analytics/generated/events.json` | `pnpm gen:events:check` |
| Demos → Ladle stories | `demo/generated/` | `pnpm gen:demos:check` |
| `manifest.json` + `llms.txt` | package root | `pnpm gen:manifest:check` |

The module ships no `translations/` directory, so `gen:errors` runs with
`ERRORS_CATALOG_DIR` pointed at stapel-core's catalogue and
`ERRORS_LOCALE_EXEMPT_OWNERS=stapel_vocabularies`: the cross-cutting keys come
from core in ru/es, and the module's own three are authored in `i18n/ru.ts` /
`i18n/es.ts` until upstream localizes them.

## Guardrails

Linted by the shared `@stapel/eslint-plugin` flat config and the shared
stylelint preset. Demos are first-class code: compiled by `tsconfig.demo.json`,
linted with the product ruleset, smoke-rendered by `test/demos.test.tsx` — and
never shipped (excluded from the `files` allowlist; proven by
`test/prodBundlePurity.test.ts`).

## License

MIT
