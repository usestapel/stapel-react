---
"@stapel/core": minor
"@stapel/tokens-antd": minor
---

The substrate a field-level picker is built out of: one recency hook, four controls.

Every value kind in the catalogue — 2132 reference selects, 795 inline selects,
multiselects, numbers with units, VIN-like strings — was being drawn by each
pair out of raw antd, and the same four decisions were being re-taken with
different answers per package. They are taken once here.

**`@stapel/core` — `useRecents(scope, { max })`.**
The codes a person picked last, most recent first, deduped, capped, surviving a
reload. Headless on purpose: "the four makes you last chose, on top of the list"
is the same product rule in an attributes ref editor, a vocabulary term control
and (next) a search facet, so it cannot live in any one of them and must not
live in the antd bridge either. It persists through the `PersistStorage` ladder
that is already here (IndexedDB → localStorage → memory), never touches a
storage global directly, reads nothing during render (so a server render and
the client render that must match it are both an empty list), and never throws:
a refused backend, a full quota or a corrupt stored value costs the memory, not
the picker. Two controls on one scope share a list without a round trip.

**`@stapel/tokens-antd/skin` — `ChoiceChips`, `SkinPickerSheet`,
`SkinNumberField`, `CountedInput`.**
Four design-system rules, each stated once where every antd skin already
inherits from:

- **A handful of options is picked INLINE**, as 44px chips that wrap and never
  truncate a label mid-word. A chip that cannot be chosen states its reason as
  visible text under the row, once per distinct sentence, with
  `aria-describedby` pointing at it — the shape `GatedControl` and `PaneGate`
  already use, because a disabled control receives no pointer events and a
  tooltip on it is an explanation nobody can read.
- **A LONG list is picked in a bottom sheet with a search box, never a
  dropdown.** `SkinPickerSheet` composes `SkinDialog`, so it is a sheet on a
  phone and a modal above the tablet breakpoint, with the swipe, the focus trap
  and the safe-area padding already solved. Single-select answers and closes on
  the tap; multi-select holds a draft and commits it on a footer button that
  carries the count it is about to keep (and no count at all at zero, where
  "Done · 0" would read as a broken counter). It models four states a `Select`
  never had: loading (the commit is not blocked — what is already chosen is
  still chosen), empty, capped at 200 rows with a tail row that says so, and
  `listStale` — rows that no longer answer what is in the search box are dimmed
  and made inert, so nobody picks the previous query's fourth row believing it
  is this query's. Two pairs had improvised that last one; it is a first-class
  prop now.
- **A numeric field raises the numeric keypad, wears its unit as a suffix that
  is never part of the value, and treats min/max as a HINT.** `SkinNumberField`
  is deliberately not antd's `InputNumber`, which clamps: typing 9 towards 95 in
  a max-50 field leaves 9, and a blurred 120 becomes 100 with no sentence
  anywhere saying so. Out of range is the caller's validation to display, beside
  the field, in words — and the raw text is kept, so a half-typed `1.` does not
  snap back to `1` and `1.5` can be typed at all.
- **A length limit is a live counter, never a silent cap.** `CountedInput`
  counts Unicode code points — the unit the backend validates in — and never
  sets the DOM's `maxlength`, which counts UTF-16 units and would stop somebody
  two emoji short of the real limit with no message at all. `normalize` runs
  where foreign text enters (the paste, at the cursor) and once more on blur,
  never per keystroke.

Demos for all four at 390px, including the states that only exist because
nothing is being enforced silently: a stale list, a capped list, a number past
its stated range, a counter reading 19 / 17.
