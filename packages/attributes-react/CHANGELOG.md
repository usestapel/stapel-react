# @stapel/attributes-react

## 0.14.0

### Minor Changes

- e4ca8b8: A value predicate is false of a value that is not there.

  `evaluateRules` no longer matches `in` or `not_in` against a controller that
  reads empty — `null`, `""`, `[]`, an envelope with a null value, or a slug the
  feature set does not declare. `in` already behaved this way by accident (`some`
  over no strings is false), so the change lands on **`not_in` alone**, which used
  to be _true_ on a blank field and starred every field behind a
  `require when X not_in […]` rule before anyone had answered `X`.

  Two independent UX walkers hit the same wall on a live catalogue: a field marked
  `*` and refusing "Next" while its own help line said "required **if** you said
  in field _Kit_ that there is a box", with _Kit_ untouched. The screen had no
  honest exit — the seller either lied or stopped.

  `not_in` is a question about the answer a person gave, and an unanswered field
  has no answer to compare; "the value is not X" cannot be true where there is no
  value. The closed grammar already carries the operators for the other question,
  so an author who means "not answered yet, **or** not X" writes it:

  ```json
  {
    "effect": "require",
    "when": {
      "any": [
        { "feature": "condition", "op": "empty" },
        { "feature": "condition", "op": "not_in", "values": ["new"] }
      ]
    }
  }
  ```

  `stringify` did not move: `false` is still _filled_ (`["false"]`), so
  `not_in ["true"]` still fires on it, and `empty` / `filled` answer exactly what
  they did before. The change is in the condition, so it reaches every effect the
  same way — an unmatched rule leaves `show` shut, `hide` open, `require` silent,
  `forbid_option` banning nothing and `limit` narrowing nothing. Everything
  derived from the state follows: `featureRuleState`, `featureAnswerRequired`,
  `missingRequiredFeatures`, `visibleFeatures`, `visibleFeatureGroups`,
  `narrowFeature` and `mirrorValidate`.

  This is a semantics change shared with the Python engine, and the two are
  measured equal rather than reviewed equal. The corpus regenerates from
  `stapel-attributes` 0.9.0 (pin bumped, `contract` `>=0.9 <0.10`): 59 → **70**
  state cases, the new eleven covering both value operators on an unanswered
  controller, `not_in` on each empty payload shape and on a false bool, every
  effect's own default under an unmatched condition, and `any: [empty, not_in]`.
  `require-when-not-in-empty-value` keeps its name and now records the opposite
  verdict — the shared corpus had been pinning the defect. The generated imported
  set (3890 distinct rules at both polarities, 7780 frames, 15730 recorded
  expectations) is byte-identical across the bump.

  Blast radius on the imported catalogue this ships against — measured, not
  estimated — is 3 `not_in` rules over 4093 conditions: 22 feature-rows in 2
  leaves, 984 changed feature-state cells across 498903 sampled assignments, 13
  rows changed on a blank form (7 of them no longer required), and **zero**
  features made unreachable or newly reachable.

## 0.13.0

### Minor Changes

- a9dbe3e: Requiredness and emptiness are verdicts about the current ANSWERS, and a host
  can now ask for both.

  A composer that walks a category in steps had to re-derive two things by hand,
  and read them off the schema: whether a block still asks anything (a block
  whose fields are all rule-hidden produced a step with a heading and nothing
  under it) and what the person still owes (a "Next" that refused over a field
  that was not on screen, with no way past it but a false answer). New on the
  main entry, all evaluated against the values:

  - **`missingRequiredFeatures(features, values)`** — the required-and-still-blank
    rows. Requiredness is the evaluated rule state, so an unmatched `require`
    rule is not required, and it is the SAME predicate the asterisk and the
    mirror use.
  - **`visibleFeatures(features, values)`** — the rows `<FeatureFields>` will
    draw, both gates composed (rules `show`/`hide` and progressive disclosure).
  - **`visibleFeatureGroups(features, values)`** — those rows as blocks, in the
    skin's own order, with every block that asks nothing dropped: the step ladder,
    ready to walk. Headings do not count as questions.
  - **`hasVisibleFields(features, values)`** — the one-line form of the same
    question.
  - **`featureRequiredUnder(feature, state)`** — the requiredness predicate
    itself, now public. `<FeatureFields>` had its own copy beside the mirror's;
    the marker and the refusal are one function call again, so they cannot drift.

  Fixed with them: `mirrorValidate` no longer reports a field that progressive
  disclosure has not revealed as `mandatory_missing`. `toFeaturesDto` already
  drops such a value as "not part of the declaration", so the mirror was refusing
  a payload it had built itself and naming a control the person could not see.
  The open question there is the parent.

