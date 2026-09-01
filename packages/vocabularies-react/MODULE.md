# @stapel/vocabularies-react — module guide

The React pair for **stapel-vocabularies**. Human companion to the generated
`llms.txt` (agent context) and `manifest.json` (machine catalog); `README.md` is
the usage entry point.

## What this pair is for

One sentence: **a ref feature points at a vocabulary level instead of carrying
options, and this is how the terms get to the browser.**

Everything below follows from the sizes. A category schema that inlined 14 962
phone models would be a response nobody can cache and a form nobody can open, so
`stapel-attributes` 0.5 made `ref_select` / `ref_hierarchical_select` carry a
pointer, and the terms travel on their own wire. That wire has exactly two reads
a form needs — search a level, resolve some codes — and they are the whole
public surface of this package.

## Layers

- **client.ts** — `createVocabularyClient({ baseUrl, fetch?, limit? })`. A bare
  `fetch` client on purpose: the seam it satisfies is two async functions that a
  container hands to a React *value* prop, so anything requiring context could
  not be passed at all. Both endpoints are public reads (`ReadOnlyOrStaff`,
  ETag'd on the vocabulary revision, no session), so there is no token to carry;
  a host that needs headers passes its own `fetch`. Refusals are folded into
  core's one dialect (`toStapelApiError`) at the single rethrow point — except
  an abort, which is rethrown as itself, because a superseded keystroke folded
  into an API error looks exactly like a dead backend.
- **api/** — `createVocabulariesApi(client)` plus type aliases over the
  package-LOCAL generated `components["schemas"]` (`Vocabulary`, `Level`,
  `Term`, `TermPage`), produced by `pnpm gen:api` from stapel-vocabularies's own
  `docs/schema.json`. Never parallel hand-written bodies.
- **model/** — `useTermSearch` (debounced, superseding, parent-scoped),
  `useTermLabels` (a TanStack query keyed through `vocabulariesQueryKeys`,
  handing out a `LoadState`), `termLabel`, and the standard runtime wiring.
  The split between the two is a decision, not an accident: see README.
- **flows/** — `toFlowError` + the zero-flow `VOCABULARIES_FLOWS` shim. The
  module annotates no `@flow_step` and its `docs/flows.json` is literally `[]`
  (the stapel-categories precedent), so there is no machine here and none is
  pending.
- **headless/** — `<VocabulariesProvider>`, the standard runtime context. Not
  needed by the seam client; needed to reach the catalogue endpoints through
  this pair's `StapelClient`.
- **default/** — `<VocabularyTermSelect/>` (the inline typeahead an embedding
  surface drops into a row) and `<VocabularyTermPicker/>` (the same level as a
  field that opens a picker sheet: recents on top, a counted commit, a stale
  list nobody can tap), both on the opt-in `./default` subpath.
- **i18n/** — `VOCABULARIES_I18N_KEYS` + en/ru/es. The generated backend error
  bundles are merged in so every `error.*` code has a fallback; the three codes
  stapel-vocabularies owns are authored by hand until upstream ships a
  `translations/` directory.

## Extension seams (frontend-standard §7)

- **The vocabulary seam itself.** `VocabularyClient` is declared by
  `@stapel/attributes-react` and satisfied here STRUCTURALLY — no import in
  either direction, in source or in `package.json`, asserted by
  `test/clientShape.test.ts`. A host may replace this implementation entirely
  with its own two functions.
- **Transport.** `createVocabularyClient({ fetch })` takes a host's own
  instrumented/authenticated `fetch`.
- **The control.** A host that draws its own can use `useTermSearch` /
  `useTermLabels` and never import `./default`.
- Client injection for the standard layers is via `<VocabulariesProvider>` /
  core's `StapelConfigProvider` per-module override, as in every pair.

## Deliberately absent

- **A nav entry and an overview screen.** This pair ships a control that other
  pairs' forms mount, not a destination — the same shape as
  `@stapel/attributes-react`, `@stapel/cdn-react` and `@stapel/geo-react`. The
  scaffold's placeholder panel was removed rather than shipped: a menu item
  leading to a card that says "nothing here yet" is a promise the package does
  not keep.
- **A cascading control.** `ref_hierarchical_select` is drawn by
  `@stapel/attributes-react`'s own `Cascader` editor, which reads its columns
  from the feature's `levels`. Duplicating it here would be a second answer to
  one question.
- **Vocabulary administration.** Loading and editing vocabularies is
  `manage.py load_vocabulary` and Django admin — data plumbing over reviewed
  fixtures, not a screen.

## Wire contract read here

| Verb | Path | Used by |
|---|---|---|
| GET | `vocabularies/{slug}/terms/?level=&parent=&q=&limit=&offset=` | `client.search`, `useTermSearch` |
| GET | `vocabularies/{slug}/terms/resolve/?level=&codes=` | `client.resolve`, `useTermLabels` |
| GET | `vocabularies/`, `vocabularies/{slug}/` | typed in `api/types.ts`; no hook yet |

Errors this pair can surface: `error.404.vocabularies_vocabulary_not_found`,
`error.404.vocabularies_level_not_found`, `error.400.vocabularies_bad_parent`,
plus the 42 cross-cutting `stapel_core` codes.
