# @stapel/vocabularies-react

## 0.2.0

### Minor Changes

- A reference typeahead never offers a list that answers an older query

  `ref_select`, `ref_hierarchical_select` and `<VocabularyTermSelect>` kept the
  PREVIOUS query's terms on screen, pickable, while a newer query was on its way.
  Measured on a live classified deployment, on both seller flows and on every
  reference field of the phone category: `Vendor` 621/635 ms, `Model` 416/421 ms,
  `RAM` 631/639 ms. A person who types three letters and taps the first row —
  which is what people do — wrote somebody else's code into the attribute with
  nothing on screen saying so; one run published `vendor=3q, model=qoo-s` for a
  listing the seller had typed as Apple / iPhone 13. It was the last `major`
  defect in either seller flow.

  Aborting the superseded request never fixed this and could not: the stale
  window is not a race between two responses, it is the 250 ms of debounce plus
  the round trip during which the last ANSWER is still rendered.

  So the hook holds the query the terms answer BESIDE the terms, and reports them
  only while it equals the query in the box:

  - a keystroke blanks the list at once — on the keystroke, not on the response,
    because that is the instant the list stopped being the answer;
  - every request carries its query and a response is dropped unless that query
    is still the current one. The abort is kept, but it is now a courtesy to the
    network: correctness may not rest on a client honouring `signal`, and one
    that ignores it can no longer put the wrong list under somebody's finger;
  - a parent change aborts and drops in flight as well as clearing what is shown;
  - a failed search ANSWERS with an empty list rather than freezing the last one;
  - while the shown list does not answer the box, nothing in it can be picked:
    the terms are gone and the held-code rows a reopened draft keeps are
    `disabled`.

  Both controls stamp `data-vocabulary-matched` and `data-vocabulary-busy` on the
  select's root — one fact a screenshot and a browser probe can both read.
  `useTermSearch` in `@stapel/vocabularies-react` gains `matched` on its returned
  state; a host reading `terms`/`loading` needs no change.

  `ref_hierarchical_select` gets the same rule one column deeper: each `loadData`
  carries the generation of the tree it was asked for, so a pointer that moves
  under an in-flight column cannot graft one vocabulary's terms onto another's
  node.

## 0.1.0

### Minor Changes

- d1125bc: The React pair for stapel-vocabularies 0.1.0 — first release.

  A ref feature carries a POINTER to a vocabulary level instead of an options
  list, because the lists are the wrong size to inline into a category schema
  (529 phone vendors → 14 962 models; 107 049 car modifications). The terms
  therefore arrive over a second wire, and this package is the client for it.

  **The seam, satisfied structurally.** `createVocabularyClient({ baseUrl, fetch? })`
  returns the two functions `@stapel/attributes-react` declares as
  `VocabularyClient` and hands to `<VocabularyClientProvider>`. Neither package
  imports the other — in source or in `package.json` — so the two L2 pairs stay
  independently releasable, and a host with no vocabularies module at all can
  supply its own two functions and keep every ref editor working.
  `test/clientShape.test.ts` holds a hand-transcribed copy of the upstream
  interface and ASSIGNS this client to it, so a drift on either side is a red
  build here rather than a hole a storefront finds at the composer.

  It is a bare `fetch` client on purpose: both endpoints are public reads
  (`ReadOnlyOrStaff`, ETag'd on the vocabulary revision, no session), and
  anything needing React context could not be passed to a `value` prop at a
  container's composition root, which is the one call site the seam exists for.
  `parent` is OMITTED rather than sent empty (`parent=` asks for the children of
  a term whose code is the empty string); `resolve` splits at 200 codes, because
  the server ignores the tail of a longer list instead of refusing it; a refusal
  folds into core's one dialect and an abort is rethrown AS an abort, so a
  superseded keystroke never looks like a dead backend.

  **Hooks.** `useTermSearch` debounces 250 ms, aborts what it supersedes, fetches
  the first page immediately on open (once per level and parent — antd reports a
  dropdown as opening on every keystroke) and empties itself when the parent
  moves. It is deliberately not a query. `useTermLabels` is: the same codes give
  the same labels until the vocabulary's revision moves, so it is keyed through
  `vocabulariesQueryKeys` and hands out a `LoadState` rather than a bare map —
  `{}` would say "these codes have no labels" in the same words as "nobody has
  asked yet".

  **`/default` `<VocabularyTermSelect>`.** The same control the `ref_select`
  editor draws, shipped on its own for the places a composer is not: a facet
  filter, an admin form, a bulk-edit row. `filterOption={false}` — the options
  ARE the answer to the current query. A held code is resolved to its label and
  stays pickable even when the current page does not contain it. No client is a
  LOUD state: the notice, not an empty dropdown.

  Ships en/ru/es. No nav entry and no overview screen: this pair ships a control
  other pairs' forms mount, not a destination (the `@stapel/attributes-react`
  precedent).