- a9dbe3e: A reference picker draws the server's popular band.

  A live stand's phone catalogue holds 529 vendors, and the `ref_select` sheet
  opened on `3Q, 4Good, 8848, A1, Aceline, Acer` — the only order this side could
  produce. `stapel-vocabularies` 0.2.0 gives the level a band and publishes where
  it ends; this is the rendering half. The fields read, both exactly as that
  release names them:

  - **`band: "popular" | "all"` on each term row** — carried on `VocabularyTerm`.
  - **`popular_count` on the page** — how many LEADING rows of `results` are in
    the band.

  `VocabularyClient.search` may now answer with the endpoint's page
  (`{results, popular_count?, total?}`) as well as a bare array. The page shape
  exists for the one fact a row cannot carry, and a client that keeps returning
  an array keeps working — it draws one plain list.

  **The count is the authority; the rows' own tag is only a fallback.** Under a
  `q` search the server ranks by prefix FIRST and the band second, so a page can
  legitimately read `[popular+prefix, all+prefix, popular, all]` — two rows
  tagged `popular` of which only the first leads. Splitting on the tag would lift
  the third row over the second and destroy the typeahead ranking, which is why
  the endpoint publishes a count and tells clients not to scan. The split is a
  SLICE at `popular_count`; neither band's order is this package's opinion. When
  no count is given (an array answer, a service older than 0.2.0) the fallback is
  the leading run of `band === "popular"` — the server's own algorithm, whose
  worst case is a run of zero and therefore one plain list. It can under-report a
  band; it can never reorder one.

  What it draws:

  - **a band** → the popular rows first under their own heading, a rule, then the
    rest of the level under a heading of its own;
  - **no band** (`popular_count: 0` — a level nobody has ranked, a page past the
    boundary, or a search whose top hit is a plain prefix match) → exactly what
    it drew before: one plain list, no heading, no rule;
  - **search** re-reads the boundary from each response, so a query that keeps
    the band keeps the two-band shape and one that does not collapses back to the
    plain list. A band with nothing in it is never emitted, so no heading can
    stand over nothing;
  - **paging** extends the band by a later page's leading run rather than
    restarting it, so a host on a small `limit` that pages THROUGH the boundary
    does not drop the tail of the band under "All options".

  The bands are the picker sheet's own groups — headings are never focusable or
  pickable, and arrow-key traversal crosses the rule unchanged.

  New on the main entry: `termPageOf` (normalize an answer to rows + boundary),
  `splitPopularBand`, `isPopularTerm`, and the `VocabularyTermPage` /
  `VocabularyTermAnswer` types. New copy in all three catalogues:
  `attributes.picker.recommended`, `attributes.picker.all_options` — the heading
  reads "Recommended" while the wire calls the band `popular`, deliberately: the
  key names a sentence a person reads, and "Popular" is a claim about other
  people's behaviour this package cannot substantiate at the point of rendering.

### Patch Changes

- f79bdc3: tokens-antd: a gated control is semantically off and interactively ALIVE — it can be tapped, focused, and can say why it will not do the thing

  `GatedControl` handed callers `bind.disabled` and its own JSDoc told them to spread it straight onto the control. That produced an html-`disabled` element, which fires no events in any browser: it cannot be clicked, cannot take focus, cannot be described to a screen reader that never reaches it, and cannot carry the one gesture that mattered — the tap that should open the sign-in door standing behind the gate. Every gated control across the ~20 pairs using it was inert, and the wrong instruction was half the defect: the docs taught the shape that broke it.

  Measured on a live deployment: an anonymous visitor taps the favourite heart and nothing happens at all — no sentence, no tooltip, no door (walker defects D45/D72).

  **The corrected contract.** While the gate is shut a control is now `aria-disabled="true"` and NOT html-disabled, so it stays focusable and keeps receiving events. The ACTION is suppressed by `GatedControl` itself, in a capture-phase wrapper (`display: contents`, so no pair's layout moves by a pixel): the caller's `onClick`, keyboard activation, typing, IME input, paste and drop are swallowed before the control sees them. Callers write their handlers exactly as if the gate did not exist. The activation comes back as the new `onBlockedActivate`, which is where a pair opens its door. The reason stays where it was — visible text wired by `aria-describedby` — and where a `PaneGate` pools it into one footnote, the gesture now brings a `role="status"` copy of the sentence back to the control it belongs to. A blocked `GatedButton` keeps antd's exact disabled paint (its own `-disabled` class, which sets no `pointer-events`), so nothing about any screen looks different.

  `GatedControlProps.whenBlocked` holds the two deliberate opt-outs, neither of them the default:

  - `"inert"` — html `disabled`, for the rare control that must be switched off at the browser level. `attributes-react`'s catalogue lock is the one place in the fleet that asks for it, and now says so.
  - `"annotate"` — the control stays fully usable and only gains the sentence, for a gate that judges the VALUE rather than refusing the person: `calendar-react`'s slot-length field must stay editable, because editing it is how the reason goes away, and `search-react`'s sort must still pick the options that are not the blocked one.

  `useBlockedButtonClassName()` is exported for render-prop call sites that paint their own button and want the same unavailable look rather than a second grey.

  **⚠️ The readiness-signal hazard, and its cure.** `element.disabled` is now permanently `false` on every gated control in the fleet. Any test using it as a readiness signal — `await waitFor(() => expect(save.disabled).toBe(false))`, meaning "wait until this is allowed" — returns instantly and mis-times SILENTLY: every assertion after it reads an unseeded component, and the failure looks like broken product logic rather than a gate that had not opened. One pair's suite went green → 21 failures across unrelated files on exactly this. Wait on the stamp instead, which is what such a wait was always asking:

  ```ts
  await waitFor(() =>
    expect(
      screen.getByTestId("save-gate").getAttribute("data-stapel-gated")
    ).toBe("available")
  );
  ```

  `data-stapel-gated="available" | "blocked"` is on the wrapper of every gated control in all three modes (`GatedButton` names it `<testId>-gate`). For a point assertion on one element, read `aria-disabled`. Never `disabled`.

  **ChoiceChips** carried the same defect on its own chips and is fixed the same way: a chip at the cap is `aria-disabled` and focusable, and the tap is refused in the handler, so the row's sentence reaches a keyboard.

  **The consumers.** Every `GatedButton` call site (64 imports across 20 pairs) is fixed with no code change — the correction is in the substrate. The render-prop call sites that consumed the binding field-by-field now spread it whole: `billing-react`'s auto-recharge switch, `calendar-react`'s RSVP buttons, `moderation-react`'s sanction checkbox, `notifications-react`'s push switch, `attributes-react`'s at-max add button. `tasks-react`'s assignee picker is a host slot rendering its own control out of reach of the suppression, so it is handed a plain verdict on purpose. `workspaces-react` had two hand-rolled gates that never went through `GatedControl` at all — a row-action column and the create button on a failed roster read — and both now use the same anatomy.

## 0.12.1

### Patch Changes

- a6e0100: A field's help line no longer echoes its own label (D54).

  An imported catalogue stamps `description == name` on nearly every field, so
  `<FeatureFields>` drew a grey restatement of the label under every box
  ("Producer … Producer", "SIM cards … SIM cards") — on a live classified that
  is a third of a phone screen of noise per step, editor included. The
  description is compared to the label RESOLVED (both members are
  key-or-literal, either may be the catalogue key of the other's text) and is
  not drawn when it says nothing new. A genuine sentence is untouched.

## 0.12.0

### Minor Changes

- e1c517a: The skin component registry — the substrate's second restyle layer (owner
  mandate 2026-08-31; design doc `docs/skin-component-registry.md`).

  `@stapel/tokens-antd/skin` gains `SkinProvider`: a host registers a
  replacement `Button`, `Input` and/or `Dialog` surface ONCE, at the app
  root, and every substrate render below it — `GatedButton`, `ErrorAlert`'s
  retry, `SkinConfirm`'s arms, `RowActions`, `PermissionSheet`, the picker
  footer and search box, `SkinNumberField`, `CountedInput`, `SkinDialog` and
  everything composed on it — draws the host's anatomy instead of antd's.
  Tokens keep answering "what colour"; the registry answers "what IS a
  button". New exports: `SkinProvider`, `SkinButton`, `SkinInput`,
  `useSkinComponents`, and the slot contracts `SkinButtonProps`,
  `SkinInputProps`, `SkinDialogSlotProps` (typed props plus documented
  anatomy duties, checked in dev builds with a loud `console.error` per
  violation). With no provider the markup is byte-identical to 0.14 — pinned
  by pre-change snapshots.

  attributes-react, listings-react and drive-react migrate their default
  skins' direct antd `Button`/plain-`Input` imports to the registry-resolved
  `SkinButton`/`SkinInput` (alias-only import diffs, zero JSX changes) and
  raise their `@stapel/tokens-antd` peer floor to `>=0.15.0`, so a host-level
  registration reskins these pairs completely with no pair wiring.

## 0.11.1

### Patch Changes

- 6bf6f2d: An `int` never grows a decimal tail. `formatFeatureValue` applied the
  config's `precision` to the plain branch of an integer, so a category that
  shipped `precision: 1` on a year printed "2024.0" on the detail page — a
  value the engine's own `format_value` would never write (its plain branch is
  `str(value)`; `precision` exists for the `postfix1000` scaled branch alone).
  The scaled branch also inherits the engine's default precision of 1, so
  1500 g reads "1.5 kg" rather than a rounded-up "2 kg". Floats keep their
  configured decimals — that is their contract.

