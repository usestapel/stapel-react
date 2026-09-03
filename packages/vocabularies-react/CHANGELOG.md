# @stapel/vocabularies-react

## 0.5.0

### Minor Changes

- db4cd9f: `search` answers with the PAGE, so the popular band survives the wire.

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

## 0.4.0

### Minor Changes

- 45cdc5a: `createVocabularyClient` pages: `search` accepts the seam's new `offset`
  parameter and sends it as `?offset=` (omitted at zero), so a picker sheet
  can walk a level past the first page instead of showing 50 rows of a
  10,000-term level with no way to reach the rest.

## 0.3.0

### Minor Changes

- f3b2764: A vocabulary level as a FIELD: `<VocabularyTermPicker/>`, the picker-sheet sibling of the term select.

  The select stays exactly as it is, and that is the point. It is EMBEDDED — a
  filter rail, an admin row, a bulk-edit cell hand it a width and expect the
  inline control that sits beside the others — so turning it into a bottom sheet
  would have changed those layouts without anybody asking. A phone FORM wants the
  other shape: a 250px dropdown with the on-screen keyboard over half of it is the
  case `SkinPickerSheet` exists for. So the sheet treatment ships beside the
  select rather than through it, and a surface picks the one it wants.

  The new control is a trigger that says what is chosen — the resolved LABEL for
  one term, the count for several, and the stored code as the fallback, because an
  empty field is a worse lie than a slug — opening a sheet that owns the search
  box. On top of the list are the codes picked most recently (`useRecents` from
  `@stapel/core`, scoped per vocabulary and level, drawn only while the box is
  empty and only when it has something in it); a remembered code the vocabulary
  can no longer name is dropped rather than rendered as a slug, since nobody asked
  for that row. In `multiple` the footer carries the count it is about to keep,
  and dismissing discards the draft instead.

  Underneath, nothing new was invented: the same seam, the same debounced and
  superseding `useTermSearch`, the same `useTermLabels` resolve, and the same
  value on the wire — a list of codes, single-select included. `matched === false`
  becomes the sheet's `listStale`, so a list that does not answer the box dims and
  stops responding, recents included: reasoning per group about which rows happen
  to be safe is how that rule got holes in it the first time.

  Six demos at 390px, including the two states a wait actually has (a skeleton
  when there is nothing to dim, dimmed history when there is), and the loud
  no-client notice, which the picker draws for the same reason the select does.
  New copy in en/ru/es. The peer floors move up to the release that carries
  `useRecents` and `SkinPickerSheet`.

## 0.2.1

### Patch Changes

- The imported rule corpus and the vocabulary examples are source-neutral.

  `test/fixtures/rules-corpus/imported/` replaces the directory named after the
  external marketplace the corpus was imported from, and both files were
  regenerated upstream (stapel-attributes 0.7.1) with a synthetic option
  vocabulary and structural notes. The rewrite is injective per case, so the
  TypeScript evaluator is still measured against exactly the same 3890 rules at
  both polarities — 7780 frames, 15 730 feature-state expectations, the same
  effect mix and the same shape gate. `scripts/gen-rules-corpus.mjs` copies the
  `imported` set, and the `stapel-attributes` contract pin moves to v0.7.1.

  Examples and demo data drop the source's name too: the worked vocabulary is
  `phone-models` / `car-models` / `phone-catalog` across the attributes,
  vocabularies, search and listings pairs. Comments, READMEs and changelog prose
  say "an imported external catalogue" where they used to name the marketplace.
  No runtime behaviour, exported API or wire shape changes.

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
