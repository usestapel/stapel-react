---
"@stapel/attributes-react": minor
---

Every value kind gets the control a thumb can answer it with.

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