## 0.11.0

### Minor Changes

- 45cdc5a: Machine constraints reach the controls instead of being described beside
  them — the owner's ruling on the car composer, in four mechanisms:

  - **Progressive disclosure.** A field whose allowed set is scoped by a
    sibling (`optionsRef.parentFeature` — a chained ref rung, the
    vocabulary-backed int) does not render until that sibling is answered,
    and when the parent MOVES or empties the child's value resets and the row
    disappears (`undisclosedSlugs` in the new `disclosure.ts`, shared by
    `<FeatureFields>` and `toFeaturesDto`, so an undisclosed answer never
    rides the payload either).
  - **The bake rule.** When a live constraint leaves exactly ONE allowed
    answer — a single-choice select down to one option (statically or via
    `forbid_option`), an int whose `limit` pins `min === max`, a chained rung
    whose parent has one child — the form commits it through the same
    `onChange` a user pick takes and the control renders grey with a reason
    line, `mandatory` or not. Un-bake is symmetric: when the collapse stops
    holding, a value the form (not the person) wrote is reset, never left
    standing as if chosen.
  - **The vocabulary-backed int** (`IntConfig.optionsRef`, stapel-attributes
    0.8.2). Keypad AND dropdown together: typing filters the allowed set, a
    typed allowed number commits silently, a disallowed one opens the full
    set with a live bounds hint, and two steppers walk the set skipping gaps,
    greyed at the ends. The static range hint is suppressed — the control is
    the constraint. The same vocabulary edges are what the server refuses
    with, so the picker and the refusal cannot disagree.
  - **Paging.** `VocabularyClient.search` gains an `offset` parameter and the
    sheets page through a long level on scroll-end (`useTermSearch.more`,
    de-duplicated by code, exhausted on a short or repeated page), on top of
    the server-side typeahead that already existed. An un-paged client
    degrades to the first page, never to a loop.

## 0.10.0

### Minor Changes

- bf66860: Every value kind gets the control a thumb can answer it with.

  The chip-shaped editors keep the focus contract `featureControlId` promises:
  the field's id lands on the first chip (a focusable control), so a
  composer's "go to the first missing field" reaches a chips field the same
  way it reaches a text box, and the row's label resolves to exactly one
  element.

  The thirteen builtin editors were antd's stock controls: a dropdown for any
  closed list, an `InputNumber` that clamped, a `Segmented` bar that fitted four
  options, a `Cascader` over an 812k-term vocabulary, and a `Switch` that drew
  "No" for a question nobody had answered. On the phone this catalogue is filled
  in on, each of those is a different way of asking somebody to guess. They now
  sit on the picker substrate (`@stapel/core`'s `useRecents`, and
  `ChoiceChips` / `SkinPickerSheet` / `SkinNumberField` / `CountedInput` from
  `@stapel/tokens-antd/skin`), and the rules are stated per shape:

  - **`select`** — six options or fewer are chips a thumb hits, inline; more than
    that is a field saying what is chosen over a sheet with a search box. The
    threshold rose from four (a `Segmented` bar's width limit) to six (what a
    person reads at a glance), and an explicit `uiStyle` still wins in both
    directions. A multiple choice with a `maxSelected` cap stays inline whatever
    its length: the sheet holds its own draft and reports it once, so it could
    not stop at the cap — inline, the control switches the remaining chips off
    with the reason beside them instead of letting a fourth answer through to a
    refusal. Uncapped, the sheet's commit button carries the count it is about to
    keep.
  - **`ref_select`** — the same trigger and sheet, searching the vocabulary as
    before (debounced, superseding, `matched` unchanged) with the stale window
    now handed to the sheet's own `listStale`: rows that do not answer the search
    box dim AND stop responding. The codes this person picked last are the
    sheet's first section, from `useRecents`, scoped by vocabulary, level **and
    parent** — the models you last chose are only an answer while the make is the
    same one — shown only when there are any and the box is empty.
  - **`ref_hierarchical_select`** — one rung per level instead of a `Cascader`,
    each waiting for the rung above it with the sentence naming WHICH answer it
    is waiting for (visible text; a disabled control shows no tooltip to anybody),
    and the chosen path echoed above them in one line, elided in the middle when
    it is long. Nothing is fetched until a rung is opened, where the `Cascader`
    used to fetch its root column on mount for every such field on the form.
  - **`int` / `float` / `convertible_unit`** — the numeric keypad, the unit as a
    postfix that is never part of the value, and min/max as the empty box's
    placeholder plus a line in words. Nothing clamps: the mirror refuses an
    out-of-range answer with the engine's own sentence, and typing 19 on the way
    to 1950 is no longer rewritten to 1900.
  - **`bool`** — a required one is an honest tristate: two chips with NEITHER
    pressed until one is tapped, because a switch drew "No" for an unanswered
    question while the asterisk beside it said an answer was required. An
    optional bool keeps the switch, where a `false` default is real.
  - **`string`** — the code-point counter moved onto `CountedInput`, and a field
    whose config describes a CODE (a pattern that admits no spaces, or an exactly
    fixed length of 32 or fewer) is drawn monospace and strips the spaces a
    document's copy brings with it, at the paste rather than at the refusal.
  - **`date`** — still the native input, so a phone gets the OS date wheel in the
    person's own locale and calendar, with `allowPast`/`allowFuture`/`minDate`/
    `maxDate` on the control AND said underneath it.
  - **`group`** — the add button stays on screen at `repeat.max` with the cap
    stated beside it, rather than greying out with nothing to read.
  - **every field** — a `description` long enough to be a paragraph folds into a
    native disclosure instead of pushing the next question off the screen.

  `editors.tsx` is now five files by shape (`editorKit`, `editorsChoice`,
  `editorsNumber`, `editorsText`, `editorsRef`), each stating the one rule its
  editors obey; the registry ladder, the `/default` barrel and every exported
  name are unchanged, and `test/configKeys.test.ts` — the gate holding every
  config key the mirror reads to an affordance in its editor — resolves
  declarations across all five. Eleven new keys in en/ru/es.

  A required number or string announces its requiredness on the control
  itself through the substrate's `ariaRequired` contract — never via a pair
  reaching into the rendered input, which would be a second owner of the
  attribute.

## 0.9.0

### Minor Changes

- A value the reader may not see is a row that says the seller answered — never one that says we checked

  `FeatureDef.visibility` (stapel-attributes 0.8.1) records, once per definition,
  which audience may READ a stored value. It exists for the handful of attributes
  that IDENTIFY one physical unit rather than describe it — a VIN, an IMEI, a
  serial or a registry number — because publishing one lets a stranger act as
  that unit's owner. It is orthogonal to `mandatory`: such a field is still
  required, still validated, still stored, still moderated and still the seller's
  to edit.

  `src/visibility.ts` is the new wire layer, exported from the main (antd-free)
  entry: `featureVisibility` / `isPublicFeature` read the definition — a
  visibility string this build does not know reads as `staff`, not as public,
  because a typo must not publish a VIN — and `isRedactedValue` /
  `isValuePresent` / `valueVerification` / `isValueVerified` read the value-free
  stub stapel-listings 0.12.0 sends in place of a value the reader is not
  entitled to.

  **The composer tells the seller before they type.** `<FeatureFields>` puts a
  neutral "Not published" tag beside a non-public field's label and a line in the
  field's own `extra` slot naming who does see it — `owner` says the seller and
  moderation see it and buyers do not, `staff` says moderation only and that it
  is not shown back to the seller either. The field stays required and stays
  editable. `FeatureRowProps.visibility` carries the same answer to a host's own
  `renderRow`, and `featureVisibilityTestId` is exported so an e2e suite keys on
  the string this component writes.

  **The display says what the system observed, and stops there.**
  `<FeatureValueList>` keeps a redacted row in its stored position — the public
  spec table then has the same rows in the same order as the seller's own, so a
  buyer can see the field exists and was answered — and renders "Provided by the
  seller" where the value would be, or the ordinary "Not specified" when the
  seller left it empty. It does **not** say the value was verified: nothing in
  the fleet runs a VIN or an IMEI check, so that would be a claim about the
  outside world no code here has established. A stronger badge branches on a
  `verification` result instead; the engine never synthesizes one, so the branch
  is unreachable today and correct on the day a real integration writes one — and
  a `verification.status` this build cannot read falls back to the neutral copy
  rather than upgrading on a word it does not understand. `<FeatureBadges>` drops
  a redacted row and a non-public feature entirely, defensively: a card badge
  strip is not the place for this, and a renderer that is only correct because of
  what the server did is the arrangement that leaked the VIN in the first place.

  Five new keys in all three shipped bundles (en/ru/es). The generated
  `FeatureDef` is regenerated from the canon and carries `visibility`.

## 0.8.1

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

## 0.8.0

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

## 0.7.0

### Minor Changes

- 5397813: The composer asks what is being sold before it asks about the parcel

  `<ListingComposerPage>` had two section orders chosen by the form's width, and
  the narrow one put the category's characteristics directly under the category
  picker. On a leaf with a handful of attributes that was an improvement; on an
  imported one it was a funnel with nothing left in it. Measured at 390x844 on a
  live classified deployment: 32 fields between the category and the title, so
  `Title` sat at y=5575, `Price` at y=5871 and `Photos` at y=6245 of a 7308px
  form — the seller was asked for the parcel's weight, its length and "what the
  goods are measured in" before being asked what the thing is or what it costs.

  There is now ONE order, at every width, and it belongs to the component:

      category → title → description → price → currency → where → photos →
      the category's characteristics → the listing's own options

  Measured on the showcase's own composer story at 390 (five attribute rows, not
  32): title moves 993 → 314, the first attribute row 412 → 1266, and the page
  shortens 2227 → 2071px.

  - `COMPOSER_STACKED_BELOW` is gone, and with it the width measurement that
    chose between the two orders. `COMPOSER_DETAILS_PLACEMENT` replaces it: a
    constant, exported because `data-placement` on the characteristics region is
    what an e2e suite reads to prove the order has not regressed.
  - The discoverability the narrow order was reaching for is kept by the two
    things that do not move the questions around — "take me to the first empty
    field", which now also OPENS whatever disclosure the field is folded inside,
    and a shorter region.
  - `<FeatureFields>` takes `groupCollapse` (`"none"` by default, unchanged for
    every existing host; `"auto"` in the composer). Under `"auto"` each named
    group is a native `<details>` that starts open when it asks something
    required or something already answered, and closed otherwise — so identity
    groups are open and the delivery dimensions and wholesale terms are one tap
    away under their own headings. The rule reads the SCHEMA and never a list of
    group names: groups are admin-authored text in the deployment's language.
  - The group order the catalogue emits is untouched.

## 0.6.0

### Minor Changes

- 0eab206: A published listing prints its option COPY wherever the copy exists, and the
  composer's characteristics step is reachable on a phone.

  **The copy.** A `select` DAO carries the chosen values and the display config,
  never the option table — the table lives on the CATEGORY, and not needing it
  is what lets a card draw a badge without a category read. A row written before
  the server started snapshotting labels therefore had nothing to resolve
  against, and the STORAGE SLUG reached the screen: a live classified deployment
  printed `b-u`, `bez-defektov` and `ne-rabotaet-vspyshka` on its spec rows.
  `featureFromDao(dao, { categoryFeatures })` adds the third and last source of
  copy, with the precedence written out: a row carrying its own `options` table
  is left alone, then the row's own `labels` snapshot, then the CATEGORY's
  option table, then the raw value. The snapshot wins over the category on
  purpose — it is what the listing was PUBLISHED with, and the whole reason the
  server takes one is that a category edited afterwards must not silently
  restate an old listing. A category def is used only when slug AND value type
  match, so a renamed feature is ignored rather than forced, and a value the
  catalogue no longer declares still prints itself rather than vanishing or
  being invented. `hierarchical_select` gets the same repair, its tree adopted
  whole because no positional snapshot can describe one. `<ListingDetailPane>`,
  `<ListingCard>`, `<ListingSerpCard>`, `<ListingDetail>` and `useListingDetail`
  take the optional `categoryFeatures`; a host that wires nothing is unchanged.

  **The composer.** On a 390px viewport the characteristics of the chosen
  category began about 1.8 viewports below the fold, under a 700px photo
  dropzone, with no step indicator and nothing saying they existed — while the
  footer counted ten unfilled required details, none of them on screen.

  - Below `COMPOSER_STACKED_BELOW` the characteristics render directly under the
    category choice and ABOVE the photos; at or above it they stay where they
    were. The threshold is measured on the FORM's own width via `useElementWidth`
    — a composer in a 400px panel on a desktop is a narrow composer — and an
    unmeasured element falls to the wide arm.
  - The placeholder said "loading the category's characteristics" when nothing
    was in flight and no category had been chosen. That is now its own fourth
    state with its own sentence, en/ru/es.
  - `ListingComposerBag.firstUnsatisfied` names the first refused field in the
    form's own order, and the closed gate renders a real button (accessible
    name, focus AND scroll) that takes the person to it. A count of ten with
    nothing on screen is a dead end.
  - A field showing a refusal now drops its hint instead of stacking on it: the
    refusal is the more specific statement and the one just earned.
  - The whole attribute region carried exactly one test id. `attributes-fields`,
    `attributes-group-<group>`, `attributes-group-<group>-heading` and
    `attributes-row-<slug>` (with `featureSectionTestId` / `featureRowTestId`
    exported) make it measurable, and the row id sits on the same element with
    or without a host `renderRow`.

## 0.5.0

### Minor Changes

- 417dc45: The composite `group` kind — a bordered, repeatable subform.

  stapel-attributes 0.6.0 registers a thirteenth builtin type: one feature
  holding a small TABLE. Its value is a list of rows keyed by child slug, and its
  `config.fields` are full feature definitions of the ordinary kinds — which is
  the shape 2 468 fields of the imported catalogue corpus carry (a discount ladder is
  "from N units, M % off", up to five steps) and that no other kind could hold.

  **attributes-react**

  - `GroupEditor` in `BUILTIN_VALUE_EDITORS`: one bordered box per row, the
    children as cells, add and remove controls honouring `repeat.min`/`max`. A
    cell is drawn by its child's OWN editor through the same resolution ladder a
    top-level row uses, so a host's registered editor is used inside a group too,
    and a kind that reaches the loud notice at the top level reaches it in a cell.
    `repeat: null` is a single-row group: no add, no remove, no row numbers.
    Phone and desktop come from the column's measured width (`useTouchFloor`),
    not a viewport query — the add/remove controls take the 44px floor in a
    narrow composer column on a full desktop.
  - `props.id` lands on the CONTAINER, as `role="group"`. A composite has no
    primary control, and putting the row's id on the first cell would give that
    one `int` two labels and make the row's label read as a question about it.
  - The mirror (`validateFeatureValue`) judges the row count against `repeat` and
    then every cell through its child's own rule. The refusal that comes back is
    the CHILD's own code — `above_maximum` for a discount over 30 % — because the
    engine adds no error vocabulary for a group and neither does the mirror.
  - `formatFeatureValue` reads a stored table: each cell through its child's type,
    cells joined by `", "` and rows by `"; "`, with the stored `name` winning over
    the config's and a cell the config no longer declares keeping its raw value.
  - `GroupConfig` / `GroupRepeat` are generated from the §68 canon
    (`docs/feature-def.schema.json`), not hand-written, and re-exported from the
    main entry. Three i18n keys (`attributes.group.row` / `.add_row` /
    `.remove_row`) in en, ru and es.
  - Nothing here recurses: a child of type `group` is a refused config upstream
    (nesting depth is 1) and simply resolves to the notice here, and a child
    carrying `rules` is refused upstream too — so there is no per-row rule pre-pass
    and no `narrowConfig` inside a cell.

  **listings-react**

  No composer code changed, which is the claim: the bag holds a value keyed by
  slug whatever its shape, `<FeatureFields>` resolves the editor, and the mirror
  judges the rows. `test/composerRules.test.tsx` now pins that — a composite draws
  with the builtins, an empty mandatory one blocks the publish, a cell outside its
  child's bounds blocks it, and the table reaches the wire under the group's own
  slug. The `@stapel/attributes-react` peer floor moves to `>=0.5.0`, the release
  that can draw one.

## 0.4.0

### Minor Changes

- 9708eb3: Conditional rules, form metadata and the two vocabulary-backed types — the
  browser half of stapel-attributes 0.5.0.

  **Rules.** `src/rules.ts` (main entry, React-free) mirrors
  `stapel_attributes.rules`: `stringify`, `evaluateRules`, `narrowConfig` /
  `narrowFeature`, `parseRules`, `ruleErrors`, `RuleState`. It is measured
  against Python rather than reviewed against it — `test/rules.golden.test.ts`
  runs all 59 state cases and all 10 pipeline cases of the corpus the engine
  records from its own evaluator, copied here by `pnpm gen:rules` and drift-gated,
  AND the whole generated imported set from stapel-attributes 0.5.1: 3890 distinct
  rules lifted out of a real catalogue, each at both polarities — 7780 frames,
  15730 feature-state expectations, compared to what the Python evaluator wrote.
  A rule is a transition and one frame cannot photograph one, so the pair is the
  unit of evidence, and the corpus gate insists the two frames actually differ on
  the rule-bearing feature and that all five effects (require / show / hide /
  forbid_option / limit) appear. The two corpus files are copied BYTE FOR BYTE
  (megabytes, test-only, never packed) rather than re-serialized, so "this file
  IS upstream's file" stays checkable.
  Three behaviours that are decisions, not defaults: readings come from the
  feature DEFINITIONS (a controlling slug the set does not declare reads as
  `empty` even when `values` carries one), `narrowConfig` REPLACES a declared
  `min`/`max` and never introduces one, and a malformed rule set THROWS
  `FeatureRulesError` instead of reading as "no rules".

  **The mirror.** `mirrorValidate` runs the pre-pass: a hidden feature is
  accepted without being validated, requiredness is `RuleState.required` (never
  `mandatory` alone), and the per-type rules see the narrowed config — so a
  forbidden option comes back as `not_in_options` and a tightened bound as
  `above_maximum`, with no new error vocabulary and no per-type special cases.
  `featureAnswerRequired(feature, values?)` answers from the rule state when the
  answers are in hand. `toFeaturesDto` drops a hidden feature's value, mirroring
  `normalize_to_dao`.

  **`<FeatureFields>`.** Hidden rows are not rendered; `required` comes from the
  state; the editor is handed a feature whose config the rules already narrowed,
  so editors stay rule-unaware and a host's own registered editor gets rules for
  free. Sections come from `FeatureDef.group` (ordered by first appearance,
  ungrouped rows first and unheaded), `description` becomes the field's help,
  `example` the placeholder, `hints` one info alert per field.
  `initialFeatureValues` prefers `FeatureDef.default` over the type's own.

  **Vocabulary-backed types.** `ref_select` and `ref_hierarchical_select` bring
  the registry to twelve, editable and formattable. Their config carries a
  POINTER (`optionsRef {vocabulary, level, parentFeature?}`) instead of an
  options list, so the terms arrive through the new `VocabularyClient` seam —
  two functions, declared here and implemented structurally by
  `@stapel/vocabularies-react`, neither package importing the other.
  `ValueEditorProps.siblings` is how the child level learns its parent's code.
  No provider is a LOUD state: the same notice a missing editor draws, and the
  submit blocked through the same channel
  (`unsupportedTypes(features, types, { vocabularyClient })`).

  **Breaking, pre-1.0.** `FeatureDef.comment` is no longer rendered anywhere —
  `description` is the field with that role (D14). `FeatureDef`, `Rule`, `Cond`,
  `Hint` and `OptionsRef` are now GENERATED from
  `stapel-attributes/docs/feature-def.schema.json` and re-exported rather than
  described by hand, so `config` is required and `translate` is the canon's
  closed vocabulary. `ValidationErrorCode` gains `invalid_rules`.

  Requires stapel-attributes >= 0.5.

## 0.3.1

### Patch Changes

- ba97390: Demos: the antd skin is photographed for the first time, and held there by a gate.

  `demo/` did not exist, so the default-skin gate read `0/4 covered` — the ten
  builtin value editors, the unsupported-type notice and both display surfaces
  had never been rendered in a story. Three `defineDemo` sources now cover all
  four `/default` exports (`FeatureFields`, `UnsupportedValueEditor`,
  `FeatureBadges`, `FeatureValueList`) with **all ten builtin value types** drawn
  across their variants, every variant declaring the `viewport` it was designed
  for and the `step` it opens SEEDED at — so a static shot photographs the state
  its name claims instead of one idle frame under five names.

  - `demo/fixtures.ts` — rows shaped as `GET /categories/{id}/features/` sends
    them: `config` carries only the keys an admin set (that endpoint serializes
    `obj.config` verbatim), `name` is admin content rendered as-is, and option
    labels / `postfix` / `trueLabel` are catalogue KEYS resolved through `t()`.
  - `demo/_harness.tsx` — a translator and the shared `SkinTheme`, and nothing
    else: no debug card, no class-name heading, no state chip.
  - `attributes.fields` (5 variants), `attributes.unsupported` (3),
    `attributes.display` (4) — including the locked control with its reason, the
    minimum-selected hint, the code-point counter, refusals landing under their
    own control, and the submit blocked by FEATURE name rather than type slug.
  - `test/demos.test.tsx` — glob discovery, a smoke render per demo,
    `assertVariantsRenderDistinctly` per demo, and an assertion that every
    `BUILTIN_VALUE_EDITOR_TYPES` entry appears in a demo fixture.
  - `test/responsive.test.tsx` — all four skin surfaces at phone and desktop
    width on both sides of the theme (16 cases), plus a sweep asserting no
    builtin editor is desktop-only. The viewport and theme are mocked at the
    environment edge (a real `matchMedia` over a real `innerWidth`, a real
    `data-theme`), never by stubbing the hooks.

  `@stapel/showcase` joins the devDependencies. 168 tests (was 142); lint 0/0.

- 0921578: Every `/default` surface is its own skin root, and the composer's chips are a touch target.

  **Nothing in `src/default/**`wrapped itself.** The package draws form rows,
not pages, and it took that as licence to render no`SkinTheme`anywhere — so
on a dark document with no`ConfigProvider`above it, antd fell back to its
light algorithm and the ten editors painted light inputs and near-invisible
help text on a dark form.`FeatureFields`, `UnsupportedValueEditor`,
`FeatureBadges`, `FeatureValueList`and every builtin editor in`BUILTIN_VALUE_EDITORS`now render inside`SkinTheme surface="bare"`: the theme
  applies, the paint stays the host's, and a host that wraps the composer too
  pays nothing (nested skins reuse the applied config and render no second
  provider).

  **The test proved the test.** `test/responsive.test.tsx` already rendered every
  surface at phone/desktop × light/dark and asserted a skin root on the
  document's side — inside a `SkinTheme surface="base"` the test itself
  supplied. It renders with no skin above it now, so the assertion is about the
  component; the phone case asserts `data-stapel-skin-phone`, the branch the
  44px `controlHeight` comes from.

  **Chips at 27px.** `SkinTheme` raises antd's `controlHeight` to 44px on a phone
  VIEWPORT, and the listings composer draws these rows in a narrow form column on
  a full desktop — where the visual pass measured the segmented feature chips at
  ~27px. `FeatureFields` measures its own column with `useElementWidth` (the
  substrate's one measurement) against the `tablet` breakpoint and publishes the
  answer to the editors through context, since a registry-resolved editor cannot
  see its host. Below it, a `select` drawn as chips holds its labels to the touch
  floor, so the chip lands on 44 regardless of how wide the window is.

## 0.3.0

### Minor Changes

- 80617e9: Close the config-vocabulary gap between the validation mirror and the controls, and give the feature form a headless level.

  **The class.** The editors read roughly half the config keys `validate.ts` reads, so a well-configured category rendered as a set of unconstrained inputs that the mirror or the server then refused — §83's "a control that offers something meaningless in the current state", with a round trip attached. This closes it and adds the gate that keeps it closed: `test/configKeys.test.ts` extracts, from the SOURCE of both halves, the `config[...]` keys each type's mirror rule reads and each type's editor reads, and fails when the first is not a subset of the second — naming the key, the type and the editor.

  - **`hierarchical_select` reads its own `required`** (default `true`, `types/hierarchical_select/config.py`) for both the required marker and the mirrored refusal, through a new exported `featureAnswerRequired(feature)` — a per-type rule table, not an `if` on a slug. The pair read only `feature.mandatory`, so the field was unmarked and unmirrored while `publish_listing`'s raise-style `validate_dto` refuses an empty path with `mandatory_missing`.
  - **`string` / `int` / `float`** draw a picker when `options` is present — a closed `Select` when `allowCustom === false`, an `AutoComplete` (suggestions, free entry) otherwise — and carry `prefix` / `postfix` / `postfix1000`, `pattern` and `minLength` onto the control. `maxLength` becomes a live counter in the engine's own unit (code points), never a cap.
  - **`select`** honours `uiStyle` on both branches (`Segmented` / radio buttons / `Checkbox.Group`), treats an ABSENT `uiStyle` as `dropdown` (it previously read absent as "not dropdown" and rendered inline where the config said otherwise), states `minSelected` beside the control, and renders `lockUserInput` as a `GatedControl` with the reason rather than a bare disabled box.
  - **`date`** derives its bounds from `allowFuture` / `allowPast` as well as `minDate` / `maxDate`, offers `options` as a picklist, and honours `lockInput`. `config.default` seeds the new headless hook.
  - **`hierarchical_select`** prunes the option tree at `maxDepth` and drops `changeOnSelect` when `minDepth > 1`, so a path the engine would refuse is no longer selectable.
  - **`hex_color`** draws each colour category as a colour and resolves each option's `label` through `t()`.
  - **`bool`**'s `trueLabel` / `falseLabel` and every `prefix` / `postfix` / `postfix1000` now pass through `t()` — upstream declares all of them translation keys in `get_translation_keys(config)`. New `src/default/labels.ts` is the one place that happens.

  **New: `useFeatureFields`** — the headless half of `<FeatureFields/>` (§54). Values, the DTO envelope, the mirrored verdict, errors routed by slug, `touched` / `showAllErrors`, and an `ActionAvailability` submit gate that names its reason. `initialFeatureValues` seeds a form from the features' own configured defaults.

  **Display.** `formatFeatureValue` resolves a `hierarchical_select` path through the option tree (it printed the stored values: `passenger / sedan`), applies the engine's `postfix1000` scale-and-unit switch at a thousand, and translates `prefix`/`postfix`/`trueLabel`/`falseLabel`.

  **Copy (visual class C-DEVCOPY).** The unsupported-type notice and the unreadable-value cell no longer render a type slug or "this build": `size_grid` is an identifier out of a Python registry and the release process is not a seller's problem. Both now carry `data-attributes-type` for support. `unsupportedTypeGate` names the blocked features by their display NAME (`{features}`, was `{types}`); new `unsupportedFeatureNames()` exposes that list, and `unsupportedTypes()` is unchanged for logs.

  **Breaking (pre-1.0 minor):** `attributes.unsupported_type` and `attributes.value.unreadable` no longer interpolate `{type}`; `attributes.submit.blocked.unsupported_type` interpolates `{features}` instead of `{types}`; the dead `attributes.required` key is gone. `ValueEditorProps` gains optional `required` (editors set `aria-required`); `FeatureRowProps` gains `help` and `unsupported`. Peer floors move to `@stapel/core >=0.18.0` and `@stapel/tokens-antd >=0.6.0`. `manifest.json` declares `backend.contract ">=0.4 <0.5"`, so the contract-pin gate checks this pair instead of skipping it.

## 0.2.0

### Minor Changes

- 6c1f67e: New package: `@stapel/attributes-react` — the React value layer for
  `stapel-attributes`' dynamic feature types.

  L0, not a pair (modelled on `@stapel/image`): no client, no queries, no
  generated `schema.ts`, because its backend counterpart is an L1 library with
  no HTTP surface at all. Feature definitions and validation verdicts reach a
  browser inside the responses of the modules that own them, and those pairs
  depend on this one to draw and check what they carry.

  It switches on `config.type` — the VALUE type — which is a different axis from
  the `FormField.kind` that `@stapel/forms-react` keys on (the field kinds of
  the admin form that CONFIGURES a type). One consequence removes an upstream
  ask: a storefront needs no catalogue endpoint for these types, because the
  type arrives in the data on every feature.

  Main entry (no antd): the value-editor registry (`registerValueEditor` >
  skin builtin > loud unsupported, with `unsupportedTypeGate` blocking the
  submit and naming the reason), `mirrorValidate` returning the engine's own
  `ValidationBatchResult` shape with the engine's own `error.400.feature_*`
  keys, `featureErrorsBySlug` to lay a verdict on the controls that caused it,
  `toFeaturesDto`/`fromFeaturesDto` for the `{slug: {type, value}}` envelope,
  and React-free display formatting.

  `./default`: antd editors for all ten builtin types, `<FeatureFields>`,
  `<FeatureBadges>`, `<FeatureValueList>`.

  The mirror gets two easy-to-miss contract details right — `pattern` is a full
  match (`re.fullmatch`) and string length is counted in Unicode code points —
  and deliberately stands down on an unknown value type and on
  `convertible_unit`'s range, whose base-unit conversion table is server-side.
